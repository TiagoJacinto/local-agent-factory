import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { createCli } from "./cli";
import {
	SQLiteWorkflowTraceStore,
	type WorkflowTrace,
} from "./workflow-trace.ts";
import { WorkflowExecutor, type WorkflowDefinition } from "./workflow.ts";

describe("CLI", () => {
	test("uses Commander to run the greet command", async () => {
		const messages: string[] = [];
		const cli = createCli((message) => messages.push(message));

		await cli.parseAsync(["node", "local-agent-factory", "greet", "Ada"]);

		expect(messages).toEqual(["Hello, Ada!"]);
	});

	test("executes a selected workflow with repository and objective arguments", async () => {
		const messages: string[] = [];
		const calls: string[] = [];
		const repository = mkdtempSync(join(tmpdir(), "cli-workflow-source-"));
		execFileSync("git", ["init", "--quiet", repository]);
		execFileSync("git", ["-C", repository, "config", "user.email", "test@example.com"]);
		execFileSync("git", ["-C", repository, "config", "user.name", "Test"]);
		writeFileSync(join(repository, "README.md"), "source\n");
		execFileSync("git", ["-C", repository, "add", "README.md"]);
		execFileSync("git", ["-C", repository, "commit", "--quiet", "-m", "initial"]);
		const workflow: WorkflowDefinition = {
			id: "configured",
			name: "Configured workflow",
			controller: async ({ harness, objective }) => {
				calls.push(objective ?? "");
				await harness("build", "Build request", objective ?? "");
			},
		};
		const cli = createCli(
			(message) => messages.push(message),
			new WorkflowExecutor([workflow]),
		);

		await cli.parseAsync([
			"node",
			"local-agent-factory",
			"workflow",
			"configured",
			"--repository",
			repository,
			"--objective",
			"add health endpoint",
		]);

		expect(calls).toEqual(["add health endpoint"]);
		expect(JSON.parse(messages[0])).toMatchObject({
			workflowId: "configured",
			status: "Succeeded",
		});
	});

	test("renders a stored workflow trace as a read-only HTML view", async () => {
		const messages: string[] = [];
		const database = join(
			mkdtempSync(join(tmpdir(), "cli-trace-")),
			"trace.sqlite",
		);
		const trace: WorkflowTrace = {
			runIdentifier: "run-001",
			workflowId: "reviewable",
			status: "AwaitingReview",
			events: [],
			validationResults: [],
			envelopes: [],
			artifacts: [],
		};
		new SQLiteWorkflowTraceStore(database).start(trace);

		const cli = createCli((message) => messages.push(message));
		await cli.parseAsync([
			"node",
			"local-agent-factory",
			"trace",
			"run-001",
			"--database",
			database,
		]);

		// result verification
		expect(messages[0]).toContain("<!doctype html>");
		expect(messages[0]).toContain("run-001");
		expect(messages[0]).toContain("AwaitingReview");
	});

	test("uses the default name when none is provided", async () => {
		const messages: string[] = [];
		const cli = createCli((message) => messages.push(message));

		await cli.parseAsync(["node", "local-agent-factory", "greet"]);

		expect(messages).toEqual(["Hello, world!"]);
	});
});
