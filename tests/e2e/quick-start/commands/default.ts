import { expect } from "@playwright/test";
import { execFileAsync, type QuickStartContext } from "./shared";

export async function verifyDefaultCommand({ directory }: QuickStartContext) {
  const { stdout } = await execFileAsync("just", [], { cwd: directory });
  expect(stdout).toContain("Available recipes");
  expect(stdout).toContain("demo");
}
