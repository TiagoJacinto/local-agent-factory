#!/usr/bin/env bun
/**
 * Build the distributable Pi skill from repository sources.
 *
 * `src/skill` is the long-term source for static skill files. Runtime files
 * remain under `src/adws` and `src/harness_engineering` because they are also
 * compiled and tested as part of this repository. The legacy skill tree is
 * used only as a migration fallback until its static files have moved.
 */
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
const skillSource = join(sourceRoot, "skill");
const legacySkill = join(repositoryRoot, ".pi/skills/sssf");
const outputRoot = join(repositoryRoot, ".pi/skills/sssf");
const checkOnly = process.argv.includes("--check");
const keepOutput = process.argv.includes("--keep-output");

const hasMigratedSkillSource =
  existsSync(join(skillSource, "SKILL.md")) &&
  existsSync(join(skillSource, "cookbooks")) &&
  existsSync(join(skillSource, "references")) &&
  existsSync(join(skillSource, "templates"));

function copyTree(from: string, to: string): void {
  if (!existsSync(from)) throw new Error(`Missing skill source: ${from}`);
  mkdirSync(dirname(to), { recursive: true });
  cpSync(from, to, { recursive: true, force: true });
}

function copyIfExists(from: string, to: string): void {
  if (existsSync(from)) copyTree(from, to);
}

function removeGeneratedFiles(): void {
  for (const file of readdirSync(outputRoot, { withFileTypes: true })) {
    if (file.name === ".gitkeep") continue;
    rmSync(join(outputRoot, file.name), { recursive: true, force: true });
  }
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

function copySkillContents(): void {
  if (!hasMigratedSkillSource && !existsSync(legacySkill)) {
    throw new Error("Skill static sources are missing; run bun run migrate:skill -- --force");
  }
  const roots = hasMigratedSkillSource
    ? [legacySkill, skillSource].filter((root) => existsSync(root))
    : [];
  for (const root of roots) {
    for (const entry of readdirSync(root, { withFileTypes: true })) {
      if (entry.name === "templates" || entry.name === "scripts") continue;
      copyTree(join(root, entry.name), join(outputRoot, entry.name));
    }
    for (const file of ["prompt_engineering", "sssf.config.yaml", "env.sample", "justfile"]) {
      copyIfExists(join(root, `templates/${file}`), join(outputRoot, `templates/${file}`));
    }
    for (const file of ["install.ts", "make_adw.ts", "make_config.ts"]) {
      copyIfExists(join(root, `scripts/${file}`), join(outputRoot, `scripts/${file}`));
    }
  }
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
    if (path === join(skillSource, "VERSION")) return false;
    const output = join(destination, relative(source, path));
    return !existsSync(output) || readFileSync(path).toString() !== readFileSync(output).toString();
  });
}

function check(): void {
  const stale = [
    ...staleFiles(join(sourceRoot, "adws"), join(outputRoot, "templates/adws")),
    ...(hasMigratedSkillSource ? staleFiles(skillSource, outputRoot) : []),
  ];
  if (stale.length) {
    throw new Error(`Generated skill is stale (${stale.length} file(s)); run bun run build:skill`);
  }
}

if (checkOnly) {
  check();
  console.log("skill output is current");
} else {
  if (!keepOutput && hasMigratedSkillSource) {
    mkdirSync(outputRoot, { recursive: true });
    removeGeneratedFiles();
  }
  copySkillContents();
  copyRuntime();
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
  writeFileSync(
    join(outputRoot, ".build-source"),
    `${hasMigratedSkillSource ? "Generated from src/skill and src/" : "Generated from the migration fallback and src/"}\n`,
  );
  console.log(`built ${outputRoot}`);
}
