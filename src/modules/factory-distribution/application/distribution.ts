import { cpSync, existsSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { formatResolvedConfig, initializeConfig, resolveConfig } from "./configuration";

export type InstallationScope = "local" | "global";
export type SkillName = "mock-reviewer" | "mock-researcher";

export const INSTALLABLE_SKILLS: readonly SkillName[] = ["mock-reviewer", "mock-researcher"];

function copyTree(source: string, destination: string): void {
  if (!existsSync(source)) throw new Error(`package asset not found: ${source}`);
  mkdirSync(dirname(destination), { recursive: true });
  cpSync(source, destination, { recursive: true, force: true });
}

function packageRoot(): string {
  // The source tree is deliberately supported for local development. Published
  // packages retain the same source layout so Bun can execute the entrypoint.
  return fileURLToPath(new URL("../../../..", import.meta.url));
}

export function listWorkflows(workflows: readonly { id: string }[]): string {
  return workflows.map(({ id }) => id).join("\n");
}

export function installSkill(
  name: string,
  scope: InstallationScope,
  options: { cwd?: string; home?: string; xdgConfigHome?: string } = {},
): string {
  if (!INSTALLABLE_SKILLS.includes(name as SkillName)) {
    throw new Error(`unknown skill "${name}". Available skills: ${INSTALLABLE_SKILLS.join(", ")}`);
  }
  const source = join(packageRoot(), "src", "skills", name);
  const home = options.home ?? process.env.HOME;
  const destinationRoot =
    scope === "global"
      ? join(home ?? homedir(), ".pi", "skills")
      : join(resolve(options.cwd ?? process.cwd()), ".pi", "skills");
  const destination = join(destinationRoot, name);
  copyTree(source, destination);
  return destination;
}

export function initFactoryConfig(
  scope: InstallationScope,
  options: { cwd?: string; home?: string; xdgConfigHome?: string; force?: boolean } = {},
): string {
  return initializeConfig(scope, options);
}

export function showFactoryConfig(
  options: { cwd?: string; home?: string; xdgConfigHome?: string } = {},
): string {
  return formatResolvedConfig(resolveConfig(options));
}

export {
  configPaths,
  formatResolvedConfig,
  initializeConfig,
  resolveConfig,
} from "./configuration";

export function visualizerServerPath(): string {
  const candidates = [
    process.env.LAF_VISUALIZER_SERVER,
    join(packageRoot(), "src/skills/sssf/apps/visualizer/server/index.ts"),
    join(packageRoot(), "dist/apps/visualizer/server/index.ts"),
  ].filter((value): value is string => Boolean(value));
  const path = candidates.find((candidate) => existsSync(candidate));
  if (!path) throw new Error("packaged visualizer server is unavailable");
  return path;
}

export function runVisualizer(
  options: {
    cwd?: string;
    port?: number;
    database?: string;
  } = {},
): Bun.Subprocess {
  const cwd = resolve(options.cwd ?? process.cwd());
  const config = resolveConfig({ cwd });
  const port = options.port ?? config.value.apps.visualizer.port;
  const database = options.database ?? config.value.workflow.database;
  const databasePath = resolve(cwd, database);
  return Bun.spawn(["bun", visualizerServerPath()], {
    cwd,
    env: { ...process.env, PORT: String(port), SSSF_DB: databasePath },
    stdout: "inherit",
    stderr: "inherit",
  });
}
