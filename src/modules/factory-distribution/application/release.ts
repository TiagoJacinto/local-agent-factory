#!/usr/bin/env bun
/** Publish the intended factory changes and install the resulting release. */
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";

type Command = (command: string, args: string[], cwd?: string) => string;
export type ReleaseOptions = {
  paths: string[];
  message: string;
  target: string;
  version?: string;
  repo?: string;
  remote: string;
  branch?: string;
  timeoutSeconds: number;
  pollSeconds: number;
};

const runCommand: Command = (command, args, cwd) =>
  execFileSync(command, args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });

function packageVersion(root: string): string {
  const packageJson = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as {
    version?: string;
  };
  if (!packageJson.version) throw new Error("package.json does not contain a version");
  return `v${packageJson.version.replace(/^v/, "")}`;
}

function releaseRunStatus(output: string, tag: string): "success" | "failure" | "pending" {
  const runs = JSON.parse(output) as Array<{
    headBranch?: string;
    status?: string;
    conclusion?: string | null;
  }>;
  const run = runs.find((candidate) => candidate.headBranch === tag);
  if (!run || run.status !== "completed") return "pending";
  return run.conclusion === "success" ? "success" : "failure";
}

export function releaseAndInstall(
  options: ReleaseOptions,
  command: Command = runCommand,
  sleep: (milliseconds: number) => void = (milliseconds) => {
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, milliseconds);
  },
): void {
  const root = resolve(process.cwd());
  if (!existsSync(options.target))
    throw new Error(`target repository does not exist: ${options.target}`);
  if (!options.paths.length) throw new Error("at least one intended path is required");
  const tag = options.version ?? packageVersion(root);
  if (!/^v\d+\.\d+\.\d+$/.test(tag)) throw new Error(`invalid release tag: ${tag}`);
  const branch = options.branch ?? command("git", ["branch", "--show-current"], root).trim();
  if (!branch) throw new Error("current branch is detached; pass --branch");
  const repo =
    options.repo ??
    command("gh", ["repo", "view", "--json", "nameWithOwner", "-q", ".nameWithOwner"], root).trim();
  if (!repo) throw new Error("could not determine GitHub repository");

  command("git", ["add", "--", ...options.paths], root);
  if (!command("git", ["diff", "--cached", "--name-only"], root).trim())
    throw new Error("intended paths produced no staged changes");
  command("git", ["commit", "--only", "-m", options.message, "--", ...options.paths], root);
  command("git", ["push", options.remote, branch], root);
  command("git", ["tag", "-a", tag, "-m", tag], root);
  command("git", ["push", options.remote, tag], root);

  const deadline = Date.now() + options.timeoutSeconds * 1000;
  for (;;) {
    const status = releaseRunStatus(
      command(
        "gh",
        [
          "run",
          "list",
          "--workflow",
          "release.yml",
          "--repo",
          repo,
          "--limit",
          "50",
          "--json",
          "headBranch,status,conclusion",
        ],
        root,
      ),
      tag,
    );
    if (status === "success") break;
    if (status === "failure") throw new Error(`release workflow failed for ${tag}`);
    if (Date.now() >= deadline) throw new Error(`timed out waiting for release workflow ${tag}`);
    sleep(options.pollSeconds * 1000);
  }

  const installerDirectory = mkdtempSync(join(tmpdir(), "sssf-release-"));
  const installer = join(installerDirectory, "install.sh");
  try {
    const installerUrl = `https://raw.githubusercontent.com/${repo}/${tag}/install.sh`;
    writeFileSync(
      installer,
      command("curl", ["--fail", "--location", "--silent", "--show-error", installerUrl], root),
    );
    command("bash", [installer, "--version", tag], options.target);
  } finally {
    rmSync(installerDirectory, { recursive: true, force: true });
  }
}

function value(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

export function parseReleaseOptions(args: string[]): ReleaseOptions {
  const target = value(args, "--target");
  const message = value(args, "--message");
  const paths: string[] = [];
  for (let index = 0; index < args.length; index++) {
    if (args[index] === "--path" && args[index + 1]) paths.push(args[++index]);
  }
  if (!target || !message) throw new Error("--target and --message are required");
  if (!paths.length) throw new Error("at least one --path is required");
  return {
    target: resolve(target),
    message,
    paths,
    version: value(args, "--version"),
    repo: value(args, "--repo"),
    remote: value(args, "--remote") ?? "origin",
    branch: value(args, "--branch"),
    timeoutSeconds: Number(value(args, "--timeout-seconds") ?? 600),
    pollSeconds: Number(value(args, "--poll-seconds") ?? 10),
  };
}

if (import.meta.main) {
  releaseAndInstall(parseReleaseOptions(Bun.argv.slice(2)));
  console.log("release published and installed");
}
