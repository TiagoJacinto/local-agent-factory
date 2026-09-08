import type { FactoryConfig } from "./configuration";

const SYSTEM_PROMPT = `You are a bounded Local Agent Factory workflow agent.
Follow the request and inspect the repository as needed. Do not modify files outside your allowed write paths.
Return one JSON object with status (success or fail), a concise summary, and any relevant artifacts or changed files.`;

const USER_PROMPT = `Work on this request:

{{prompt}}

Return only the JSON envelope requested by your system instructions.`;

const commonTools = ["read", "bash", "grep", "find", "ls", "write"];

function agent(
  name: string,
  purpose: string,
  writes: string[] | null = null,
  tools = commonTools,
  prewalk?: { implementation_model: string; implementation_thinking: string },
) {
  return {
    name,
    purpose,
    prompts: { system: SYSTEM_PROMPT, user: USER_PROMPT },
    writes,
    tools,
    ...(prewalk ? { prewalk } : {}),
  };
}

export const DEFAULT_CONFIG: FactoryConfig = {
  workflow: {
    database: ".laf/sssf.db",
    defaults: {
      coding_agent: "pi",
      model: "openai-codex/gpt-5.6-luna",
      thinking: "medium",
      tools: commonTools,
      protected_files: [".laf/", "local-agent-factory.config.yaml"],
      data_dir: ".laf",
      allowed_env: [],
      harness_timeout_seconds: 600,
      run_timeout_seconds: 3600,
      max_output_bytes: 1_000_000,
    },
    observability: { db: ".laf/sssf.db", poll_ms: 500 },
    agents: [
      agent(
        "planner",
        "Turn a request into an implementation plan.",
        ["specs/"],
        ["read", "bash", "grep", "find", "ls", "write"],
      ),
      agent("builder", "Implement the requested change.", null, [...commonTools, "edit"]),
      agent(
        "prewalk",
        "Plan and then implement a requested change.",
        null,
        [...commonTools, "edit"],
        { implementation_model: "openai-codex/gpt-5.6-luna", implementation_thinking: "medium" },
      ),
      agent("double_tdd", "Drive an acceptance-led implementation loop.", null, [
        ...commonTools,
        "edit",
      ]),
      agent(
        "scout",
        "Inspect the repository without changing source files.",
        [],
        ["read", "bash", "grep", "find", "ls", "write"],
      ),
      agent(
        "reviewer",
        "Review whether the requested change was delivered.",
        [],
        ["read", "bash", "grep", "find", "ls", "write"],
      ),
      agent(
        "documenter",
        "Document the change that was delivered.",
        ["**/*.md"],
        [...commonTools, "edit"],
      ),
      agent(
        "prd",
        "Turn a request into a product requirements document.",
        [".rpi/problems/"],
        [...commonTools, "edit"],
      ),
      agent(
        "tdd",
        "Turn requirements into a technical design.",
        [".rpi/problems/"],
        [...commonTools, "edit"],
      ),
      agent(
        "research_questions",
        "Create research questions for a request.",
        [".rpi/problems/"],
        [...commonTools, "edit"],
      ),
      agent(
        "research",
        "Gather evidence about the repository and request.",
        [".rpi/problems/"],
        [...commonTools, "edit"],
      ),
    ],
  },
  apps: { visualizer: { port: 4600 } },
};
