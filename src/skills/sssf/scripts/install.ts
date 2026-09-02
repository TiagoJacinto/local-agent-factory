#!/usr/bin/env bun
import {
  appendFileSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";

type InstallOptions = {
  force: boolean;
  update: boolean;
  version?: string;
};

const args = process.argv.slice(2);
const valueAfter = (name: string): string | undefined => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
};
const options: InstallOptions = {
  force: args.includes("--force"),
  update: args.includes("--update") || args.includes("--latest"),
  version: valueAfter("--version") ?? process.env.SSSF_VERSION,
};
const skillRoot = resolve(import.meta.dir, "..");
const templates = join(skillRoot, "templates");
const root = process.cwd();
const stamped: string[] = [];
const skipped: string[] = [];
const updated: string[] = [];

function userOwned(path: string): boolean {
  return (
    path.endsWith("/sssf.config.yaml") ||
    path.endsWith("/.env.sample") ||
    path.endsWith("/justfile") ||
    path.includes("/prompt_engineering/")
  );
}

function stamp(source: string, destination: string): void {
  if (statSync(source).isDirectory()) {
    for (const child of readdirSync(source).sort()) {
      stamp(join(source, child), join(destination, child));
    }
    return;
  }
  const overwrite = options.force || (options.update && !userOwned(destination));
  const wasExisting = existsSync(destination);
  if (wasExisting && !overwrite) {
    skipped.push(destination);
    return;
  }
  mkdirSync(dirname(destination), { recursive: true });
  copyFileSync(source, destination);
  (wasExisting ? updated : stamped).push(destination);
}

function agentBlocks(config: string): Map<string, string> {
  const agentsStart = config.indexOf("\nagents:\n");
  if (agentsStart < 0) throw new Error("sssf.config.yaml is missing the agents section");
  const section = config.slice(agentsStart + 1);
  const lines = section.split("\n");
  const blocks = new Map<string, string>();
  let start = -1;
  let name: string | undefined;
  const save = (end: number) => {
    if (name && start >= 0) blocks.set(name, lines.slice(start, end).join("\n"));
  };
  for (let index = 1; index < lines.length; index++) {
    const match = lines[index].match(/^  - name: ([^ #]+)\s*$/);
    if (!match) continue;
    save(index);
    start = index;
    name = match[1];
  }
  save(lines.length);
  return blocks;
}

function removeObsoleteRuntime(): void {
  if (!existsSync(join(root, "adws"))) return;
  for (const entry of readdirSync(join(root, "adws"))) {
    if (!/^adw_.+\.ts$/.test(entry)) continue;
    const path = join(root, "adws", entry);
    rmSync(path);
    updated.push(`${path} (obsolete workflow wrapper removed)`);
  }
  const modules = join(root, "adws/adw_modules");
  if (existsSync(modules)) {
    rmSync(modules, { recursive: true });
    updated.push(`${modules} (obsolete runtime removed)`);
  }
}

function mergeMissingAgents(source: string, destination: string): void {
  if (!options.update || options.force || !existsSync(destination)) return;
  const current = readFileSync(destination, "utf8");
  const sourceBlocks = agentBlocks(readFileSync(source, "utf8"));
  const currentBlocks = agentBlocks(current);
  const missing = [...sourceBlocks.entries()].filter(([name]) => !currentBlocks.has(name));
  if (!missing.length) return;
  const addition = missing.map(([, block]) => block).join("\n\n");
  const merged = current.replace(/\s*$/, "\n\n") + addition + "\n";
  writeFileSync(destination, merged);
  updated.push(`${destination} (+${missing.length} roster agent(s))`);
}

function resolvedVersion(): string {
  if (options.version) return options.version;
  const lockPath = join(root, "adws/adw_sssf_config/sssf.lock.yaml");
  if (!options.update && existsSync(lockPath)) {
    const match = readFileSync(lockPath, "utf8").match(/^  version:\s*(.+)$/m);
    if (match?.[1]) return match[1].trim();
  }
  const versionFile = join(skillRoot, "VERSION");
  if (existsSync(versionFile)) return readFileSync(versionFile, "utf8").trim();
  return "source";
}

function writeLock(version: string): void {
  const lockPath = join(root, "adws/adw_sssf_config/sssf.lock.yaml");
  mkdirSync(dirname(lockPath), { recursive: true });
  const existingLock = existsSync(lockPath) ? readFileSync(lockPath, "utf8") : "";
  const checksum =
    process.env.SSSF_ARCHIVE_SHA256 ??
    (!options.update ? existingLock.match(/^  archive_sha256:\s*(.+)$/m)?.[1] : undefined);
  writeFileSync(
    lockPath,
    `# Managed by sssf install.ts. Change with --update --version <tag>.\n` +
      `skill:\n  version: ${version}\n` +
      (checksum ? `  archive_sha256: ${checksum}\n` : ""),
  );
  stamped.push(lockPath);
}

removeObsoleteRuntime();
stamp(join(templates, "adws"), join(root, "adws"));
stamp(join(templates, "prompt_engineering"), join(root, "adws/adw_data/prompt_engineering"));
stamp(join(templates, "workflow_skills"), join(root, "adws/adw_data/workflow_skills"));
stamp(join(templates, "sssf.config.yaml"), join(root, "adws/adw_sssf_config/sssf.config.yaml"));
mergeMissingAgents(
  join(templates, "sssf.config.yaml"),
  join(root, "adws/adw_sssf_config/sssf.config.yaml"),
);
stamp(join(templates, "env.sample"), join(root, ".env.sample"));
stamp(join(templates, "justfile"), join(root, "justfile"));
writeLock(resolvedVersion());

const gitignore = join(root, ".gitignore");
const existing = existsSync(gitignore) ? readFileSync(gitignore, "utf8").split("\n") : [];
const needed = [
  "adws/adw_data/sessions/",
  "adws/adw_data/runs/",
  "adws/adw_data/sssf.db*",
  ".pi/skills/sssf/",
  ".env",
];
const missing = needed.filter((entry) => !existing.includes(entry));
if (missing.length) {
  appendFileSync(gitignore, `\n# sssf runtime\n${missing.join("\n")}\n`);
  stamped.push(`${gitignore} (+${missing.length} entries)`);
}

console.log(
  `sssf installed into ${root}\n  version: ${resolvedVersion()}\n  stamped: ${stamped.length} file(s)`,
);
if (updated.length) console.log(`  updated runtime: ${updated.length} file(s)`);
for (const path of stamped) console.log(`    + ${path}`);
if (skipped.length) {
  console.log(
    `  skipped (already exist, use --force to overwrite or --update to refresh runtime): ${skipped.length}`,
  );
}
console.log(
  '\nnext steps:\n  1. cp .env.sample .env\n  2. just demo\n  3. just sessions\n  4. just obs\n\n  no just? bun adws/run.ts prompt "say hello" --agent scout',
);
