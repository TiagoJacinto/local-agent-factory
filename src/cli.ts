import { Command } from "commander";
import { z } from "zod";
import { join } from "node:path";
import { WorkflowPackageInstaller } from "./workflow-package.js";
import {
	DEFAULT_WORKFLOW_TRACE_DATABASE_PATH,
	renderWorkflowTrace,
	SQLiteWorkflowTraceStore,
} from "./workflow-trace.js";
import { WorkflowExecutor } from "./workflow.js";

const greetingOptionsSchema = z.object({
	name: z.string().trim().min(1).default("world"),
});

const workflowOptionsSchema = z.object({
	repository: z.string().trim().min(1),
	objective: z.string().trim().min(1),
	revision: z.string().trim().min(1).optional(),
	workspaceRoot: z.string().trim().min(1).optional(),
});

const traceOptionsSchema = z.object({
	database: z
		.string()
		.trim()
		.min(1)
		.default(DEFAULT_WORKFLOW_TRACE_DATABASE_PATH),
});

const packageOptionsSchema = z.object({ repository: z.string().trim().min(1) });
const roleOptionsSchema = z.object({
	repository: z.string().trim().min(1),
	model: z.string().trim().min(1).optional(),
	instructions: z.string().trim().min(1).optional(),
	tools: z.string().optional(),
	allowedWrites: z.string().optional(),
	harnessSupport: z.boolean().optional(),
});

export function createDefaultExecutor(repository: string): WorkflowExecutor {
	return new WorkflowPackageInstaller().createExecutor(repository, {
		traceStore: new SQLiteWorkflowTraceStore(
			join(repository, ".local-agent-factory", "workflow-traces.sqlite"),
		),
	});
}

function renderWorkflowRun(
	run: Awaited<ReturnType<WorkflowExecutor["executeWorkflow"]>>,
): string {
	return JSON.stringify(
		{
			...run,
			context: { artifacts: Object.fromEntries(run.context.artifacts) },
		},
		null,
		2,
	);
}

export function createCli(
	output: (message: string) => void = console.log,
	executor?: WorkflowExecutor,
): Command {
	const program = new Command();

	program
		.name("local-agent-factory")
		.description("Local tools for building and running coding agents")
		.version("0.1.0");

	program
		.command("install")
		.description("Install or refresh the factory package")
		.requiredOption("--repository <path>", "target repository")
		.action((rawOptions: unknown) => {
			const options = packageOptionsSchema.parse(rawOptions);
			output(
				JSON.stringify(
					new WorkflowPackageInstaller().installWorkflowPackage(
						options.repository,
					),
					null,
					2,
				),
			);
		});

	program
		.command("configure-role")
		.description("Configure one factory agent role")
		.argument("<role>", "agent role name")
		.requiredOption("--repository <path>", "target repository")
		.option("--model <model>", "role model")
		.option("--instructions <text>", "role instructions")
		.option("--tools <tools>", "comma-separated tools")
		.option("--allowed-writes <paths>", "comma-separated write paths")
		.option("--harness-support", "enable harness support")
		.action((role: string, rawOptions: unknown) => {
			const options = roleOptionsSchema.parse(rawOptions);
			const changes = {
				...(options.model ? { model: options.model } : {}),
				...(options.instructions ? { instructions: options.instructions } : {}),
				...(options.tools ? { tools: options.tools.split(",") } : {}),
				...(options.allowedWrites
					? { allowedWrites: options.allowedWrites.split(",") }
					: {}),
				...(options.harnessSupport !== undefined
					? { harnessSupport: options.harnessSupport }
					: {}),
			};
			output(
				JSON.stringify(
					new WorkflowPackageInstaller().configureAgentRole(
						role,
						options.repository,
						changes,
					),
					null,
					2,
				),
			);
		});

	program
		.command("configure")
		.description("Read and validate the installed factory package")
		.requiredOption("--repository <path>", "target repository")
		.action((rawOptions: unknown) => {
			const options = packageOptionsSchema.parse(rawOptions);
			output(
				JSON.stringify(
					new WorkflowPackageInstaller().configureWorkflowPackage(
						options.repository,
					),
					null,
					2,
				),
			);
		});

	program
		.command("workflow")
		.description("Execute a registered workflow")
		.argument("<workflowId>", "registered workflow identifier")
		.requiredOption("--repository <path>", "clean source repository")
		.requiredOption("--objective <text>", "bounded change objective")
		.option("--revision <revision>", "expected source revision")
		.option("--workspace-root <path>", "directory for disposable workspaces")
		.action(async (workflowId: string, rawOptions: unknown) => {
			const options = workflowOptionsSchema.parse(rawOptions);
			const activeExecutor =
				executor ?? createDefaultExecutor(options.repository);
			const run = await activeExecutor.executeWorkflow(workflowId, {
				objective: options.objective,
				sourceRepository: options.repository,
				expectedSourceRevision: options.revision,
				workspaceRoot: options.workspaceRoot,
			});
			output(renderWorkflowRun(run));
		});

	program
		.command("trace")
		.description("Inspect a workflow trace in a read-only HTML view")
		.argument("<runIdentifier>", "workflow run identifier")
		.option(
			"--database <path>",
			"SQLite workflow trace database",
			DEFAULT_WORKFLOW_TRACE_DATABASE_PATH,
		)
		.action((runIdentifier: string, rawOptions: unknown) => {
			const options = traceOptionsSchema.parse(rawOptions);
			const trace = new SQLiteWorkflowTraceStore(options.database).get(
				runIdentifier,
			);
			if (!trace) throw new Error(`Workflow trace not found: ${runIdentifier}`);
			output(renderWorkflowTrace(trace));
		});

	program
		.command("greet")
		.description("Print a greeting")
		.argument("[name]", "name to greet")
		.action((name?: string) => {
			const { name: validatedName } = greetingOptionsSchema.parse({ name });
			output(`Hello, ${validatedName}!`);
		});

	return program;
}

if (import.meta.main) {
	await createCli().parseAsync(Bun.argv);
}
