import { describe, expect, test } from "vitest";
import { changeDeliveryWorkflows } from "../..";
import { Factory } from "../../../workflow-execution";

describe("prompt workflow", () => {
  test("executes prompt through the canonical Factory with a deterministic agent", async () => {
    const run = await new Factory(changeDeliveryWorkflows, {
      ai: async ({ input, options }) => ({
        value: { status: "success", input, owner: options?.agentOwner },
      }),
    }).execute({ workflowId: "prompt", request: "capture this", agentOwner: "scout" });
    expect(run.status).toBe("Succeeded");
    expect(run.phases.map((phase) => phase.name)).toEqual(["request", "prompt"]);
    expect(run.invocations.at(-1)?.output).toEqual({
      value: { status: "success", input: "capture this", owner: "scout" },
    });
  });
});
