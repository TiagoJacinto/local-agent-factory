import { describe, expect, test } from "vitest";
import { parseStructureOutline } from "./outline-parser";

describe("structure outline parser", () => {
  test("extracts ordered phases and declared validation", () => {
    const phases = parseStructureOutline(`
# Outline
## ✅ Phase 1: Add panel
Changes UI: yes
Validation: \`bun test -- panel\`
Before capture: \`agent-browser screenshot before.png\`
After capture: \`agent-browser screenshot after.png\`

## Phase 2: Persist settings
Validation: \`bun test -- settings\`
`);

    expect(phases).toEqual([
      {
        number: 1,
        title: "Add panel",
        body: expect.stringContaining("Changes UI: yes"),
        validationCommands: ["bun test -- panel"],
        changesUi: true,
        beforeCaptureCommand: "agent-browser screenshot before.png",
        afterCaptureCommand: "agent-browser screenshot after.png",
      },
      expect.objectContaining({
        number: 2,
        title: "Persist settings",
        validationCommands: ["bun test -- settings"],
        changesUi: false,
      }),
    ]);
  });

  test("rejects an outline without phases", () => {
    expect(() => parseStructureOutline("# No phases")).toThrow(
      "structure outline contains no Phase headings",
    );
  });
});
