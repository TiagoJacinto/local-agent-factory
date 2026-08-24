import { expect } from "@playwright/test";
import { execFileAsync, type QuickStartContext } from "./shared";

export async function verifyDemoCommand({ directory }: QuickStartContext) {
  const { stdout } = await execFileAsync("just", ["demo"], {
    cwd: directory,
    maxBuffer: 10 * 1024 * 1024,
  });
  expect(stdout).toContain("both done");
}
