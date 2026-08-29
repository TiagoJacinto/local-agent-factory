import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "vitest";

const sourceDirectory = fileURLToPath(new URL(".", import.meta.url));

test("installs a self-contained Pi workflow runtime", () => {
  const repositoryRoot = resolve(sourceDirectory, "..");
  const target = mkdtempSync(join(tmpdir(), "sssf-install-"));
  execFileSync("bun", [join(repositoryRoot, "src/scripts/build_skill.ts")], {
    cwd: repositoryRoot,
    stdio: "pipe",
  });
  execFileSync("bun", [join(repositoryRoot, "src/scripts/package_skill.ts")], {
    cwd: repositoryRoot,
    stdio: "pipe",
  });
  const archiveEntries = execFileSync("tar", ["-tzf", join(repositoryRoot, "dist/sssf.tar.gz")], {
    encoding: "utf8",
  });
  expect(archiveEntries.split("\n")).toContain(".pi/skills/sssf/");
  const distributionSkills = join(repositoryRoot, "dist/.pi/skills");
  expect(existsSync(join(distributionSkills, "sssf/SKILL.md"))).toBe(true);
  expect(existsSync(join(distributionSkills, "rpi-create-research/SKILL.md"))).toBe(true);
  expect(existsSync(join(distributionSkills, "rpi-create-prd/SKILL.md"))).toBe(true);
  expect(existsSync(join(distributionSkills, "rpi-create-tdd/SKILL.md"))).toBe(true);
  expect(existsSync(join(distributionSkills, "rpi-create-research-questions/SKILL.md"))).toBe(true);
  expect(existsSync(join(distributionSkills, "rpi-problem/SKILL.md"))).toBe(true);
  expect(
    readFileSync(join(distributionSkills, "rpi-create-research/SKILL.md"), "utf8"),
  ).not.toContain("@if target=");
  expect(
    readFileSync(join(distributionSkills, "rpi-create-research/SKILL.md"), "utf8"),
  ).not.toContain("{{problemFolder}}");
  const installer = join(distributionSkills, "sssf/scripts/install.ts");

  execFileSync("bun", [installer, "--version", "v0.3.0"], { cwd: target, stdio: "pipe" });

  const lock = join(target, "adws/adw_sssf_config/sssf.lock.yaml");
  expect(readFileSync(lock, "utf8")).toContain("version: v0.3.0");

  const configPath = join(target, "adws/adw_sssf_config/sssf.config.yaml");
  const config = readFileSync(configPath, "utf8");
  const lines = config.split("\n");
  const agentsStart = lines.indexOf("agents:");
  const agentStarts = lines
    .map((line, index) => ({ line, index }))
    .filter(({ line }) => /^  - name: \S+$/.test(line));
  const legacyNames = new Set([
    "planner",
    "builder",
    "double_tdd",
    "scout",
    "reviewer",
    "documenter",
  ]);
  const legacyBlocks = agentStarts
    .map(({ index }, blockIndex) => {
      const end = agentStarts[blockIndex + 1]?.index ?? lines.length;
      return { name: lines[index].slice("  - name: ".length), block: lines.slice(index, end) };
    })
    .filter(({ name }) => legacyNames.has(name))
    .flatMap(({ block }) => block);
  writeFileSync(
    configPath,
    [...lines.slice(0, agentsStart + 1), ...legacyBlocks, "# local roster customization"].join(
      "\n",
    ),
  );
  execFileSync("bun", [installer, "--update"], { cwd: target, stdio: "pipe" });
  const updatedConfig = readFileSync(configPath, "utf8");
  for (const agent of ["research_questions", "research", "prd", "tdd"]) {
    expect(updatedConfig).toContain(`  - name: ${agent}`);
  }
  expect(updatedConfig).toContain("# local roster customization");

  execFileSync("bun", [installer], { cwd: target, stdio: "pipe" });
  expect(readFileSync(lock, "utf8")).toContain("version: v0.3.0");
  expect(readFileSync(join(target, ".gitignore"), "utf8")).toContain(".pi/skills/sssf/");

  const runner = join(target, "adws/adw_modules/runner.ts");
  expect(existsSync(join(target, "adws/adw_research.ts"))).toBe(true);
  expect(existsSync(join(target, "adws/adw_prd_oriented_design.ts"))).toBe(true);
  expect(existsSync(join(target, "adws/adw_prd_oriented_discovery.ts"))).toBe(true);
  expect(
    existsSync(join(target, "adws/adw_data/workflow_skills/rpi-create-research/SKILL.md")),
  ).toBe(true);
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

  const sessionsOutput = execFileSync("just", ["sessions"], {
    cwd: target,
    encoding: "utf8",
  });
  expect(sessionsOutput).toBe("");

  const tables = execFileSync("sqlite3", [join(target, "adws/adw_data/sssf.db"), ".tables"], {
    cwd: target,
    encoding: "utf8",
  });
  expect(tables).toContain("sessions");
}, 120_000);
