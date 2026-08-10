import { mkdirSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { commandString, nowIso, operatorEnv } from "./utils";
import { QualityResult, QualityCheckResult, VerifyOutput } from "./data_types";
const placeholder = (name: string) => [
  "echo",
  `PLACEHOLDER ${name}: edit adws/adw_modules/quality.ts and replace this echo with the real ${name} command`,
];
function runOne(s: any, run: any): QualityCheckResult {
  const phase = run.phases.at(-1),
    dir = `${run.contextHandoffDir}/quality/${String(phase.seq).padStart(2, "0")}_${s.name}`;
  mkdirSync(dir, { recursive: true });
  const started = Date.now(),
    r = spawnSync(s.argv[0], s.argv.slice(1), {
      cwd: run.repoRoot,
      env: operatorEnv(),
      encoding: "utf8",
      timeout: (s.timeoutSeconds || 120) * 1000,
    }),
    code = r.error?.code === "ETIMEDOUT" ? 124 : r.error?.code ? 127 : (r.status ?? 127),
    out = String(r.stdout || ""),
    err = String(r.stderr || ""),
    path = `${dir}/command.log`;
  writeFileSync(
    path,
    `$ ${commandString(s.argv)}\nexit: ${code}\nduration_seconds: ${((Date.now() - started) / 1000).toFixed(3)}\n\n--- stdout ---\n${out}\n--- stderr ---\n${err}\n`,
  );
  const passed = code === 0;
  run.tracer.event({
    adw_id: run.adwId,
    phase_id: phase.phaseId,
    type: "tool_call",
    name: `quality:${s.name}`,
    payload: {
      area: s.area,
      operation: s.operation,
      command: commandString(s.argv),
      returncode: code,
      passed,
      output_artifact: path,
    },
    started_at: nowIso(),
    ended_at: nowIso(),
  });
  run.console.note(
    `quality ${s.name}: ${passed ? "passed" : "failed"} (exit ${code}, ${((Date.now() - started) / 1000).toFixed(1)}s)`,
  );
  return {
    name: s.name,
    area: s.area,
    operation: s.operation,
    command: commandString(s.argv),
    returncode: code,
    passed,
    duration_seconds: (Date.now() - started) / 1000,
    output_artifact: path,
    output_tail: (out + err).slice(-4000),
  };
}
const spec = (name: string, operation: string, timeoutSeconds = 120) => ({
  name,
  area: "backend",
  operation,
  argv: placeholder(name),
  timeoutSeconds,
});
export const test = (run: any) => runOne(spec("test", "build", 600), run);
export const lint = (run: any) => runOne(spec("lint", "lint"), run);
export const typecheck = (run: any) => runOne(spec("typecheck", "typecheck"), run);
export const build = (run: any) => runOne(spec("build", "build"), run);
function result(checks: QualityCheckResult[]): QualityResult {
  const failures = checks
    .filter((x) => !x.passed)
    .map((x) =>
      `${x.name}: \`${x.command}\` exited ${x.returncode}\n${x.output_tail || ""}`.trim(),
    );
  return {
    passed: !failures.length,
    checks,
    failures,
    artifacts: checks.map((x) => x.output_artifact),
  };
}
export function runTests(run: any) {
  return result([test(run)]);
}
export function runQuality(run: any) {
  return result([test(run), lint(run), typecheck(run), build(run)]);
}
export function asEnvelope(q: QualityResult, what = "quality"): VerifyOutput {
  return {
    status: q.passed ? "success" : "fail",
    summary: q.passed
      ? `${what}: all ${q.checks.length} check(s) passed`
      : `${what}: ${q.failures.length} of ${q.checks.length} check(s) failed`,
    artifacts: q.artifacts,
    notes_for_next_agent: q.passed
      ? ""
      : "Fix every failure below. The output is verbatim from the command — trust it over any summary.",
    passed: q.passed,
    failures: q.failures,
  };
}
