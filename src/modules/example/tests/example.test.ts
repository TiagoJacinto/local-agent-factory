import { describe, expect, it } from "vitest";

import { greetFromExample } from "../index";

describe("example deep module", () => {
  it("exposes behavior through its entry point", () => {
    expect(greetFromExample(" Ada ")).toBe("Hello, Ada.");
  });
});
