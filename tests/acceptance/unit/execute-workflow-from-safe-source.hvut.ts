import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import {
	WorkflowExecutor,
	type WorkflowDefinition,
} from "../../../src/workflow";

function createRepository(): { path: string; revision: string; head: string } {
	const path = mkdtempSync(join(tmpdir(), "safe-source-"));
	execFileSync("git", ["init", "--quiet", path]);
	execFileSync("git", ["-C", path, "config", "user.email", "test@example.com"]);
	execFileSync("git", ["-C", path, "config", "user.name", "Test"]);
	writeFileSync(join(path, "README.md"), "before\n");
	execFileSync("git", ["-C", path, "add", "README.md"]);
	execFileSync("git", ["-C", path, "commit", "--quiet", "-m", "initial"]);
	const revision = execFileSync("git", ["-C", path, "rev-parse", "HEAD"], {
		encoding: "utf8",
	}).trim();
	return { path, revision, head: revision };
}

function workflow(id = "update-readme"): WorkflowDefinition {
	return {
		id,
		name: "Update README",
		controller: async ({ harness }) => {
			await harness("update", "Update README", "after");
		},
	};
}

describe("Execute a workflow from a safe source repository", () => {
	test("executes worker activity in a disposable workspace", async () => {
		const source = createRepository();
		const workspaceRoot = mkdtempSync(join(tmpdir(), "safe-workspaces-"));
		let workerWorkspace: string | undefined;
		const executor = new WorkflowExecutor([workflow()], {
			harness: ({ workspacePath, input }) => {
				workerWorkspace = workspacePath;
				writeFileSync(join(workspacePath!, "README.md"), `${input}\n`);
				return undefined;
			},
		});
		const run = await executor.executeWorkflow("update-readme", {
			sourceRepository: source.path,
			expectedSourceRevision: source.revision,
			workspaceRoot,
		});

		expect(run).toMatchObject({
			status: "Succeeded",
			sourceRevision: source.revision,
			workspaceIsolation: "IndependentClone",
			sourceIntegrity: "Verified",
		});
		expect(run.runIdentifier).toMatch(/^local-run-/);
		expect(run.workspacePath).toBe(workerWorkspace);
		expect(run.invocations[0]).toMatchObject({
			invocationId: "update",
			status: "Succeeded",
			workspacePath: workerWorkspace,
		});
		expect(readFileSync(join(run.workspacePath!, "README.md"), "utf8")).toBe(
			"after\n",
		);
		expect(
			execFileSync("git", ["-C", source.path, "rev-parse", "HEAD"], {
				encoding: "utf8",
			}).trim(),
		).toBe(source.head);
		expect(
			execFileSync("git", ["-C", source.path, "status", "--porcelain"], {
				encoding: "utf8",
			}),
		).toBe("");
	});

	test("rejects a source that changes during worker activity", async () => {
		const source = createRepository();
		const workspaceRoot = mkdtempSync(join(tmpdir(), "safe-workspaces-"));
		const executor = new WorkflowExecutor([workflow()], {
			harness: () => {
				writeFileSync(
					join(source.path, "tampered.txt"),
					"changed outside workspace\n",
				);
				return undefined;
			},
		});
		const run = await executor.executeWorkflow("update-readme", {
			sourceRepository: source.path,
			expectedSourceRevision: source.revision,
			workspaceRoot,
		});

		expect(run).toMatchObject({
			status: "Failed",
			sourceIntegrity: "Changed",
			failure: "SourceChanged",
			workspaceDisposition: "Retained",
		});
		expect(readFileSync(join(source.path, "tampered.txt"), "utf8")).toContain(
			"changed outside",
		);
	});

	test("rejects a dirty source before workspace or worker execution", async () => {
		const source = createRepository();
		writeFileSync(join(source.path, "uncommitted.txt"), "dirty\n");
		let workerCalled = false;
		const executor = new WorkflowExecutor([workflow()], {
			harness: () => {
				workerCalled = true;
				return undefined;
			},
		});
		const run = await executor.executeWorkflow("update-readme", {
			sourceRepository: source.path,
			expectedSourceRevision: source.revision,
		});

		expect(run).toMatchObject({
			status: "Failed",
			sourceRevision: source.revision,
			sourceIntegrity: "Verified",
			failure: "DirtySource",
		});
		expect(run.workspacePath).toBeUndefined();
		expect(run.invocations).toEqual([]);
		expect(workerCalled).toBe(false);
	});

	test("rejects an unexpected source revision before workspace or worker execution", async () => {
		const source = createRepository();
		let workerCalled = false;
		const executor = new WorkflowExecutor([workflow()], {
			harness: () => {
				workerCalled = true;
				return undefined;
			},
		});
		const run = await executor.executeWorkflow("update-readme", {
			sourceRepository: source.path,
			expectedSourceRevision: "unexpected-revision",
		});

		expect(run).toMatchObject({
			status: "Failed",
			sourceRevision: source.revision,
			sourceIntegrity: "Verified",
			failure: "UnexpectedSourceRevision",
		});
		expect(run.workspacePath).toBeUndefined();
		expect(run.invocations).toEqual([]);
		expect(workerCalled).toBe(false);
	});

	test("retains the disposable workspace when worker activity fails", async () => {
		const source = createRepository();
		const workspaceRoot = mkdtempSync(join(tmpdir(), "safe-workspaces-"));
		const executor = new WorkflowExecutor([workflow()], {
			harness: ({ workspacePath }) => {
				writeFileSync(join(workspacePath!, "failure.txt"), "inspect me\n");
				return { status: "Failed" };
			},
		});
		const run = await executor.executeWorkflow("update-readme", {
			sourceRepository: source.path,
			expectedSourceRevision: source.revision,
			workspaceRoot,
		});

		expect(run).toMatchObject({
			status: "Failed",
			sourceRevision: source.revision,
			workspaceDisposition: "Retained",
		});
		expect(run.invocations[0]).toMatchObject({ status: "Failed" });
		expect(readFileSync(join(run.workspacePath!, "failure.txt"), "utf8")).toBe(
			"inspect me\n",
		);
		expect(
			execFileSync("git", ["-C", source.path, "rev-parse", "HEAD"], {
				encoding: "utf8",
			}).trim(),
		).toBe(source.head);
		expect(
			execFileSync("git", ["-C", source.path, "status", "--porcelain"], {
				encoding: "utf8",
			}),
		).toBe("");
	});
});
