import { describe, expect, test } from "vitest";
import { runPrewalk, type PiSession, type PiTurn } from "./prewalk";

function session(identifier: string, turns: readonly PiTurn[]) {
  const calls: Parameters<PiSession["runTurn"]>[0][] = [];
  const piSession: PiSession = {
    identifier,
    async runTurn(input) {
      calls.push(input);
      const turn = turns[calls.length - 1];
      if (!turn) throw new Error("unexpected Pi turn");
      return turn;
    },
  };
  return { piSession, calls };
}

describe("runPrewalk", () => {
  test("switches the existing Pi session after Todo and the first edit", async () => {
    const { piSession, calls } = session("session-001", [
      { toolResults: [{ name: "read" }], complete: false },
      { toolResults: [{ name: "todo" }], complete: false },
      { toolResults: [{ name: "edit" }], complete: false },
      { toolResults: [], complete: true },
    ]);

    const result = await runPrewalk(piSession, {
      prompt: "Add a health endpoint",
      planningModel: { model: "slow", thinking: "high" },
      implementationModel: { model: "fast", thinking: "low" },
      builtInTools: ["todo", "read", "edit", "write"],
    });

    expect(result).toEqual({
      sessionIdentifier: "session-001",
      status: "HandedOff",
      planningModel: { model: "slow", thinking: "high" },
      implementationModel: { model: "fast", thinking: "low" },
      handoffTool: "edit",
    });
    expect(calls.map((call) => call.model.model)).toEqual(["slow", "slow", "slow", "fast"]);
    expect(calls[0]?.builtInTools).toEqual(["todo", "read", "edit", "write"]);
  });

  test("does not switch during discovery or Todo updates", async () => {
    const { piSession, calls } = session("session-002", [
      {
        toolResults: [{ name: "read" }, { name: "grep" }, { name: "bash" }, { name: "todo" }],
        complete: true,
      },
    ]);

    const result = await runPrewalk(piSession, {
      prompt: "Explain the existing architecture",
      planningModel: { model: "slow" },
      implementationModel: { model: "fast" },
      builtInTools: ["todo", "read", "grep", "bash"],
    });

    expect(result).toEqual({
      sessionIdentifier: "session-002",
      status: "CompletedWithoutHandoff",
      planningModel: { model: "slow" },
    });
    expect(calls.map((call) => call.model.model)).toEqual(["slow"]);
  });

  test("skips an equal model and thinking selection", async () => {
    const { piSession, calls } = session("session-003", [
      { toolResults: [{ name: "todo" }, { name: "edit" }], complete: true },
    ]);

    const result = await runPrewalk(piSession, {
      prompt: "Update the README",
      planningModel: { model: "same", thinking: "medium" },
      implementationModel: { model: "same", thinking: "medium" },
      builtInTools: ["todo", "edit"],
    });

    expect(result.status).toBe("CompletedWithoutHandoff");
    expect(calls.map((call) => call.model.model)).toEqual(["same"]);
  });

  test("waits for a successful Todo result before switching", async () => {
    const { piSession, calls } = session("session-004", [
      { toolResults: [{ name: "todo", isError: true }, { name: "edit" }], complete: false },
      { toolResults: [{ name: "todo" }], complete: false },
      { toolResults: [{ name: "write" }], complete: false },
      { toolResults: [], complete: true },
    ]);

    const result = await runPrewalk(piSession, {
      prompt: "Implement the change",
      planningModel: { model: "slow" },
      implementationModel: { model: "fast" },
      builtInTools: ["todo", "edit", "write"],
    });

    expect(result.handoffTool).toBe("write");
    expect(calls.map((call) => call.model.model)).toEqual(["slow", "slow", "slow", "fast"]);
  });
});
