import { describe, expect, test } from "vitest";
import { classifyPush, policyMessage } from "./gate";

describe("git push policy", () => {
  test("ignores unrelated commands", () => {
    expect(classifyPush("git status")).toBe("none");
  });

  test("runs the gate for normal pushes", () => {
    expect(classifyPush("git push origin main")).toBe("push");
  });

  test("blocks hook bypass", () => {
    expect(classifyPush("git push --no-verify")).toBe("bypass");
    expect(policyMessage("bypass")).toContain("bypasses");
  });

  test("blocks force pushes", () => {
    expect(classifyPush("git push --force-with-lease")).toBe("force");
    expect(classifyPush("git push -f origin main")).toBe("force");
  });
});
