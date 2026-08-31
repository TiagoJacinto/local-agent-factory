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
import { compileSkill } from "../../change-delivery/operational/adw_modules/skill_compiler";

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
  copyTree(
    join(sourceRoot, "modules/change-delivery/operational"),
    join(outputRoot, "templates/adws"),
  );
  for (const script of ["make_adw.ts", "make_config.ts"]) {
    copyTree(
      join(sourceRoot, `modules/factory-distribution/application/${script}`),
      join(outputRoot, `scripts/${script}`),
    );
  }
  copyIfExists(
    join(sourceRoot, "modules/factory-distribution/application/install.ts"),
    join(outputRoot, "scripts/install.ts"),
  );
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
    if (path === join(sssfSource, "VERSION")) return false;
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
  const stale = [
    ...staleFiles(sssfSource, outputRoot),
    ...staleFiles(
      join(sourceRoot, "modules/change-delivery/operational"),
      join(outputRoot, "templates/adws"),
    ),
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
