import { expect } from "@playwright/test";
import { execFileAsync, type QuickStartContext } from "./shared";

export async function verifyListCommand({ directory }: QuickStartContext) {
  const { stdout } = await execFileAsync("just", ["--list"], { cwd: directory });
  for (const recipe of ["demo", "init-db", "sessions", "obs", "obs-host"]) {
    expect(stdout).toContain(recipe);
  }
}
