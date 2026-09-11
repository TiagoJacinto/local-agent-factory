import { describe, expect, test } from "vitest";
import { changeDeliveryWorkflows, getChangeDeliveryWorkflow } from "../..";
import { Factory } from "../../../workflow-execution";

describe("implement workflow", () => {
  test("registers the ordinary TDD implementation workflow", () => {
    expect(getChangeDeliveryWorkflow("implement").id).toBe("implement");
  });

  test("executes ordinary TDD through publication and GitHub Actions follow-up", async () => {
    const commands: string[] = [];
    const testRuns = new Map<string, number>();
    let redStatusCalls = 0;
    const run = await new Factory(changeDeliveryWorkflows, {
      ai: async ({ invocationId, options }) => {
        if (invocationId === "implement-seams")
          return {
            value: {
              status: "success",
              baselineCommand: "bun test focused",
              behaviors: [
                { id: "first", description: "first behavior" },
                { id: "second", description: "second behavior" },
              ],
            },
          };
        if (invocationId === "implement-red-1")
          return {
            value: {
              status: "slice",
              behavior: "first behavior",
              testCommand: "bun test first",
              activeSuiteCommand: "bun test focused",
              expectedFailure: "first behavior failed",
              changedFiles: ["tests/first.test.ts"],
              additionalSeams: [],
            },
          };
        if (invocationId === "implement-red-2")
          return {
            value: {
              status: "slice",
              behavior: "second behavior",
              testCommand: "bun test second",
              activeSuiteCommand: "bun test focused",
              expectedFailure: "second behavior failed",
              changedFiles: ["tests/second.test.ts"],
              additionalSeams: [],
            },
          };
        return { value: { status: "success", owner: options?.agentOwner } };
      },
      commandRunner: {
        run: async (request) => {
          const raw = request.args?.at(1) ?? "";
          commands.push(raw);
          if (raw === "bun test first" || raw === "bun test second") {
            const attempt = (testRuns.get(raw) ?? 0) + 1;
            testRuns.set(raw, attempt);
            if (attempt === 1)
              return {
                ...request,
                args: [...(request.args ?? [])],
                exitCode: 1,
                stdout: "",
                stderr: `${raw.includes("first") ? "first" : "second"} behavior failed`,
              };
          }
          if (raw === "git status --porcelain") {
            redStatusCalls += 1;
            return {
              ...request,
              args: [...(request.args ?? [])],
              exitCode: 0,
              stdout:
                redStatusCalls <= 2
                  ? `?? tests/${redStatusCalls === 1 ? "first" : "second"}.test.ts\n`
                  : "",
              stderr: "",
            };
          }
          if (raw === "git rev-parse HEAD")
            return {
              ...request,
              args: [...(request.args ?? [])],
              exitCode: 0,
              stdout: "revision\n",
              stderr: "",
            };
          if (raw.includes("gh pr view") && raw.includes("--json number"))
            return {
              ...request,
              args: [...(request.args ?? [])],
              exitCode: 0,
              stdout: JSON.stringify({
                number: 42,
                url: "https://github.com/example/pull/42",
                headRefName: "implement/specification",
                baseRefName: "main",
              }),
              stderr: "",
            };
          if (raw.includes("gh pr view") && raw.includes("comments,reviews"))
            return {
              ...request,
              args: [...(request.args ?? [])],
              exitCode: 0,
              stdout: '{"comments":[]}',
              stderr: "",
            };
          return {
            ...request,
            args: [...(request.args ?? [])],
            exitCode: 0,
            stdout: "",
            stderr: "",
          };
        },
      },
      humanGate: {
        awaitDecision: async () => ({
          outcome: "Accepted",
          decidedAt: "2026-01-01T00:00:00.000Z",
          decidedBy: "test-reviewer",
        }),
      },
      workspace: {
        inspect: (repository) => ({
          repository,
          revision: "revision",
          workingTree: "Clean" as const,
        }),
        create: (repository, destination, expectedRevision) => ({
          path: destination,
          source: { repository, revision: expectedRevision, workingTree: "Clean" as const },
          isolation: "IndependentClone" as const,
          retain: () => undefined,
          dispose: () => undefined,
        }),
      },
    }).execute({
      workflowId: "implement",
      request: "docs/adr/0001-change.md",
      sourceRepository: "/repo",
      expectedSourceRevision: "revision",
    });
    expect(run.status).toBe("Succeeded");
    expect(run.phases.map((phase) => phase.name)).toEqual([
      "request",
      "branch",
      "seams",
      "baseline",
      "red_1",
      "green_1",
      "red_2",
      "green_2",
      "review_checkpoint",
      "review",
      "validation",
      "publish",
      "follow_up",
      "integration_review",
    ]);
    expect(commands).toContain('git switch -c "implement/0001-change"');
    expect(commands).toContain("bun test");
    expect(commands).toContain("gh pr checks 42 --required --watch --interval 10");
  });
});
