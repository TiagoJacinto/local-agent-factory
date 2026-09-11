import { describe, expect, test } from "vitest";
import { changeDeliveryWorkflows } from "../..";
import { Factory } from "../../../workflow-execution";

describe("prd-oriented-discovery workflow", () => {
  test("executes the RPI discovery graph with typed artifact handoffs", async () => {
    const run = await new Factory(changeDeliveryWorkflows, {
      ai: async ({ options }) => ({ value: { status: "success", owner: options?.agentOwner } }),
    }).execute({
      workflowId: "prd-oriented-discovery",
      request: "design authentication",
      problemFolder: ".rpi/problems/auth",
    });
    expect(run.status).toBe("Succeeded");
    expect(run.phases.map((phase) => phase.name)).toEqual([
      "request",
      "research_questions",
      "research",
      "prd",
      "tdd",
    ]);
    expect([...run.context.artifacts.keys()]).toEqual([
      "research-questions",
      "research",
      "prd",
      "tdd",
    ]);
    expect(
      run.invocations.filter((invocation) => invocation.primitiveType === "Gate"),
    ).toHaveLength(4);
    expect(
      run.invocations
        .filter((invocation) => invocation.primitiveType === "AI")
        .map((invocation) => invocation.output),
    ).toContainEqual({
      value: { status: "success", owner: "research_questions" },
    });
  });
});
