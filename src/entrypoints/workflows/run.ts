import { Factory } from "../../modules/workflow-execution";
import { changeDeliveryWorkflows } from "../../modules/change-delivery";
import { ConfiguredAgentRuntime } from "../../modules/change-delivery/configured-agent-runtime";
import { resolveConfig } from "../../modules/factory-distribution/configuration";
import { SqliteTraceSink } from "../../modules/workflow-execution/trace-runtime";

/** Executes a registered workflow from installed-style command arguments. */
export async function runWorkflowCli(
  workflowId: string,
  argv: readonly string[],
  output: (message: string) => void = console.log,
): Promise<number> {
  const args = [...argv];
  const option = (name: string) => {
    const index = args.indexOf(name);
    return index >= 0 ? args[index + 1] : undefined;
  };
  const optionsWithValues = new Set([
    "--agent",
    "--revision",
    "--problem-folder",
    "--config",
    "--adw-id",
  ]);
  const request = args
    .filter((arg, index) => !arg.startsWith("--") && !optionsWithValues.has(args[index - 1] ?? ""))
    .join(" ");
  const workflow = changeDeliveryWorkflows.find((candidate) => candidate.id === workflowId);
  if (!workflow || !request) return 2;
  const config = resolveConfig();
  const run = await new Factory(changeDeliveryWorkflows, {
    agentRuntime: new ConfiguredAgentRuntime(
      option("--config") ?? process.env.SSSF_CONFIG ?? config.value.workflow.config,
    ),
    traceSink: new SqliteTraceSink(process.env.SSSF_DB ?? config.value.workflow.database),
  }).execute({
    workflowId,
    request,
    agentOwner: option("--agent") ?? (workflowId === "prompt" ? "scout" : undefined),
    problemFolder: option("--problem-folder"),
    ...(option("--revision") ? { expectedSourceRevision: option("--revision") } : {}),
    ...(workflow.changesSource ? { sourceRepository: process.cwd() } : {}),
  });
  if (run.status !== "Succeeded") {
    console.error(run.failure ?? `${workflowId} failed`);
    return 1;
  }
  output(run.runIdentifier);
  return 0;
}

if (import.meta.main) {
  const workflowId = Bun.argv[2];
  if (!workflowId) process.exit(2);
  process.exitCode = await runWorkflowCli(workflowId, Bun.argv.slice(3));
}
