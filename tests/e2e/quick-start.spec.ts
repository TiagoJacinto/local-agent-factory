import { execFile, spawn, type ChildProcess } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { expect, test } from "@playwright/test";

const execFileAsync = promisify(execFile);
const installerCommand =
  "curl -fsSL https://raw.githubusercontent.com/TiagoJacinto/local-agent-factory/main/install.sh | bash";

function stopProcessTree(child: ChildProcess) {
  if (!child.pid) return;

  try {
    globalThis.process.kill(-child.pid, "SIGTERM");
  } catch {
    child.kill("SIGTERM");
  }
}

async function startObservabilityHost(directory: string) {
  const server = spawn("just", ["obs-host"], {
    cwd: directory,
    detached: true,
    stdio: ["ignore", "pipe", "pipe"],
  });

  let output = "";
  const readOutput = (chunk: Buffer) => {
    output += chunk.toString();
  };
  server.stdout?.on("data", readOutput);
  server.stderr?.on("data", readOutput);

  const url = await new Promise<string>((resolve, reject) => {
    const timer = setTimeout(() => {
      stopProcessTree(server);
      reject(new Error(`obs-host did not report a URL. Output:\n${output}`));
    }, 120_000);

    const check = () => {
      const match = output.match(/Local:\s+(https?:\/\/localhost:\d+\/?)/);
      if (!match) return;
      clearTimeout(timer);
      resolve(match[1]);
    };

    server.stdout?.on("data", check);
    server.stderr?.on("data", check);
    server.once("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    server.once("exit", (code) => {
      if (code !== null) {
        clearTimeout(timer);
        reject(new Error(`obs-host exited with code ${code}. Output:\n${output}`));
      }
    });
  });

  return { server, url };
}

test("personal quick start installs and opens the sessions UI", async ({ page }) => {
  test.setTimeout(5 * 60_000);
  const directory = await mkdtemp(join(tmpdir(), "sssf-quick-start-"));
  let host: ChildProcess | undefined;

  try {
    await execFileAsync("bash", ["-lc", installerCommand], {
      cwd: directory,
      maxBuffer: 10 * 1024 * 1024,
    });

    const { stdout: sessionsOutput } = await execFileAsync("just", ["sessions"], {
      cwd: directory,
    });
    expect(sessionsOutput.trim()).toBe("");

    const started = await startObservabilityHost(directory);
    host = started.server;
    await page.goto(started.url, { waitUntil: "domcontentloaded" });
    await expect(page).toHaveTitle("Super Simple Software Factory");
    await expect(page.getByText("no sessions yet — run an ADW to see it here")).toBeVisible({
      timeout: 30_000,
    });
  } finally {
    if (host) stopProcessTree(host);
    await rm(directory, { recursive: true, force: true });
  }
});
