#!/usr/bin/env bun
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const args = process.argv.slice(2);
const value = (name: string) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
};
const name = value("--name");
const rawAgents = value("--agents");
const force = args.includes("--force");
if (!name || !rawAgents) throw new Error("--name and --agents are required");
const agents = rawAgents
  .split(",")
  .map((agent) => agent.trim())
  .filter(Boolean);
if (!agents.length) throw new Error("no agents given");
const destination = join(process.cwd(), "adws", `adw_${name}.ts`);
if (existsSync(destination) && !force)
  throw new Error(`${destination} already exists — use --force to overwrite`);
const phases = agents
  .map(
    (owner, index) => `
    await context.phase({ name: ${JSON.stringify(`${owner}_${index + 1}`)}, kind: "agent", owner: ${JSON.stringify(owner)}, description: ${JSON.stringify(`Runs the ${owner} decision phase and records its output artifact.`)} }, async () => {
      await context.ai(${JSON.stringify(`${name}-${owner}-${index + 1}`)}, context.request ?? "", context.request ?? "", { outputArtifact: ${JSON.stringify(`${owner}-${index + 1}`)}, agentOwner: ${JSON.stringify(owner)} });
    });`,
  )
  .join("\n");
const body = `#!/usr/bin/env bun
import { Factory, type WorkflowDefinition } from "./factory/modules/workflow-execution";
import { ConfiguredAgentRuntime } from "./factory/modules/change-delivery/configured-agent-runtime";
const workflow: WorkflowDefinition = { id: ${JSON.stringify(name)}, capability: "change-delivery", controller: async (context) => {${phases}\n} };
const request = Bun.argv.slice(2).filter((arg) => !arg.startsWith("--")).join(" ");
if (!request) process.exit(2);
const run = await new Factory([workflow], { agentRuntime: new ConfiguredAgentRuntime(process.env.SSSF_CONFIG ?? "adws/adw_sssf_config/sssf.config.yaml") }).execute({ workflowId: ${JSON.stringify(name)}, request });
process.exitCode = run.status === "Succeeded" ? 0 : 1;
`;
mkdirSync(join(destination, ".."), { recursive: true });
writeFileSync(destination, body);
console.log(`wrote ${destination}`);
