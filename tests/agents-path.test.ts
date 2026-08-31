import { join } from "node:path";
import { expect, test } from "vitest";
import { resolveRuntimePath } from "../src/modules/workflow-execution/adapters/pi-agent/paths";

test("resolves agent runtime paths outside the isolated workspace", () => {
  expect(resolveRuntimePath("adws/harness.ts")).toBe(join(process.cwd(), "adws/harness.ts"));
  expect(resolveRuntimePath("adws/prompts/system.md")).toBe(
    join(process.cwd(), "adws/prompts/system.md"),
  );
});
