#!/usr/bin/env bun
import {
  readdirSync,
  statSync,
  existsSync,
  readFileSync,
  mkdirSync,
  copyFileSync,
  appendFileSync,
} from "node:fs";
import { join, dirname, resolve } from "node:path";
const templates = resolve(import.meta.dir, "../templates"),
  root = process.cwd(),
  force = process.argv.includes("--force"),
  update = process.argv.includes("--update"),
  stamped: string[] = [],
  skipped: string[] = [],
  updated: string[] = [];
function userOwned(path: string) {
  return (
    path.endsWith("/sssf.config.yaml") ||
    path.endsWith("/.env.sample") ||
    path.endsWith("/justfile") ||
    path.includes("/prompt_engineering/") ||
    path.includes("/harness_engineering/")
  );
}
function stamp(src: string, dest: string) {
  if (statSync(src).isDirectory()) {
    for (const c of readdirSync(src).sort()) stamp(join(src, c), join(dest, c));
    return;
  }
  const overwrite = force || (update && !userOwned(dest));
  const wasExisting = existsSync(dest);
  if (wasExisting && !overwrite) {
    skipped.push(dest);
    return;
  }
  mkdirSync(dirname(dest), { recursive: true });
  copyFileSync(src, dest);
  (wasExisting ? updated : stamped).push(dest);
}
stamp(join(templates, "adws"), join(root, "adws"));
stamp(join(templates, "prompt_engineering"), join(root, "adws/adw_data/prompt_engineering"));
stamp(join(templates, "harness_engineering"), join(root, "adws/adw_data/harness_engineering"));
stamp(join(templates, "sssf.config.yaml"), join(root, "adws/adw_sssf_config/sssf.config.yaml"));
stamp(join(templates, "env.sample"), join(root, ".env.sample"));
stamp(join(templates, "justfile"), join(root, "justfile"));
const gi = join(root, ".gitignore"),
  existing = existsSync(gi) ? readFileSync(gi, "utf8").split("\n") : [],
  need = ["adws/adw_data/sessions/", "adws/adw_data/runs/", "adws/adw_data/sssf.db*", ".env"];
const missing = need.filter((x) => !existing.includes(x));
if (missing) {
  appendFileSync(gi, `\n# sssf runtime\n${missing.join("\n")}\n`);
  stamped.push(`${gi} (+${missing.length} entries)`);
}
console.log(`sssf installed into ${root}\n  stamped: ${stamped.length} file(s)`);
if (updated.length) console.log(`  updated runtime: ${updated.length} file(s)`);
for (const x of stamped) console.log(`    + ${x}`);
if (skipped.length)
  console.log(
    `  skipped (already exist, use --force to overwrite or --update to refresh runtime): ${skipped.length}`,
  );
console.log(
  '\nnext steps:\n  1. cp .env.sample .env\n  2. just demo\n  3. just sessions\n  4. just obs\n\n  no just? bun adws/adw_prompt.ts "say hello" --agent scout',
);
