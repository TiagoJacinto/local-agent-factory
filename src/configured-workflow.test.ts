import { execFileSync } from "node:child_process";
import { chmodSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import {
	WorkflowPackageInstaller,
	createStarterWorkflowDefinitions,
	type FactorySetupFailure,
} from "./workflow-package.js";
import { WorkflowExecutor, type WorkflowDefinition } from "./workflow.js";

function createPiExecutable(): { executable: string; argsFile: string } {
	const directory = mkdtempSync(join(tmpdir(), "configured-pi-"));
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
		const workspaceRoot = mkdtempSync(
			join(tmpdir(), "configured-workflow-workspace-"),
		);
		const calls: string[] = [];
		const executor = new WorkflowExecutor(createStarterWorkflowDefinitions(), {
			ai: ({ name, input }) => {
				calls.push(`AI:${name}:${input}`);
				return {
					value:
						name === "Plan request"
							? {
									producer: "planner",
									consumer: "builder",
									status: "Success",
									objective: input,
									risks: ["No known risks"],
									expectedFiles: ["README.md"],
									acceptanceCriteria: ["The requested change is implemented"],
									validationCommands: ["bun test"],
								}
							: `${name} output`,
				};
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
		expect(
			run.invocations.map(({ name, primitiveType, status }) => ({
				name,
				primitiveType,
				status,
			})),
		).toEqual([
			{ name: "Plan request", primitiveType: "AI", status: "Succeeded" },
			{ name: "Build request", primitiveType: "Harness", status: "Succeeded" },
			{ name: "Review change", primitiveType: "AI", status: "Succeeded" },
			{
				name: "Await human review",
				primitiveType: "Gate",
				status: "Succeeded",
			},
		]);
		expect(calls[0]).toContain("add a health endpoint");
		expect(run.context.artifacts.get("plan")).toMatchObject({
			producerInvocationId: "planner",
			consumerInvocationId: "builder",
		});
		expect(run.context.envelopes.get("plan")).toEqual({
			producer: "planner",
			consumer: "builder",
			status: "Success",
			objective: "add a health endpoint",
			risks: ["No known risks"],
			expectedFiles: ["README.md"],
			acceptanceCriteria: ["The requested change is implemented"],
			validationCommands: ["bun test"],
		});
		expect(readFileSync(join(source.path, "README.md"), "utf8")).toBe(
			"before\n",
		);
	});

	test("executes a configured Pi agent from the installed registry", async () => {
		const repository = mkdtempSync(
			join(tmpdir(), "installed-pi-workflow-package-"),
		);
		const pi = createPiExecutable();
		new WorkflowPackageInstaller({
			pi: {
				executable: pi.executable,
				environment: { PI_ARGS_FILE: pi.argsFile },
			},
		}).installWorkflowPackage(repository);
		new WorkflowPackageInstaller().configureAgentRole("builder", repository, {
			model: "provider/model",
			instructions: "Build only the requested change",
			tools: ["read", "write"],
		});

		const run = await new WorkflowPackageInstaller({
			pi: {
				executable: pi.executable,
				environment: { PI_ARGS_FILE: pi.argsFile },
			},
		})
			.createExecutor(repository)
			.executeWorkflow("build", {
				objective: "add a health endpoint",
			});

		expect(run.status).toBe("Succeeded");
		expect(run.invocations[0]).toMatchObject({
			primitiveType: "Harness",
			status: "Succeeded",
		});
		const args = JSON.parse(readFileSync(pi.argsFile, "utf8")) as string[];
		expect(args).toEqual(
			expect.arrayContaining([
				"--model",
				"provider/model",
				"--append-system-prompt",
				"Build only the requested change",
				"--tools",
				"read,write",
				"--session-id",
				run.session.agentSessions.builder,
			]),
		);
	});

	test("executes workflows from the installed registry", async () => {
		const repository = mkdtempSync(
			join(tmpdir(), "installed-workflow-package-"),
		);
		new WorkflowPackageInstaller().installWorkflowPackage(repository);
		let plannerModel: string | undefined;
		const executor = new WorkflowPackageInstaller().createExecutor(repository, {
			ai: ({ input, role }) => {
				plannerModel = role?.model;
				return {
					value: {
						producer: "planner",
						consumer: "builder",
						status: "Success",
						objective: input,
						risks: [],
						expectedFiles: [],
						acceptanceCriteria: [],
						validationCommands: [],
					},
				};
			},
			harness: ({ inputArtifact }) => ({ value: inputArtifact?.value }),
		});

		const run = await executor.executeWorkflow("plan-build", {
			objective: "use installed workflow",
		});

		expect(run.status).toBe("Succeeded");
		expect(plannerModel).toBe("default");
		expect(run.context.envelopes.get("plan")?.consumer).toBe("builder");
	});

	test("does not pass malformed planner output to the builder", async () => {
		const calls: string[] = [];
		const executor = new WorkflowExecutor(createStarterWorkflowDefinitions(), {
			ai: ({ name }) => {
				calls.push(name);
				return { value: { producer: "planner" } };
			},
			harness: ({ name }) => {
				calls.push(name);
				return undefined;
			},
		});

		const run = await executor.executeWorkflow("plan-build-test-review", {
			objective: "add a health endpoint",
		});

		expect(run).toMatchObject({
			status: "Failed",
			failure: "EnvelopeParseFailed",
			failureEvidence: {
				invocationId: "planner",
				primitiveType: "AI",
			},
		});
		expect(
			run.invocations.map(({ name, status }) => ({ name, status })),
		).toEqual([{ name: "Plan request", status: "Failed" }]);
		expect(calls).toEqual(["Plan request"]);
	});

	test("corrects malformed planner output in the same agent session", async () => {
		let attempts = 0;
		const executor = new WorkflowExecutor(createStarterWorkflowDefinitions(), {
			ai: ({ name }) => {
				if (!name.toLowerCase().includes("plan")) return { value: "reviewed" };
				attempts += 1;
				return {
					value:
						attempts === 1
							? { producer: "planner" }
							: {
									producer: "planner",
									consumer: "builder",
									status: "Success",
									objective: "add a health endpoint",
									risks: [],
									expectedFiles: ["src/health.ts"],
									acceptanceCriteria: ["health endpoint works"],
									validationCommands: ["bun test"],
								},
				};
			},
			harness: () => undefined,
		});

		const run = await executor.executeWorkflow("plan-build", {
			objective: "add a health endpoint",
		});

		expect(run.status).toBe("Succeeded");
		expect(attempts).toBe(2);
		expect(run.session.sameAgentContext).toBe(true);
		expect(run.context.envelopes.get("plan")).toMatchObject({
			status: "Success",
		});
	});

	test("returns validation findings to the builder for bounded correction", async () => {
		const source = createRepository();
		const workspaceRoot = mkdtempSync(join(tmpdir(), "validation-correction-"));
		let builds = 0;
		const executor = new WorkflowExecutor(createStarterWorkflowDefinitions(), {
			harness: ({ name, workspacePath }) => {
				if (name === "Build request" || name === "Correct build") {
					builds += 1;
					if (builds === 2)
						writeFileSync(join(workspacePath!, "validation.pass"), "ok\n");
				}
				return undefined;
			},
			ai: () => ({ value: "reviewed" }),
			gate: () => undefined,
		});

		const run = await executor.executeWorkflow("build-test", {
			objective: "add a health endpoint",
			sourceRepository: source.path,
			expectedSourceRevision: source.revision,
			workspaceRoot,
		});

		expect(run.status).toBe("AwaitingReview");
		expect(builds).toBe(2);
		expect(run.validationResults).toHaveLength(2);
		expect(run.validationResults[0]?.status).toBe("Failed");
		expect(run.validationResults[1]?.status).toBe("Succeeded");
	});

	test("configures a role and selects a named starter workflow", () => {
		const repository = mkdtempSync(join(tmpdir(), "factory-configuration-"));
		const installer = new WorkflowPackageInstaller();
		installer.installWorkflowPackage(repository);

		const configured = installer.configureAgentRole("builder", repository, {
			model: "builder-model",
			instructions: "Build only the requested change",
			tools: ["read", "write"],
			allowedWrites: ["src/"],
		});
		const planner = installer.configureAgentRole("planner", repository, {
			harnessSupport: true,
		});

		// state verification
		expect(
			configured.agentRoles.find((role) => role.name === "builder"),
		).toMatchObject({
			model: "builder-model",
			instructions: "Build only the requested change",
			tools: ["read", "write"],
			allowedWrites: ["src/"],
		});
		expect(
			planner.agentRoles.find((role) => role.name === "planner"),
		).toMatchObject({
			harnessSupport: true,
		});
		expect(installer.selectWorkflow("simple-sdlc", repository)).toMatchObject({
			id: "simple-sdlc",
		});
		expect(
			installer.configureWorkflowPackage(repository).workflowRegistry
				.registeredWorkflows,
		).toEqual([
			"prompt",
			"scout",
			"plan",
			"build",
			"quality",
			"plan-build",
			"build-test",
			"build-review",
			"plan-build-test",
			"plan-build-test-quality",
			"document",
			"simple-sdlc",
		]);
	});

	test("creates and updates bounded custom workflows", () => {
		const repository = mkdtempSync(join(tmpdir(), "factory-authoring-"));
		const installer = new WorkflowPackageInstaller();
		installer.installWorkflowPackage(repository);

		const created = installer.createWorkflow(
			"plan-build-security",
			repository,
			["planner", "builder", "security"],
			{ criteria: ["Security checks pass"] },
		);
		expect(created.workflowRegistry.registeredWorkflows).toContain(
			"plan-build-security",
		);
		expect(created.workflowRegistry.workflowDefinitions).toMatchObject([
			{
				id: "plan-build-security",
				phases: [
					{ name: "planner", role: "planner" },
					{ name: "builder", role: "builder" },
					{ name: "security", role: "security" },
				],
			},
		]);

		const updated = installer.updateWorkflow(
			repository,
			"plan-build-security",
			["planner", "builder", "tester", "security"],
			{ criteria: ["Tests and security checks pass"] },
		);
		expect(
			updated.workflowRegistry.workflowDefinitions?.[0]?.phases.map(
				(phase) => phase.name,
			),
		).toEqual(["planner", "builder", "tester", "security"]);
	});

	test("reports invalid workflow configuration before execution", () => {
		const repository = mkdtempSync(join(tmpdir(), "factory-invalid-"));
		const installer = new WorkflowPackageInstaller();
		installer.installWorkflowPackage(repository);
		const packagePath = join(
			repository,
			".local-agent-factory",
			"package.json",
		);
		const setup = JSON.parse(readFileSync(packagePath, "utf8")) as {
			workflowRegistry: { registeredWorkflows: string[] };
		};
		setup.workflowRegistry.registeredWorkflows.pop();
		writeFileSync(packagePath, JSON.stringify(setup));

		const result = installer.verifyFactory(repository) as FactorySetupFailure;
		expect(result).toEqual({
			status: "Failed",
			failure: "InvalidWorkflowConfiguration",
		});
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
