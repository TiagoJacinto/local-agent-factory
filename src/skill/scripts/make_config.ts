#!/usr/bin/env bun
import { existsSync, mkdirSync, copyFileSync } from "node:fs";
import { join, resolve } from "node:path";
const force = process.argv.includes("--force"),
  dest = join(process.cwd(), "adws/adw_sssf_config/sssf.config.yaml"),
  src = resolve(import.meta.dir, "../templates/sssf.config.yaml");
if (existsSync(dest) && !force) {
  console.error(`${dest} already exists — use --force to overwrite`);
  process.exit(1);
}
mkdirSync(join(dest, ".."), { recursive: true });
copyFileSync(src, dest);
console.log(`wrote ${dest}`);
