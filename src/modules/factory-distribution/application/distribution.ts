import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
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

function packagedSkillRoot(): string {
  return join(packageRoot(), "dist", ".pi", "skills", "sssf");
}

function sourceSkillRoot(): string {
  return join(packageRoot(), "src", "skills", "sssf");
}

function stageSourceSkill(destination: string): void {
  const source = sourceSkillRoot();
  copyTree(source, destination);
  rmSync(join(destination, "apps/visualizer/node_modules"), { recursive: true, force: true });

  // build_skill.ts normally creates this generated runtime. Recreate its
  // source-to-package mapping here so `laf install` also works from a checkout
  // and from a package that was built without the archive step.
  const runtimeRoot = join(destination, "templates", "adws");
  const modulesRoot = join(runtimeRoot, "factory", "modules");
  copyTree(
    join(packageRoot(), "src/modules/workflow-execution"),
    join(modulesRoot, "workflow-execution"),
  );
  copyTree(
    join(packageRoot(), "src/modules/change-delivery"),
    join(modulesRoot, "change-delivery"),
  );
  copyTree(
    join(packageRoot(), "src/modules/factory-distribution/application/skill-compilation"),
    join(modulesRoot, "factory-distribution/application/skill-compilation"),
  );
  copyTree(
    join(packageRoot(), "src/modules/factory-distribution/skill-compilation.ts"),
    join(modulesRoot, "factory-distribution/skill-compilation.ts"),
  );
  const runSource = join(packageRoot(), "src/entrypoints/workflows/run.ts");
  const runTarget = join(runtimeRoot, "run.ts");
  mkdirSync(dirname(runTarget), { recursive: true });
  writeFileSync(
    runTarget,
    readFileSync(runSource, "utf8").replaceAll('"../../modules/', '"./factory/modules/'),
  );
  for (const entry of readdirSync(join(packageRoot(), "src/skills"), { withFileTypes: true })) {
    if (entry.isDirectory() && entry.name !== "sssf") {
      copyTree(
        join(packageRoot(), "src/skills", entry.name),
        join(destination, "templates/workflow_skills", entry.name),
      );
    }
  }
  for (const script of ["install.ts", "make_config.ts", "release.ts"]) {
    copyTree(
      join(packageRoot(), `src/modules/factory-distribution/application/${script}`),
      join(destination, "scripts", script),
    );
  }
}

function skillPackageRoot(): string {
  return existsSync(packagedSkillRoot()) ? packagedSkillRoot() : sourceSkillRoot();
}

export function installFactory(options: { cwd?: string } = {}): string {
  const target = resolve(options.cwd ?? process.cwd());
  const destination = join(target, ".pi", "skills", "sssf");
  if (skillPackageRoot() === sourceSkillRoot()) stageSourceSkill(destination);
  else copyTree(skillPackageRoot(), destination);
  const result = Bun.spawnSync(["bun", join(destination, "scripts/install.ts")], {
    cwd: target,
    stdout: "pipe",
    stderr: "pipe",
  });
  if (!result.success) {
    throw new Error(new TextDecoder().decode(result.stderr) || "factory installation failed");
  }
  return new TextDecoder().decode(result.stdout);
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
