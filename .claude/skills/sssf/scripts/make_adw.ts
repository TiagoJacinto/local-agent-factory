#!/usr/bin/env bun
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
const a = process.argv.slice(2);
const get = (k: string) => {
  const i = a.indexOf(k);
  return i >= 0 ? a[i + 1] : undefined;
};
const name = get("--name"),
  raw = get("--agents"),
  force = a.includes("--force");
if (!name || !raw) {
  console.error("--name and --agents are required");
  process.exit(1);
}
const agents = raw
  .split(",")
  .map((x) => x.trim())
  .filter(Boolean);
if (!agents.length) {
  console.error("no agents given");
  process.exit(1);
}
const types: any = {
  planner: "PlanOutput",
  builder: "BuildOutput",
  scout: "ScoutOutput",
  reviewer: "ReviewOutput",
  documenter: "DocumentOutput",
};
const seen: any = {};
const phases = agents
  .map((agent) => {
    seen[agent] = (seen[agent] || 0) + 1;
    const n = seen[agent] === 1 ? agent : `${agent}_${seen[agent]}`;
    return `  await run.phase({name:"${n}",kind:"agent",owner:"${agent}",description:"Run ${agent} over the request and hand its envelope on"},async ph => previous = await ph.call(new AgentCall("${types[agent] || "GenericOutput"}", prompt, previous, [gates.artifactsExist])));`;
  })
  .join("\n");
const body = `#!/usr/bin/env bun\nimport { agents, gates, session } from "./adw_modules";\nimport { AgentCall } from "./adw_modules/data_types";\nimport { args } from "./adw_modules/cli";\nconst x=args(); const cfg=agents.loadConfig(String(x.options.config||"adws/adw_sssf_config/sssf.config.yaml")); agents.validate(cfg, ${JSON.stringify([...new Set(agents)])}); const run=session.ensure(cfg,x.options["adw-id"] as string); let previous:any;\nawait run.phase({name:"request",kind:"engineer",owner:run.engineer,description:"Capture the incoming ask"},ph=>ph.log({input:x.positional[0]}));\n${phases}\nprocess.exitCode=run.finish();\n`;
const dest = join(process.cwd(), "adws", `adw_${name}.ts`);
if (existsSync(dest) && !force) {
  console.error(`${dest} already exists — use --force to overwrite`);
  process.exit(1);
}
mkdirSync(join(dest, ".."), { recursive: true });
writeFileSync(dest, body);
console.log(`wrote ${dest}`);
