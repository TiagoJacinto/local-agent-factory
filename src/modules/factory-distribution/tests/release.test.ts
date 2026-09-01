import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { parseReleaseOptions, releaseAndInstall } from "../application/release";

describe("release automation", () => {
  test("parses repeatable intended paths and defaults", () => {
    const options = parseReleaseOptions([
      "--target",
      "/tmp/target",
      "--message",
      "publish",
      "--path",
      "src/a.ts",
      "--path",
      "src/b.ts",
    ]);
    expect(options.paths).toEqual(["src/a.ts", "src/b.ts"]);
    expect(options.remote).toBe("origin");
    expect(options.timeoutSeconds).toBe(600);
  });

  test("runs commit, push, tag, release wait, and exact-version install in order", () => {
    const target = mkdtempSync(join(tmpdir(), "sssf-release-test-"));
    const calls: string[] = [];
    const command = (name: string, args: string[], _cwd?: string): string => {
      calls.push(`${name} ${args.join(" ")}`);
      if (name === "git" && args[0] === "branch") return "main\n";
      if (name === "gh" && args[0] === "repo") return "example/factory\n";
      if (name === "git" && args[0] === "diff") return "src/change.ts\n";
      if (name === "gh" && args[0] === "run")
        return '[{"headBranch":"v1.2.3","status":"completed","conclusion":"success"}]';
      if (name === "curl") return "#!/bin/sh\n";
      return "";
    };

    releaseAndInstall(
      {
        target,
        paths: ["src/change.ts"],
        message: "publish change",
        version: "v1.2.3",
        remote: "origin",
        timeoutSeconds: 1,
        pollSeconds: 0,
      },
      command,
    );

    expect(calls.map((call) => call.split(" ")[0])).toEqual([
      "git",
      "gh",
      "git",
      "git",
      "git",
      "git",
      "git",
      "git",
      "gh",
      "curl",
      "bash",
    ]);
    expect(calls.at(-1)).toContain("--version v1.2.3");
  });
});
