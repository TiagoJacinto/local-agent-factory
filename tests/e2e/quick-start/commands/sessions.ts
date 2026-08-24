import { expect } from "@playwright/test";
import { execFileAsync, type QuickStartContext } from "./shared";

export async function verifySessionsCommand({ directory }: QuickStartContext) {
  const { stdout } = await execFileAsync("just", ["sessions"], { cwd: directory });
  expect(stdout).toMatch(/\|success\|/);
}
