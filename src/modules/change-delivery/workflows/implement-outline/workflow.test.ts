import { describe, expect, test } from "vitest";
import { changeDeliveryWorkflows } from "../..";
import { Factory } from "../../../workflow-execution";

describe("implement-outline workflow", () => {
  test("publishes each outline phase as a stacked pull request after validation", async () => {
    const outlinePath = "/tmp/account-structure-outline.md";
    const outline = [
      "## Phase 1: Add account panel",
      "Validation: `bun test -- panel`",
      "",
      "## Phase 2: Persist preferences",
      "Validation: `bun test -- preferences`",
    ].join("\n");
    const commands: string[] = [];
    const sessions: string[] = [];
    const run = await new Factory(changeDeliveryWorkflows, {
      ai: async ({ invocationId, options }) => {
        sessions.push(`${invocationId}:${options?.sessionPolicy ?? "reuse"}`);
        return { value: { status: "success" } };
      },
      commandRunner: {
        run: async (request) => {
          const raw = request.args?.at(1) ?? "";
          commands.push(raw);
          if (raw.startsWith("cat "))
            return {
              ...request,
              command: "bash",
              args: request.args ?? [],
              exitCode: 0,
              stdout: outline,
              stderr: "",
            };
          if (raw === "git branch --show-current")
            return {
              ...request,
              command: "bash",
              args: request.args ?? [],
              exitCode: 0,
              stdout: "main\n",
              stderr: "",
            };
          if (raw.includes("gh pr view") && raw.includes("comments,reviews"))
            return {
              ...request,
              command: "bash",
              args: request.args ?? [],
              exitCode: 0,
              stdout: '{"comments":[]}',
              stderr: "",
            };
          if (raw.includes("gh pr view") && raw.includes("--json number")) {
            const phase = raw.includes("phase-2") ? 2 : 1;
            return {
              ...request,
              command: "bash",
              args: request.args ?? [],
              exitCode: 0,
              stdout: JSON.stringify({
                number: 100 + phase,
                url: `https://github.com/example/pr/${100 + phase}`,
                headRefName: `rpi/account/phase-${phase}`,
                baseRefName: phase === 1 ? "main" : "rpi/account/phase-1",
              }),
              stderr: "",
            };
          }
          return {
            ...request,
            command: "bash",
            args: request.args ?? [],
            exitCode: 0,
            stdout: "",
            stderr: "",
          };
        },
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
      workflowId: "implement-outline",
      request: outlinePath,
      sourceRepository: "/repo",
      expectedSourceRevision: "revision",
    });
    expect(run.status).toBe("AwaitingReview");
    expect(commands.filter((command) => command.startsWith("git switch -c"))).toEqual([
      "git switch -c rpi/account/phase-1 main",
      "git switch -c rpi/account/phase-2 rpi/account/phase-1",
    ]);
    expect(sessions).toEqual([
      "implement-outline-phase-1:fresh",
      "implement-outline-phase-2:fresh",
    ]);
    expect(commands.filter((command) => command.startsWith("gh pr checks"))).toEqual([
      "gh pr checks 101 --required --watch --interval 10",
      "gh pr checks 102 --required --watch --interval 10",
    ]);
    expect(commands.some((command) => command.includes("git merge"))).toBe(false);
  });
});
