/// <reference types="bun" />
import { execFile } from "node:child_process";
import { chmod, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { promisify } from "node:util";
import { expect, test } from "@playwright/test";
import { verifyDefaultCommand } from "./quick-start/commands/default";
import { verifyDemoCommand } from "./quick-start/commands/demo";
import { verifyInitDbCommand } from "./quick-start/commands/init-db";
import { verifyListCommand } from "./quick-start/commands/list";
import { verifyObsCommand, verifyObsHostCommand } from "./quick-start/commands/obs";
import { stopProcessTree } from "./quick-start/commands/shared";
import { verifySessionsCommand } from "./quick-start/commands/sessions";

const execFileAsync = promisify(execFile);
const installerCommand =
  "curl -fsSL https://raw.githubusercontent.com/TiagoJacinto/local-agent-factory/main/install.sh | bash";

async function createFakePi(directory: string) {
  const path = `${directory}/fake-pi`;
  await writeFile(
    path,
    `#!/usr/bin/env bun
const envelope = JSON.stringify({
  status: "success",
  summary: "Quick-start fake agent completed.",
  artifacts: [],
});
console.log(JSON.stringify({
  type: "message_end",
  message: { role: "assistant", content: [{ type: "text", text: envelope }] },
}));
console.log(JSON.stringify({ type: "agent_end", messages: [{ stopReason: "stop" }] }));
`,
  );
  await chmod(path, 0o755);
  return path;
}

test("personal quick start supports every default command", async ({ page }) => {
  test.setTimeout(10 * 60_000);
  const directory = await mkdtemp(`${tmpdir()}/sssf-quick-start-`);
  const context = { directory };
  const visualizerProcesses = [];
  const previousPiPath = Bun.env.PI_PATH;

  try {
    Bun.env.PI_PATH = await createFakePi(directory);
    await execFileAsync("bash", ["-lc", installerCommand], {
      cwd: directory,
      maxBuffer: 10 * 1024 * 1024,
    });

    await verifyDefaultCommand(context);
    await verifyListCommand(context);
    await verifyInitDbCommand(context);
    await verifyDemoCommand(context);
    await verifySessionsCommand(context);

    const obs = await verifyObsCommand(context);
    visualizerProcesses.push(obs.server);
    await page.goto(obs.url, { waitUntil: "domcontentloaded" });
    await expect(page).toHaveTitle("Super Simple Software Factory");
    await expect(page.getByText("Super Simple Software Factory")).toBeVisible();
    stopProcessTree(obs.server);
    visualizerProcesses.pop();

    const obsHost = await verifyObsHostCommand(context);
    visualizerProcesses.push(obsHost.server);
    await page.goto(obsHost.url, { waitUntil: "domcontentloaded" });
    await expect(page).toHaveTitle("Super Simple Software Factory");
  } finally {
    if (previousPiPath === undefined) delete Bun.env.PI_PATH;
    else Bun.env.PI_PATH = previousPiPath;
    for (const process of visualizerProcesses) stopProcessTree(process);
    await rm(directory, { recursive: true, force: true });
  }
});
