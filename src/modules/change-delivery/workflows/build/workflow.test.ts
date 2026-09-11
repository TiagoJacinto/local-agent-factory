import { describe, expect, test } from "vitest";
import { changeDeliveryWorkflows } from "../..";
import { Factory } from "../../../workflow-execution";

describe("build workflow", () => {
  test("records an explicit human decision for build review", async () => {
    const run = await new Factory(changeDeliveryWorkflows, {
      ai: async ({ input }) => ({ value: { status: "success", input } }),
      workspace: {
        inspect: (repository) => ({ repository, revision: "revision", workingTree: "Clean" }),
        create: (repository, destination, expectedRevision) => ({
          path: destination,
          source: { repository, revision: expectedRevision, workingTree: "Clean" },
          isolation: "IndependentClone" as const,
          retain: () => undefined,
          dispose: () => undefined,
        }),
      },
      humanGate: {
        awaitDecision: async () => ({
          outcome: "Accepted",
          decidedAt: "2026-01-01T00:00:00.000Z",
          decidedBy: "test-reviewer",
        }),
      },
    }).execute({
      workflowId: "build",
      request: "make the change",
      sourceRepository: "/tmp/source",
      expectedSourceRevision: "revision",
    });
    expect(run.integration?.outcome).toBe("Accepted");
    expect(run.status).toBe("Succeeded");
    expect(run.evidenceManifest.artifacts.some((entry) => entry.kind === "review")).toBe(true);
  });
});
