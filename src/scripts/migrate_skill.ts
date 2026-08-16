#!/usr/bin/env bun
/** Copy the static skill package out of the old checked-in tree once. */
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dir, "../..");
const legacy = join(root, ".pi/skills/sssf");
const destination = join(root, "src/skill");
const force = process.argv.includes("--force");

if (!existsSync(legacy)) throw new Error(`Legacy skill tree not found: ${legacy}`);
if (existsSync(destination) && !force) {
  throw new Error(`${destination} already exists; use --force to replace it`);
}
if (force) rmSync(destination, { recursive: true, force: true });
mkdirSync(destination, { recursive: true });

for (const name of ["SKILL.md", "apps", "cookbooks", "references", "scripts", "VERSION"]) {
  const source = join(legacy, name);
  if (existsSync(source)) cpSync(source, join(destination, name), { recursive: true, force: true });
}

// Runtime code is compiled from src/, not copied into the static skill source.
for (const name of ["adws", "harness_engineering", "prompt_engineering"]) {
  const path = join(destination, "templates", name);
  if (existsSync(path)) {
    // Remove runtime copies from the static source; build_skill maps these from src.
    if (name === "adws" || name === "harness_engineering")
      rmSync(path, { recursive: true, force: true });
  }
}
for (const name of ["prompt_engineering", "sssf.config.yaml", "env.sample", "justfile"]) {
  const source = join(legacy, "templates", name);
  if (existsSync(source))
    cpSync(source, join(destination, "templates", name), { recursive: true, force: true });
}

console.log(`migrated static skill sources to ${destination}`);
console.log(`copied ${readdirSync(destination).length} top-level entries`);
