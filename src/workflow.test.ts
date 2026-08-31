import { describe, expect, test } from "vitest";
import { executeWithAgentFix } from "./modules/workflow-execution";

describe("executeWithAgentFix", () => {
  test("passes an execution error to the agent before retrying", async () => {
    let executions = 0;
    const failures: Array<{ message: string; attempt: number }> = [];

    const result = await executeWithAgentFix(
      () => {
        executions += 1;
        if (executions === 1) throw new Error("missing import");
        return "fixed";
      },
      (error, attempt) => {
        failures.push({ message: error.message, attempt });
      },
    );

    expect(result).toBe("fixed");
    expect(executions).toBe(2);
    expect(failures).toEqual([{ message: "missing import", attempt: 1 }]);
  });

  test("passes returned failures to the agent", async () => {
    let executions = 0;
    const errors: string[] = [];

    const result = await executeWithAgentFix(
      () => {
        executions += 1;
        return executions === 1 ? { ok: false, output: "type error" } : { ok: true, output: "ok" };
      },
      (error) => {
        errors.push(error.message);
      },
      {
        isFailure: (value) => !value.ok,
        formatFailure: (value) => value.output,
      },
    );

    expect(result).toEqual({ ok: true, output: "ok" });
    expect(errors).toEqual(["type error"]);
  });

  test("uses the default agent when no custom fixer is provided", async () => {
    let executions = 0;
    const prompts: string[] = [];

    const result = await executeWithAgentFix(
      () => {
        executions += 1;
        if (executions === 1) throw new Error("command failed");
        return "fixed by default agent";
      },
      {
        agent: (prompt) => {
          prompts.push(prompt);
        },
      },
    );

    expect(result).toBe("fixed by default agent");
    expect(prompts).toEqual(["Fix attempt 1: command failed"]);
  });

  test("throws the last error after the attempt limit", async () => {
    let executions = 0;
    const agentFix = async () => undefined;

    await expect(
      executeWithAgentFix(
        () => {
          executions += 1;
          throw new Error(`failure ${executions}`);
        },
        agentFix,
        { maxAttempts: 2 },
      ),
    ).rejects.toThrow("failure 2");
    expect(executions).toBe(2);
  });
});
