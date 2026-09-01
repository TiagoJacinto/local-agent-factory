#!/usr/bin/env bun
/** Build the distributable project-skill tree from repository sources. */
import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { compileSkill } from "./skill-compilation";

const repositoryRoot = resolve(import.meta.dir, "../../../..");
const sourceRoot = join(repositoryRoot, "src");
const skillsSource = join(sourceRoot, "skills");
const sssfSource = join(skillsSource, "sssf");
const outputSkillsRoot = join(repositoryRoot, "dist/.pi/skills");
const outputRoot = join(outputSkillsRoot, "sssf");
const checkOnly = process.argv.includes("--check");
const keepOutput = process.argv.includes("--keep-output");

function copyTree(from: string, to: string): void {
  if (!existsSync(from)) throw new Error(`Missing source: ${from}`);
  mkdirSync(dirname(to), { recursive: true });
  cpSync(from, to, { recursive: true, force: true });
}

function removeGeneratedSkills(): void {
  if (!existsSync(outputSkillsRoot)) return;
  for (const entry of readdirSync(outputSkillsRoot, { withFileTypes: true })) {
    if (entry.name !== ".gitkeep")
      rmSync(join(outputSkillsRoot, entry.name), { recursive: true, force: true });
  }
}

function additionalSkillNames(): string[] {
  if (!existsSync(skillsSource)) throw new Error(`Missing skills source: ${skillsSource}`);
  return readdirSync(skillsSource, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name !== "sssf")
    .map((entry) => entry.name)
    .sort();
}

function copyRuntime(): void {
  const runtimeRoot = join(outputRoot, "templates/adws");
  const canonicalRuntimeRoot = join(runtimeRoot, "factory/modules");
  copyTree(
    join(sourceRoot, "modules/workflow-execution"),
    join(canonicalRuntimeRoot, "workflow-execution"),
  );
  copyTree(
    join(sourceRoot, "modules/change-delivery"),
    join(canonicalRuntimeRoot, "change-delivery"),
  );
  copyTree(
    join(sourceRoot, "modules/factory-distribution/application/skill-compilation"),
    join(canonicalRuntimeRoot, "factory-distribution/application/skill-compilation"),
  );
  copyTree(
    join(sourceRoot, "modules/factory-distribution/skill-compilation.ts"),
    join(canonicalRuntimeRoot, "factory-distribution/skill-compilation.ts"),
  );
  writeFileSync(
    join(runtimeRoot, "run.ts"),
    readFileSync(join(sourceRoot, "entrypoints/workflows/run.ts"), "utf8").replaceAll(
      '"../../modules/',
      '"./factory/modules/',
    ),
  );
  const workflowEntrypoints = [
    "prompt",
    "scout",
    "plan",
    "prewalk",
    "build",
    "quality",
    "build-review",
    "double-tdd",
    "document",
    "research",
    "prd-oriented-design",
    "prd-oriented-discovery",
  ] as const;
  for (const id of workflowEntrypoints) {
    const filename = id.replaceAll("-", "_");
    writeFileSync(
      join(runtimeRoot, `adw_${filename}.ts`),
      `#!/usr/bin/env bun\nimport { runWorkflowCli } from "./run";\nprocess.exitCode = await runWorkflowCli("${id}", Bun.argv.slice(2));\n`,
    );
  }
  for (const script of ["make_adw.ts", "make_config.ts"]) {
    copyTree(
      join(sourceRoot, `modules/factory-distribution/application/${script}`),
      join(outputRoot, `scripts/${script}`),
    );
  }
  for (const script of ["install.ts", "release.ts"]) {
    copyIfExists(
      join(sourceRoot, `modules/factory-distribution/application/${script}`),
      join(outputRoot, `scripts/${script}`),
    );
  }
}

function copyIfExists(from: string, to: string): void {
  if (existsSync(from)) copyTree(from, to);
}

function files(root: string, result: string[] = []): string[] {
  if (!existsSync(root)) return result;
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) files(path, result);
    else result.push(path);
  }
  return result.sort();
}

function staleFiles(source: string, destination: string, projectSkill = false): string[] {
  return files(source).filter((path) => {
    if (
      path === join(sssfSource, "VERSION") ||
      path.endsWith("/scripts/make_adw.ts") ||
      path.endsWith("/scripts/make_config.ts")
    )
      return false;
    const output = join(destination, relative(source, path));
    const sourceText = readFileSync(path, "utf8");
    const expected =
      projectSkill && path.endsWith("/SKILL.md")
        ? compileSkill(sourceText, { target: "project" })
        : sourceText;
    return !existsSync(output) || expected !== readFileSync(output, "utf8");
  });
}

