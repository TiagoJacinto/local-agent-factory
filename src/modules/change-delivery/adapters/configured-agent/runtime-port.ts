import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { AgentRuntimePort } from "../../../workflow-execution/ports/agent-runtime";
import type { PrimitiveInvocationArguments } from "../../../workflow-execution/domain/workflow";
import { loadConfig, resolveAgent } from "./config";
import * as pi from "../pi-agent/agent_pi";
import * as opencode from "../opencode-agent/agent_opencode";
import { render } from "../pi-agent/prompts";
import type { AgentRuntime } from "../pi-agent/agent_runtime";
import { enforce, snapshot } from "../../../workflow-execution/process-runtime";

/** Configured agent adapter preserving run-scoped sessions, handoffs, and corrections. */
export class ConfiguredAgentRuntime implements AgentRuntimePort {
  private readonly config: ReturnType<typeof loadConfig>;
  private readonly sessions = new Map<string, string>();
  private readonly runtimes: { readonly pi: AgentRuntime; readonly opencode: AgentRuntime };
  constructor(
    configPath = "adws/adw_sssf_config/sssf.config.yaml",
    runtimes = { pi: pi.runtime, opencode: opencode.runtime },
  ) {
    this.config = loadConfig(configPath);
    this.runtimes = runtimes;
  }

  async invoke(
    input: PrimitiveInvocationArguments & {
      readonly workspacePath?: string;
      readonly inputArtifact?: { readonly id: string; readonly value: unknown };
      readonly signal: AbortSignal;
    },
  ): Promise<unknown> {
    const owner = input.options?.agentOwner ?? "engineer";
    const agent = resolveAgent(this.config, owner);
    const runtime = agent.coding_agent === "opencode" ? this.runtimes.opencode : this.runtimes.pi;
    const key = `${input.runIdentifier ?? "run"}:${owner}`;
    const sessionId =
      this.sessions.get(key) ?? `factory-${input.runIdentifier ?? input.invocationId}-${owner}`;
    this.sessions.set(key, sessionId);
    const sessionDir = join(
      this.config.defaults.data_dir,
      "agent-sessions",
      String(input.runIdentifier ?? "run"),
      owner,
    );
    mkdirSync(sessionDir, { recursive: true });
    const artifact = input.inputArtifact
      ? `\nPrevious handoff (${input.inputArtifact.id}):\n${JSON.stringify(input.inputArtifact.value, null, 2)}`
      : "";
    const prompt = `${input.input}${artifact}`;
    const systemPrompt = existsSync(agent.prompt_engineering.system)
      ? readFileSync(agent.prompt_engineering.system, "utf8")
      : "";
    const userPrompt = existsSync(agent.prompt_engineering.user)
      ? render(agent.prompt_engineering.user, { prompt })
      : prompt;
    let activeModel = agent.model;
    let activeThinking = agent.thinking;
    let todoSeen = !(agent.tools?.includes("todo") ?? false);
    let handedOff = false;
    let correction = "";
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const before = input.workspacePath ? snapshot({ repoRoot: input.workspacePath }) : undefined;
      const result = await runtime.run({
        prompt: correction || userPrompt,
        systemPrompt,
        model: activeModel,
        thinking: activeThinking,
        sessionId,
        sessionDir,
        rawOutputPath: join(sessionDir, `${input.invocationId}-${attempt}.json`),
        stderrPath: join(sessionDir, `${input.invocationId}-${attempt}.stderr`),
        tools:
          agent.prewalk && activeModel === agent.model && !handedOff && agent.tools
            ? agent.tools.filter((tool) => tool !== "bash")
            : agent.tools,
        cwd: input.workspacePath ?? process.cwd(),
        allowedEnv: agent.allowed_env,
        timeoutMs: this.config.defaults.harness_timeout_seconds * 1000,
        maxOutputBytes: this.config.defaults.max_output_bytes,
        signal: input.signal,
        stopWhen:
          agent.prewalk && !handedOff
            ? (event: any) => {
                if (event?.toolName === "todo") todoSeen = true;
                if (todoSeen && (event?.toolName === "edit" || event?.toolName === "write")) {
                  handedOff = true;
                  return true;
                }
                return false;
              }
            : undefined,
      });
      if (handedOff && agent.prewalk && activeModel === agent.model) {
        activeModel = agent.prewalk.implementation_model;
        activeThinking = agent.prewalk.implementation_thinking;
        correction = "Continue implementation after the planning handoff.";
        handedOff = false;
        attempt -= 1;
        continue;
      }
      let value: any;
      try {
        value = JSON.parse(result.text);
      } catch {
        correction = `Return only a valid JSON envelope with status success or fail. Previous output was malformed:\n${result.text}`;
        continue;
      }
      if (value?.status !== "success" && value?.status !== "fail") {
        correction = "Return a valid envelope with status success or fail.";
        continue;
      }
      if (value.status === "fail") {
        correction = `Correct the failure and return a success or fail envelope. Previous result: ${JSON.stringify(value)}`;
        continue;
      }
      if (before && input.workspacePath)
        enforce(
          { repoRoot: input.workspacePath, cfg: { defaults: this.config.defaults } },
          before,
          agent,
          value,
        );
      return { value, sessionId, returncode: result.returncode };
    }
    throw new Error(`agent ${owner} did not return a valid envelope after retries`);
  }
}
