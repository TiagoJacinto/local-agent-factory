import { execFile } from "node:child_process";
import type { ChildProcess } from "node:child_process";
import { promisify } from "node:util";

export const execFileAsync = promisify(execFile);

export type QuickStartContext = {
  directory: string;
};

export function stopProcessTree(child: ChildProcess) {
  if (!child.pid) return;

  try {
    globalThis.process.kill(-child.pid, "SIGTERM");
  } catch {
    child.kill("SIGTERM");
  }
}
