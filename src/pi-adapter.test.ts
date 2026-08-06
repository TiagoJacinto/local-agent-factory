import { chmodSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { createPiAdapter } from "./pi-adapter.js";
import type { RunContext, WorkflowSession } from "./workflow.js";

const context = {
	artifacts: new Map(),
	envelopes: new Map(),
	validationResults: [],
	session: undefined,
} as unknown as RunContext;

function createPiHarness(): { executable: string; argsFile: string } {
	const directory = mkdtempSync(join(tmpdir(), "pi-adapter-harness-"));
	const argsFile = join(directory, "args.json");
	const executable = join(directory, "pi");
	writeFileSync(
		executable,
		`#!/usr/bin/env node
const fs = require("node:fs");
fs.writeFileSync(process.env.PI_ARGS_FILE, JSON.stringify(process.argv.slice(2)));
console.log(JSON.stringify({type:"message_end",message:{role:"assistant",content:[{type:"text",text:"{\\"ok\\":true}"}]}}));
`,
	);
	chmodSync(executable, 0o755);
	return { executable, argsFile };
}

describe("Pi primitive adapter", () => {
	test("runs Pi with role configuration and returns typed JSON output", async () => {
		const harness = createPiHarness();
		const adapter = createPiAdapter({
			executable: harness.executable,
			environment: { PI_ARGS_FILE: harness.argsFile },
		});
		const session: WorkflowSession = {
			id: "workflow-session",
			runIdentifier: "run-1",
			sameAgentContext: true,
			agentSessions: {},
		};

		const result = await adapter({
			invocationId: "builder",
			name: "Build request",
			input: "add a health endpoint",
			context,
			role: {
				name: "builder",
				model: "provider/model",
				instructions: "Build only the requested change",
				tools: ["read", "write"],
				allowedWrites: ["src/"],
			},
			workspacePath: tmpdir(),
			session,
		});

		expect(result?.value).toEqual({ ok: true });
		const args = JSON.parse(readFileSync(harness.argsFile, "utf8")) as string[];
		expect(args).toEqual(expect.arrayContaining([
			"--mode", "json", "--print", "--session-id", session.agentSessions.builder,
			"--model", "provider/model", "--tools", "read,write", "--approve",
		]));
	});

	test("emits Pi activity and reuses the role session", async () => {
		const harness = createPiHarness();
		const adapter = createPiAdapter({
			executable: harness.executable,
			environment: { PI_ARGS_FILE: harness.argsFile },
		});
		const session: WorkflowSession = {
			id: "workflow-session",
			runIdentifier: "run-1",
			sameAgentContext: true,
			agentSessions: {},
		};
		const events: string[] = [];
		const input = { invocationId: "builder", name: "Build", input: "build", context, session, emit: (event: { name: string }) => events.push(event.name) };
		await adapter(input);
		const first = session.agentSessions.builder;
		await adapter(input);

		expect(session.agentSessions.builder).toBe(first);
		expect(events).toContain("message_end");
	});
});
