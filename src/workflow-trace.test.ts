import { describe, expect, test } from "vitest";
import {
	InMemoryWorkflowTraceStore,
	SQLiteWorkflowTraceStore,
} from "./workflow-trace.ts";
import { mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { WorkflowExecutor, type WorkflowDefinition } from "./workflow.ts";

describe("workflow trace", () => {
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
				await gate("review", "Review change", "plan", { inputArtifact: "plan" });
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
		expect(trace).toMatchObject({ runIdentifier: run.runIdentifier, status: "AwaitingReview" });
		expect(trace?.validationResults[0].status).toBe("Succeeded");
		expect(trace?.envelopes).toHaveLength(1);
		expect(trace?.artifacts.map((artifact) => artifact.id)).toContain("plan");
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
				expect.objectContaining({ kind: "primitive", name: "Review change", status: "Running" }),
			]),
		);
	});

	test("stores traces in SQLite", () => {
		const path = join(mkdtempSync(join(tmpdir(), "workflow-trace-")), "trace.sqlite");
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
