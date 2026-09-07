import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, test } from "vitest";
import { createCli } from "./entrypoints/cli";

describe("CLI", () => {
  test("uses Commander to run the greet command", async () => {
    const messages: string[] = [];
    const cli = createCli((message) => messages.push(message));

    await cli.parseAsync(["node", "local-agent-factory", "greet", "Ada"]);

    expect(messages).toEqual(["Hello, Ada!"]);
  });

  test("uses the default name when none is provided", async () => {
    const messages: string[] = [];
    const cli = createCli((message) => messages.push(message));

    await cli.parseAsync(["node", "local-agent-factory", "greet"]);

    expect(messages).toEqual(["Hello, world!"]);
  });

  test("lists registered workflows and the two approved mock skills", async () => {
    const messages: string[] = [];
    const cli = createCli((message) => messages.push(message));

    await cli.parseAsync(["node", "laf", "workflow", "list"]);
    expect(messages[0]).toContain("prompt");

    messages.length = 0;
    await cli.parseAsync(["node", "laf", "skill", "list"]);
    expect(messages).toEqual(["mock-reviewer\nmock-researcher"]);
  });

  test("initializes local config without installing runtime files", async () => {
    const directory = mkdtempSync(join(tmpdir(), "laf-cli-"));
    try {
      const messages: string[] = [];
      const cli = createCli((message) => messages.push(message));

      await cli.parseAsync(["node", "laf", "init", "--local", "--cwd", directory]);
      expect(existsSync(join(directory, "local-agent-factory.config.yaml"))).toBe(true);
      expect(existsSync(join(directory, "adws"))).toBe(false);
      expect(existsSync(join(directory, ".pi/skills/sssf"))).toBe(false);
      expect(readFileSync(join(directory, "local-agent-factory.config.yaml"), "utf8")).toContain(
        "visualizer:",
      );

      await cli.parseAsync([
        "node",
        "laf",
        "skill",
        "install",
        "mock-reviewer",
        "--local",
        "--cwd",
        directory,
      ]);
      expect(existsSync(join(directory, ".pi/skills/mock-reviewer/SKILL.md"))).toBe(true);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
