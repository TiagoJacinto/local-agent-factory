import * as pi from "../pi-agent/agent_pi";
import * as opencode from "../opencode-agent/agent_opencode";
import type { AgentRuntime } from "../pi-agent/agent_runtime";

export interface ConfigDefaults {
  coding_agent: string;
  model: string;
  thinking: string;
  color: string;
  tools: string[] | null;
  protected_files: string[];
  data_dir: string;
  allowed_env: string[];
  harness_timeout_seconds: number;
  run_timeout_seconds: number;
  max_output_bytes: number;
}
export interface AgentConfig {
  name: string;
  coding_agent: string;
  model: string;
  thinking: string;
  prewalk?: { implementation_model: string; implementation_thinking: string };
  color: string;
  purpose: string;
  prompts: { system: string; user: string };
  tools: string[] | null;
  writes: string[] | null;
  allowed_env: string[];
}
export interface SSSFConfig {
  defaults: ConfigDefaults;
  observability: { db: string; poll_ms: number };
  agents: AgentConfig[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringValue(value: unknown, fallback: string, field: string): string {
  if (value === undefined) return fallback;
  if (typeof value !== "string") throw new Error(`${field} must be a string`);
  return value;
}

function stringArray(value: unknown, fallback: string[], field: string): string[] {
  if (value === undefined) return fallback;
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new Error(`${field} must be an array of strings`);
  }
  return value;
}

function loadSource(source: unknown): Record<string, unknown> {
  if (!isRecord(source)) throw new Error("inline workflow configuration must be an object");
  if (source.workflow !== undefined) {
    if (!isRecord(source.workflow)) throw new Error("workflow must be an object");
    return source.workflow;
  }
  return source;
}

export function loadConfig(source: unknown): SSSFConfig {
  const raw = loadSource(source);
  const rawDefaults = raw.defaults;
  const rawObservability = raw.observability;
  const rawAgents = raw.agents;
  if (rawDefaults !== undefined && !isRecord(rawDefaults)) {
    throw new Error("workflow.defaults must be an object");
  }
  if (rawObservability !== undefined && !isRecord(rawObservability)) {
    throw new Error("workflow.observability must be an object");
  }
  if (!Array.isArray(rawAgents)) throw new Error("workflow.agents must be an array");
  const d = rawDefaults ?? {};
  const defaults: ConfigDefaults = {
    coding_agent: stringValue(d.coding_agent, "pi", "workflow.defaults.coding_agent"),
    model: stringValue(d.model, "openrouter/google/gemini-3.6-flash", "workflow.defaults.model"),
    thinking: stringValue(d.thinking, "medium", "workflow.defaults.thinking"),
    color: stringValue(d.color, "", "workflow.defaults.color"),
    tools: d.tools === null ? null : stringArray(d.tools, [], "workflow.defaults.tools"),
    protected_files: stringArray(
      d.protected_files,
      [".laf/", "local-agent-factory.config.yaml"],
      "workflow.defaults.protected_files",
    ),
    data_dir: stringValue(d.data_dir, ".laf", "workflow.defaults.data_dir"),
    allowed_env: stringArray(d.allowed_env, [], "workflow.defaults.allowed_env"),
    harness_timeout_seconds: Number(d.harness_timeout_seconds ?? 600),
    run_timeout_seconds: Number(d.run_timeout_seconds ?? 3600),
    max_output_bytes: Number(d.max_output_bytes ?? 1_000_000),
  };
  const agents = rawAgents.map((rawAgent, index) => {
    if (!isRecord(rawAgent)) throw new Error(`workflow.agents[${index}] must be an object`);
    const prompts = rawAgent.prompts;
    if (!isRecord(prompts)) throw new Error(`workflow.agents[${index}].prompts must be an object`);
    const system = stringValue(prompts.system, "", `workflow.agents[${index}].prompts.system`);
    const user = stringValue(prompts.user, "", `workflow.agents[${index}].prompts.user`);
    const prewalk = rawAgent.prewalk;
    if (prewalk !== undefined && !isRecord(prewalk)) {
      throw new Error(`workflow.agents[${index}].prewalk must be an object`);
    }
    return {
      name: stringValue(rawAgent.name, "", `workflow.agents[${index}].name`),
      purpose: stringValue(rawAgent.purpose, "", `workflow.agents[${index}].purpose`),
      prompts: { system, user },
      coding_agent: stringValue(
        rawAgent.coding_agent,
        defaults.coding_agent,
        `workflow.agents[${index}].coding_agent`,
      ),
      model: stringValue(rawAgent.model, defaults.model, `workflow.agents[${index}].model`),
      thinking: stringValue(
        rawAgent.thinking,
        defaults.thinking,
        `workflow.agents[${index}].thinking`,
      ),
      color: stringValue(rawAgent.color, defaults.color, `workflow.agents[${index}].color`),
      tools:
        rawAgent.tools === null
          ? null
          : stringArray(rawAgent.tools, defaults.tools ?? [], `workflow.agents[${index}].tools`),
      writes:
        rawAgent.writes === null
          ? null
          : stringArray(rawAgent.writes, [], `workflow.agents[${index}].writes`),
      allowed_env: stringArray(
        rawAgent.allowed_env,
        defaults.allowed_env,
        `workflow.agents[${index}].allowed_env`,
      ),
      prewalk: prewalk
        ? {
            implementation_model: stringValue(
              prewalk.implementation_model,
              "",
              `workflow.agents[${index}].prewalk.implementation_model`,
            ),
            implementation_thinking: stringValue(
              prewalk.implementation_thinking,
              defaults.thinking,
              `workflow.agents[${index}].prewalk.implementation_thinking`,
            ),
          }
        : undefined,
    };
  });
  const o = rawObservability ?? {};
  return {
    defaults,
    observability: {
      db: stringValue(o.db, ".laf/sssf.db", "workflow.observability.db"),
      poll_ms: Number(o.poll_ms ?? 500),
    },
    agents,
  };
}

export function resolveAgent(cfg: SSSFConfig, name: string): AgentConfig {
  const agent = cfg.agents.find((candidate) => candidate.name === name);
  if (!agent)
    throw new Error(
      `agent ${name} is not defined in config — available: ${cfg.agents.map((candidate) => candidate.name).join(", ")}`,
    );
  return agent;
}

export function validate(cfg: SSSFConfig, required: string[]): void {
  const problems: string[] = [];
  for (const name of required) {
    try {
      const agent = resolveAgent(cfg, name);
      if (agent.coding_agent !== "pi" && agent.coding_agent !== "opencode")
        problems.push(`agent ${name}: unsupported coding_agent ${agent.coding_agent}`);
      if (!agent.prompts.system.trim()) problems.push(`agent ${name}: system prompt is empty`);
      if (!agent.prompts.user.trim()) problems.push(`agent ${name}: user prompt is empty`);
      const runtime: AgentRuntime =
        agent.coding_agent === "opencode" ? opencode.runtime : pi.runtime;
      runtime.assertCredential(runtime.resolveModel(agent.model)[0]);
    } catch (error) {
      problems.push(String(error));
    }
  }
  if (problems.length) throw new Error(`config validation failed:\n- ${problems.join("\n- ")}`);
}
