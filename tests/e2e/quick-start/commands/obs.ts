import { spawn } from "node:child_process";
import { expect } from "@playwright/test";
import { stopProcessTree, type QuickStartContext } from "./shared";

async function startVisualizer({ directory }: QuickStartContext, recipe: "obs" | "obs-host") {
  const server = spawn("just", [recipe], {
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
      reject(new Error(`${recipe} did not report a URL. Output:\n${output}`));
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
        reject(new Error(`${recipe} exited with code ${code}. Output:\n${output}`));
      }
    });
  });

  return { server, url };
}

export async function verifyObsCommand(context: QuickStartContext) {
  const started = await startVisualizer(context, "obs");
  expect(started.url).toMatch(/^http:\/\/localhost:\d+\/?$/);
  return started;
}

export async function verifyObsHostCommand(context: QuickStartContext) {
  const started = await startVisualizer(context, "obs-host");
  expect(started.url).toMatch(/^http:\/\/localhost:\d+\/?$/);
  return started;
}
