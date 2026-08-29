import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, test } from "vitest";
import { AgentCall, type Phase, type SSSFConfig } from "./data_types";
import { Run, type RunDependencies, type WorkspaceAdapter } from "./runner";
import { Tracer } from "./tracer";

const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function setup(dependencies: RunDependencies = {}) {
  const root = mkdtempSync(join(tmpdir(), "sssf-runner-test-"));
  roots.push(root);
  const cfg = {
    defaults: {
      data_dir: join(root, "data"),
      run_timeout_seconds: 30,
      harness_timeout_seconds: 1,
      max_output_bytes: 1000,
    },
    observability: { db: join(root, "trace.db"), poll_ms: 1 },
    agents: [],
  } as unknown as SSSFConfig;
  const tracer = new Tracer(cfg.observability.db, join(root, "events.jsonl"));
  return { root, run: new Run(cfg, "test-run", tracer, "test-engineer", dependencies) };
}

function fakeWorkspace(root: string, calls: string[]): WorkspaceAdapter {
  return {
    isRepository: () => true,
    inspectSource: () => ({ revision: "revision-1", workingTree: "Clean" }),
    cloneRepository: (_source, destination) => {
      calls.push(`clone:${destination}`);
      return destination;
    },
    copyRepository: (_source, destination) => calls.push(`copy:${destination}`),
  };
}

const agentResult = { status: "success" as const, summary: "ok" };

async function callAgent(_run: Run, _phase: Phase, call: AgentCall) {
  return { ...agentResult, notes_for_next_agent: call.prompt };
}

describe("Run execution", () => {
  test("runs phases in order and records final success", async () => {
    const { run } = setup({ executeAgentCall: callAgent });
    const order: string[] = [];

    await run.phase(
      { name: "first", kind: "agent", owner: "fake", description: "Records the first phase." },
      async (phase) => {
        order.push("first");
        await phase.call(new AgentCall("GenericOutput", "first"));
      },
    );
    await run.phase(
      { name: "second", kind: "code", owner: "engineer", description: "Records the second phase." },
      () => order.push("second"),
    );

    expect(order).toEqual(["first", "second"]);
    expect(run.phases.map((phase) => phase.status)).toEqual(["success", "success"]);
    expect(run.finish()).toBe(0);
  });

  test("records failure and final status when a phase throws", async () => {
    const { run } = setup();

    await expect(
      run.phase(
        { name: "broken", kind: "code", owner: "engineer", description: "Rejects the phase." },
        () => {
          throw new Error("expected failure");
        },
      ),
    ).rejects.toThrow("expected failure");

    expect(run.phases[0]).toMatchObject({ status: "fail", error: "expected failure" });
    expect(run.finish()).toBe(1);
    expect(readFileSync(join(run.runEvidenceDir, "result.json"), "utf8")).toContain('"status": "fail"');
  });

  test("uses deterministic workspace and agent seams while retaining evidence", async () => {
    const calls: string[] = [];
    const root = mkdtempSync(join(tmpdir(), "sssf-source-test-"));
    roots.push(root);
    const { run } = setup({
      sourceRoot: root,
      workspaceRoot: join(root, "workspaces"),
      workspaceAdapter: fakeWorkspace(root, calls),
      executeAgentCall: callAgent,
    });

    run.prepareWorkspace();
    await run.phase(
      { name: "invoke", kind: "agent", owner: "fake", description: "Persists an invocation." },
      (phase) => phase.call(new AgentCall("GenericOutput", "artifact")),
    );

    expect(calls).toEqual([`clone:${join(root, "workspaces", "test-run")}`]);
    expect(run.repoRoot).toBe(join(root, "workspaces", "test-run"));
    expect(readFileSync(join(run.runEvidenceDir, "workspace.txt"), "utf8")).toBe(
      `${join(root, "workspaces", "test-run")}\n`,
    );
    expect(run.finish()).toBe(0);
  });
});
