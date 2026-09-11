import { describe, expect, test } from "vitest";
import { changeDeliveryWorkflows } from "../..";
import { Factory } from "../../../workflow-execution";

describe("research workflow", () => {
  test("rejects RPI execution without a problem folder", async () => {
    const run = await new Factory(changeDeliveryWorkflows, {
      ai: async () => ({ value: "unused" }),
    }).execute({
      workflowId: "research",
      request: "investigate this",
    });
    expect(run.status).toBe("Failed");
    expect(run.failure).toContain("--problem-folder is required");
  });
});