function check(): void {
  const runtimeRoot = join(outputRoot, "templates/adws");
  const canonicalRoot = join(runtimeRoot, "factory/modules");
  const workflowEntrypoints = [
    "prompt",
    "scout",
    "plan",
    "prewalk",
    "build",
    "quality",
    "build-review",
    "double-tdd",
    "document",
    "research",
    "prd-oriented-design",
    "prd-oriented-discovery",
  ] as const;
  const expectedRun = readFileSync(
    join(sourceRoot, "entrypoints/workflows/run.ts"),
    "utf8",
  ).replaceAll('"../../modules/', '"./factory/modules/');
  const staleWrappers = workflowEntrypoints.flatMap((id) => {
    const filename = id.replaceAll("-", "_");
    const path = join(runtimeRoot, `adw_${filename}.ts`);
    const expected = `#!/usr/bin/env bun\nimport { runWorkflowCli } from "./run";\nprocess.exitCode = await runWorkflowCli("${id}", Bun.argv.slice(2));\n`;
    return existsSync(path) && readFileSync(path, "utf8") === expected ? [] : [path];
  });
  const expectedWrapperNames = new Set(
    workflowEntrypoints.map((id) => `adw_${id.replaceAll("-", "_")}.ts`),
  );
  const extraWrappers = files(runtimeRoot).filter(
    (path) =>
      path.startsWith(`${runtimeRoot}/adw_`) &&
      path.endsWith(".ts") &&
      !expectedWrapperNames.has(path.slice(runtimeRoot.length + 1)),
  );
  const stale = [
    ...extraWrappers,
    ...staleFiles(
      join(sourceRoot, "modules/workflow-execution"),
      join(canonicalRoot, "workflow-execution"),
    ),
    ...staleFiles(
      join(sourceRoot, "modules/change-delivery"),
      join(canonicalRoot, "change-delivery"),
    ),
    ...staleFiles(
      join(sourceRoot, "modules/factory-distribution/application/skill-compilation"),
      join(canonicalRoot, "factory-distribution/application/skill-compilation"),
    ),
    ...(existsSync(join(canonicalRoot, "factory-distribution/skill-compilation.ts")) &&
    readFileSync(join(canonicalRoot, "factory-distribution/skill-compilation.ts"), "utf8") ===
      readFileSync(join(sourceRoot, "modules/factory-distribution/skill-compilation.ts"), "utf8")
      ? []
      : [join(canonicalRoot, "factory-distribution/skill-compilation.ts")]),
    ...(readFileSync(join(runtimeRoot, "run.ts"), "utf8") === expectedRun
      ? []
      : [join(runtimeRoot, "run.ts")]),
    ...staleWrappers,
    ...staleFiles(sssfSource, outputRoot),
    ...additionalSkillNames().flatMap((name) => [
      ...staleFiles(join(skillsSource, name), join(outputSkillsRoot, name), true),
      ...staleFiles(join(skillsSource, name), join(outputRoot, "templates/workflow_skills", name)),
    ]),
  ];
  if (stale.length) {
    throw new Error(
      `Generated skills are stale (${stale.length} file(s)); run bun run build:skill`,
    );
  }
}

if (checkOnly) {
  check();
  console.log("skill output is current");
} else {
  mkdirSync(outputSkillsRoot, { recursive: true });
  if (!keepOutput) removeGeneratedSkills();
  copyTree(sssfSource, outputRoot);
  copyRuntime();
  for (const name of additionalSkillNames()) {
    const source = join(skillsSource, name);
    const projectDestination = join(outputSkillsRoot, name);
    copyTree(source, projectDestination);
    writeFileSync(
      join(projectDestination, "SKILL.md"),
      compileSkill(readFileSync(join(source, "SKILL.md"), "utf8"), { target: "project" }),
    );
    copyTree(source, join(outputRoot, "templates/workflow_skills", name));
  }
  let version = "0.0.0";
  try {
    const packageJson = JSON.parse(readFileSync(join(repositoryRoot, "package.json"), "utf8")) as {
      version?: string;
    };
    version = packageJson.version ?? version;
  } catch (error) {
    throw new Error(`Cannot read package version: ${String(error)}`);
  }
  const releaseVersion = version.startsWith("v") ? version : `v${version}`;
  writeFileSync(join(outputRoot, "VERSION"), `${releaseVersion}\n`);
  writeFileSync(join(outputRoot, ".build-source"), "Generated from src/skills and src/.\n");
  console.log(`built ${outputSkillsRoot}`);
}
