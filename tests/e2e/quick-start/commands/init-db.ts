import { existsSync } from "node:fs";
import { join } from "node:path";
import { expect } from "@playwright/test";
import { execFileAsync, type QuickStartContext } from "./shared";

export async function verifyInitDbCommand({ directory }: QuickStartContext) {
  await execFileAsync("just", ["init-db"], { cwd: directory });
  expect(existsSync(join(directory, "adws/adw_data/sssf.db"))).toBe(true);
}
