import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "vitest";

const sourceDirectory = fileURLToPath(new URL(".", import.meta.url));

test("installs a self-contained Pi workflow runtime", () => {
  const repositoryRoot = resolve(sourceDirectory, "..");
  const target = mkdtempSync(join(tmpdir(), "sssf-install-"));
  const installer = join(repositoryRoot, ".pi/skills/sssf/scripts/install.ts");

  execFileSync("bun", [installer, "--version", "v0.2.0"], { cwd: target, stdio: "pipe" });

  const lock = join(target, "adws/adw_sssf_config/sssf.lock.yaml");
  expect(readFileSync(lock, "utf8")).toContain("version: v0.2.0");

  execFileSync("bun", [installer], { cwd: target, stdio: "pipe" });
  expect(readFileSync(lock, "utf8")).toContain("version: v0.2.0");
  expect(readFileSync(join(target, ".gitignore"), "utf8")).toContain(".pi/skills/sssf/");

  const runner = join(target, "adws/adw_modules/runner.ts");
  expect(readFileSync(runner, "utf8")).not.toContain("src/workflow");

  for (const example of [
    "adw_simple_sdlc.ts",
    "adw_plan_build.ts",
    "adw_plan_build_test.ts",
    "adw_plan_build_test_quality.ts",
    "adw_build_test.ts",
  ]) {
    expect(existsSync(join(target, "adws", example))).toBe(false);
  }

  execFileSync("bun", ["build", runner, "--outdir", join(target, "build")], {
    cwd: target,
    stdio: "pipe",
  });
});
