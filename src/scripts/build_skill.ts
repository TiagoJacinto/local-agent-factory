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

const repositoryRoot = resolve(import.meta.dir, "../..");
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
  copyTree(join(sourceRoot, "adws"), join(outputRoot, "templates/adws"));
  copyIfExists(
    join(sourceRoot, "harness_engineering"),
    join(outputRoot, "templates/harness_engineering"),
  );
  for (const script of ["make_adw.ts", "make_config.ts"]) {
    copyTree(join(sourceRoot, `scripts/${script}`), join(outputRoot, `scripts/${script}`));
  }
  copyIfExists(join(sourceRoot, "scripts/install.ts"), join(outputRoot, "scripts/install.ts"));
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

function staleFiles(source: string, destination: string): string[] {
  return files(source).filter((path) => {
    if (path === join(sssfSource, "VERSION")) return false;
    const output = join(destination, relative(source, path));
    return !existsSync(output) || readFileSync(path).toString() !== readFileSync(output).toString();
  });
}

function check(): void {
  const stale = [
    ...staleFiles(sssfSource, outputRoot),
    ...staleFiles(join(sourceRoot, "adws"), join(outputRoot, "templates/adws")),
    ...additionalSkillNames().flatMap((name) =>
      staleFiles(join(skillsSource, name), join(outputSkillsRoot, name)),
    ),
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
    copyTree(join(skillsSource, name), join(outputSkillsRoot, name));
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
