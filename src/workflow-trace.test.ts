import { describe, expect, test } from "vitest";
import {
	InMemoryWorkflowTraceStore,
	renderWorkflowTrace,
	SQLiteWorkflowTraceStore,
	WorkflowTraceViewer,
	type WorkflowTrace,
} from "./workflow-trace.js";
import { mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { WorkflowExecutor, type WorkflowDefinition } from "./workflow.js";


describe("workflow trace", () => {
	test("lists available workflow runs without exposing mutable trace state", async () => {
		const store = new InMemoryWorkflowTraceStore();
		store.start({
			runIdentifier: "run-123",
			workflowId: "build",
			status: "Running",
			events: [],
			validationResults: [],
			envelopes: [],
			artifacts: [],
		});
		store.start({
			runIdentifier: "run-456",
			workflowId: "review",
			status: "AwaitingReview",
			events: [],
			validationResults: [],
			envelopes: [],
			artifacts: [],
		});

		const viewer = new WorkflowTraceViewer(store);
		const runs = await viewer.listWorkflowRuns();
		runs[0]!.status = "Failed";

		// result verification
		expect(await viewer.listWorkflowRuns()).toEqual([
			{ runIdentifier: "run-123", workflowId: "build", status: "Running" },
			{
				runIdentifier: "run-456",
				workflowId: "review",
				status: "AwaitingReview",
			},
		]);
		// state verification
		expect((await viewer.inspectWorkflowRun("run-123"))?.status).toBe("Running");
	});
	test("persists completed validation and review evidence", async () => {
		const traceStore = new InMemoryWorkflowTraceStore();
		const workflow: WorkflowDefinition = {
			id: "reviewable",
			name: "Reviewable workflow",
			completesWithReview: true,
			controller: async ({ ai, gate, validate }) => {
				await ai("plan", "Plan change", "objective", {
					outputArtifact: "plan",
					outputEnvelope: {
						producer: "planner",
						consumer: "reviewer",
					},
				});
				await validate();
				await gate("review", "Review change", "plan", {
					inputArtifact: "plan",
				});
			},
		};
		const executor = new WorkflowExecutor([workflow], {
			traceStore,
			ai: async () => ({
				value: {
					producer: "planner",
					consumer: "reviewer",
					status: "Success",
					summary: "planned",
					objective: "objective",
					risks: [],
					expectedFiles: [],
					acceptanceCriteria: [],
					validationCommands: [],
				},
			}),
		});

		const run = await executor.executeWorkflow("reviewable");
		const trace = executor.inspectWorkflowRun(run.runIdentifier!);

		// state verification
		expect(run.status).toBe("AwaitingReview");
		expect(trace).toMatchObject({
			runIdentifier: run.runIdentifier,
			status: "AwaitingReview",
		});
		expect(trace?.validationResults[0].status).toBe("Succeeded");
		expect(trace?.envelopes).toHaveLength(1);
		expect(trace?.artifacts.map((artifact) => artifact.id)).toContain("plan");

		const viewer = renderWorkflowTrace(trace!);
		// result verification
		expect(viewer).toContain(trace!.runIdentifier);
		expect(viewer).toContain("AwaitingReview");
		expect(viewer).toContain("Validation evidence");
		expect(viewer).toContain("planned");
	});

	test("renders retained failure workspace evidence", () => {
		const trace: WorkflowTrace = {
			runIdentifier: "run-failed",
			workflowId: "build",
			status: "Failed",
			events: [],
			validationResults: [],
			envelopes: [],
			artifacts: [],
			workspacePath: "/tmp/workflow-run-failed",
			workspaceDisposition: "Retained",
			failure: "ValidationFailed",
			failureEvidence: {
				message: "Validation failed: typecheck",
				output: "error TS2322",
			},
		};

		const viewer = renderWorkflowTrace(trace);
		// result verification
		expect(viewer).toContain("ValidationFailed");
		expect(viewer).toContain("/tmp/workflow-run-failed");
		expect(viewer).toContain("Retained");
		expect(viewer).toContain("error TS2322");
	});

	test("can inspect tool calls and process activity while the run is active", async () => {
		const traceStore = new InMemoryWorkflowTraceStore();
		let releaseTool!: () => void;
		const toolReleased = new Promise<void>((resolve) => {
			releaseTool = resolve;
		});
		const workflow: WorkflowDefinition = {
			id: "tool-running",
			name: "Tool workflow",
			controller: async ({ harness }) => {
				await harness("builder", "Run tests", "bun test", {
					outputArtifact: "test-result",
				});
			},
		};
		const executor = new WorkflowExecutor([workflow], {
			traceStore,
			harness: async ({ emit }) => {
				emit?.({ name: "bun", status: "Running", data: { pid: 123 } });
				await toolReleased;
				return { value: { exitCode: 0, output: "passed" } };
			},
		});

		const pendingRun = executor.executeWorkflow("tool-running", {
			runIdentifier: "run-123",
		});
		await new Promise<void>((resolve) => setTimeout(resolve, 0));
		const running = executor.inspectWorkflowRun("run-123");
		expect(running?.events).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					kind: "tool_call",
					status: "Running",
					data: expect.objectContaining({ arguments: "bun test" }),
				}),
				expect.objectContaining({
					kind: "process",
					name: "bun",
					status: "Running",
				}),
			]),
		);
		releaseTool();
		await pendingRun;
		const completed = executor.inspectWorkflowRun("run-123");
		expect(completed?.events).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					kind: "tool_call",
					status: "Succeeded",
					data: expect.objectContaining({
						arguments: "bun test",
						result: { exitCode: 0, output: "passed" },
					}),
				}),
			]),
		);
	});

	test("can inspect primitive activity while the run is active", async () => {
		const traceStore = new InMemoryWorkflowTraceStore();
		let releaseGate!: () => void;
		const gateReleased = new Promise<void>((resolve) => {
			releaseGate = resolve;
		});
		const workflow: WorkflowDefinition = {
			id: "long-running",
			name: "Long running workflow",
			controller: async ({ gate }) => {
				await gate("review", "Review change", "objective");
			},
		};
		const executor = new WorkflowExecutor([workflow], {
			traceStore,
			gate: async () => {
				await gateReleased;
				return { value: "approved" };
			},
		});

		const pendingRun = executor.executeWorkflow("long-running");
		await Promise.resolve();
		const running = executor.inspectWorkflowRun(
			traceStore.latestRunIdentifier() ?? "missing",
		);
		releaseGate();
		await pendingRun;

		// state verification
		expect(running?.events).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					kind: "primitive",
					name: "Review change",
					status: "Running",
				}),
			]),
		);
	});

	test("stores traces in SQLite", () => {
		const path = join(
			mkdtempSync(join(tmpdir(), "workflow-trace-")),
			"trace.sqlite",
		);
		const store = new SQLiteWorkflowTraceStore(path);
		store.start({
			runIdentifier: "run-001",
			workflowId: "workflow",
			status: "Running",
			events: [],
			validationResults: [],
			envelopes: [],
			artifacts: [],
		});

		// state verification
		expect(new SQLiteWorkflowTraceStore(path).get("run-001")).toMatchObject({
			runIdentifier: "run-001",
			status: "Running",
		});
	});
});
