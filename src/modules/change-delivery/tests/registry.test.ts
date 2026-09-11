import { describe, expect, test } from "vitest";
import { changeDeliveryWorkflows, getChangeDeliveryWorkflow } from "..";

const expectedIds = [
  "prompt",
  "scout",
  "plan",
  "prewalk",
  "build",
  "quality",
  "build-review",
  "double-tdd",
  "document",
  "implement-outline",
  "implement",
  "research",
  "prd-oriented-design",
  "prd-oriented-discovery",
];

describe("change-delivery workflow registry", () => {
  test("registers every supported workflow exactly once", () => {
    expect(changeDeliveryWorkflows.map((workflow) => workflow.id)).toEqual(expectedIds);
    expect(new Set(changeDeliveryWorkflows.map((workflow) => workflow.id)).size).toBe(
      expectedIds.length,
    );
  });

  test("resolves workflows from their local modules", () => {
    for (const id of expectedIds) expect(getChangeDeliveryWorkflow(id).id).toBe(id);
  });
});
