import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vitest";
import {
  enforce,
  executionEnv,
  PermissionBreach,
  redactSecrets,
  runProcess,
  snapshot,
} from "./modules/workflow-execution/process-runtime";

test("keeps ambient environment variables out of managed processes", async () => {
  const name = "SSSF_ROBUSTNESS_SECRET";
  process.env[name] = "do-not-forward";
  try {
    const result = await runProcess(process.execPath, [
      "-e",
      `process.stdout.write(process.env.${name} || "missing")`,
    ]);
    expect(result.stdout).toBe("missing");
    expect(executionEnv()).not.toHaveProperty(name);
  } finally {
    delete process.env[name];
  }
});

test("restores an unauthorized tracked edit", () => {
  const repo = mkdtempSync(join(tmpdir(), "sssf-permissions-"));
  execFileSync("git", ["init", "--quiet", repo]);
  execFileSync("git", ["-C", repo, "config", "user.email", "test@example.com"]);
  execFileSync("git", ["-C", repo, "config", "user.name", "Test"]);
  writeFileSync(join(repo, "README.md"), "before\n");
  execFileSync("git", ["-C", repo, "add", "README.md"]);
  execFileSync("git", ["-C", repo, "commit", "--quiet", "-m", "initial"]);
  const run = {
    repoRoot: repo,
    cfg: { defaults: { data_dir: "adws/adw_data", protected_files: [] } },
  };
  const before = snapshot(run);
  writeFileSync(join(repo, "README.md"), "unauthorized\n");
  expect(() => enforce(run, before, { name: "reviewer", writes: [] } as any, {})).toThrow(
    PermissionBreach,
  );
  expect(existsSync(join(repo, "README.md"))).toBe(true);
  expect(readFileSync(join(repo, "README.md"), "utf8")).toBe("before\n");
});

test("redacts credential values without redacting workspace paths", () => {
  const key = "SSSF_TEST_API_KEY";
  process.env[key] = "secret-value-123";
  try {
    const output = redactSecrets("/tmp/workspace secret-value-123");
    expect(output).toBe("/tmp/workspace [REDACTED]");
  } finally {
    delete process.env[key];
  }
});

test("terminates timed out processes", async () => {
  const result = await runProcess(process.execPath, ["-e", "setTimeout(() => {}, 5000)"], {
    timeoutMs: 100,
  });
  expect(result.failure).toBe("timeout");
  expect(result.timedOut).toBe(true);
});

test("bounds captured process output", async () => {
  const result = await runProcess(
    process.execPath,
    ["-e", 'process.stdout.write("x".repeat(10000))'],
    { maxOutputBytes: 100 },
  );
  expect(result.truncated).toBe(true);
  expect(result.stdout.length).toBeLessThanOrEqual(100);
});
