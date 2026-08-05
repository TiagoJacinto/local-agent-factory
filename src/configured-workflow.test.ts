import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { createStarterWorkflowDefinitions } from "./workflow-package.ts";
import { WorkflowExecutor, type WorkflowDefinition } from "./workflow.ts";

function createRepository(): { path: string; revision: string } {
	const path = mkdtempSync(join(tmpdir(), "configured-workflow-source-"));
	execFileSync("git", ["init", "--quiet", path]);
	execFileSync("git", ["-C", path, "config", "user.email", "test@example.com"]);
	execFileSync("git", ["-C", path, "config", "user.name", "Test"]);
	writeFileSync(join(path, "README.md"), "before\n");
	execFileSync("git", ["-C", path, "add", "README.md"]);
	execFileSync("git", ["-C", path, "commit", "--quiet", "-m", "initial"]);
	const revision = execFileSync("git", ["-C", path, "rev-parse", "HEAD"], {
		encoding: "utf8",
	}).trim();
	return { path, revision };
}

describe("configured agent workflow", () => {
	test("executes plan-build-test-review in an independent workspace", async () => {
		const source = createRepository();
		const workspaceRoot = mkdtempSync(join(tmpdir(), "configured-workflow-workspace-"));
		const calls: string[] = [];
		const executor = new WorkflowExecutor(createStarterWorkflowDefinitions(), {
			ai: ({ name, input }) => {
				calls.push(`AI:${name}:${input}`);
				return { value: `${name} output` };
			},
			harness: ({ name, inputArtifact, workspacePath }) => {
				calls.push(`Harness:${name}:${inputArtifact?.value}`);
				writeFileSync(join(workspacePath!, "README.md"), "after\n");
				return undefined;
			},
			gate: ({ name }) => {
				calls.push(`Gate:${name}`);
				return undefined;
			},
		});

		const run = await executor.executeWorkflow("plan-build-test-review", {
			objective: "add a health endpoint",
			sourceRepository: source.path,
			expectedSourceRevision: source.revision,
			workspaceRoot,
		});

		expect(run).toMatchObject({
			status: "AwaitingReview",
			sourceRevision: source.revision,
			workspaceIsolation: "IndependentClone",
		});
		expect(run.invocations.map(({ name, primitiveType, status }) => ({ name, primitiveType, status }))).toEqual([
			{ name: "Plan request", primitiveType: "AI", status: "Succeeded" },
			{ name: "Build request", primitiveType: "Harness", status: "Succeeded" },
			{ name: "Review change", primitiveType: "AI", status: "Succeeded" },
			{ name: "Await human review", primitiveType: "Gate", status: "Succeeded" },
		]);
		expect(calls[0]).toContain("add a health endpoint");
		expect(run.context.artifacts.get("plan")).toMatchObject({
			producerInvocationId: "plan",
			consumerInvocationId: "build",
		});
		expect(readFileSync(join(source.path, "README.md"), "utf8")).toBe("before\n");
	});

	test("returns structured failure evidence when an adapter fails", async () => {
		const workflow: WorkflowDefinition = {
			id: "failing-build",
			name: "Failing build",
			controller: async ({ harness }) => {
				await harness("build", "Build request", "build it");
			},
		};
		const executor = new WorkflowExecutor([workflow], {
			harness: () => {
				throw new Error("harness unavailable");
			},
		});

		const run = await executor.executeWorkflow("failing-build");

		expect(run).toMatchObject({
			status: "Failed",
			failure: "AdapterFailed",
			failureEvidence: {
				invocationId: "build",
				primitiveType: "Harness",
				message: "harness unavailable",
			},
		});
		expect(run.invocations[0]).toMatchObject({ status: "Failed" });
	});
});
