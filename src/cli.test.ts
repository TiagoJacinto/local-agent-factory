import { describe, expect, test } from "vitest";
import { createCli } from "./cli";

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
});
