import { Command } from "commander";
import { z } from "zod";
import { WorkflowPackageInstaller } from "./workflow-package.ts";
import { WorkflowExecutor } from "./workflow.ts";

const greetingOptionsSchema = z.object({
	name: z.string().trim().min(1).default("world"),
});

const workflowOptionsSchema = z.object({
	repository: z.string().trim().min(1),
	objective: z.string().trim().min(1),
	revision: z.string().trim().min(1).optional(),
	workspaceRoot: z.string().trim().min(1).optional(),
});

export function createDefaultExecutor(repository: string): WorkflowExecutor {
	return new WorkflowPackageInstaller().createExecutor(repository);
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
