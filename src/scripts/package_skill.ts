#!/usr/bin/env bun
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dir, "../..");
const output = join(root, "dist");
const archive = join(output, "sssf.tar.gz");
mkdirSync(output, { recursive: true });

const result = Bun.spawnSync(["tar", "-czf", archive, "-C", join(root, "dist"), ".pi"], {
  cwd: root,
  stdout: "pipe",
  stderr: "pipe",
});
if (!result.success) {
  throw new Error(new TextDecoder().decode(result.stderr) || "tar failed");
}

const digest = createHash("sha256").update(readFileSync(archive)).digest("hex");
writeFileSync(`${archive}.sha256`, `${digest}  sssf.tar.gz\n`);
const version = readFileSync(join(root, "dist/.pi/skills/sssf/VERSION"), "utf8").trim();
console.log(`packaged sssf ${version}: ${archive}`);
