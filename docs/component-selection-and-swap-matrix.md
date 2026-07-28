# Component selection and swap matrix

Components are selected only at the phase where their problem becomes real.

| Concern | First phase | Initial local implementation | Alternatives | Switch when |
|---|---:|---|---|---|
| Request ingress | 0 | Local FastAPI/CLI | Typer CLI, Unix socket | A different local interface materially improves use |
| Duplicate guard | 0 | SQLite | PostgreSQL | Multiple processes write concurrently or contention is measured |
| Coding worker | 0 | Configurable local CLI in isolated clone | Claude Code, Codex, OpenCode, Gemini CLI | Candidate wins contract/evaluation tests |
| Validation | 0–1 | Shell commands behind validation contract | Nox, Task, Bazel, Pants, custom runner | Repository scale or caching requires it |
| Planning/agents | 2–3 | Framework-neutral schemas; Pydantic AI candidate | LangGraph, Mastra, Agno, AgentField, Microsoft Agent Framework | Candidate improves measured tasks without leaking types into domain code |
| Parallel workspace | 4 | Git worktrees | Separate clones | Merge/conflict behavior is better under another adapter |
| Sandbox | 5 | Docker/Podman | Lima, Firecracker, local VM, E2B/Daytona for nonlocal use | Isolation or performance needs justify it |
| Durable event runtime | 6 | Local comparison; DBOS or Restate likely | Inngest, Temporal, Hatchet | Recovery/event semantics exceed incumbent or licensing/operations require change |
| GitHub integration | 6 | GitHub App/webhooks | Polling/reconciliation adapter, GitLab adapter | Provider changes or webhook reliability is insufficient |
| MCP/coding skill | 6 | Curated local MCP + `SKILL.md` | AgentField MCP, framework server MCP | Tool selection or security is materially better |
| Workflow registry/router | 7 | Versioned local registry + deterministic rules | AgentField, AgentOS, Mastra server | Native lifecycle/discovery value exceeds dependency risk |
| Traces/evals | 8 | OpenTelemetry + Langfuse candidate | Opik, Phoenix, Braintrust, Future AGI | Required optimization/analysis is materially better elsewhere |
| Expertise/memory | 9 | Versioned files + PostgreSQL/pgvector if needed | Letta, Mem0 | Retrieval and lifecycle complexity justify a service |
| Model gateway | 10 | LiteLLM or Bifrost | Portkey, Envoy AI Gateway | Governance, scale, or policy needs justify change |
| Local inference | 10 | vLLM | llama.cpp, SGLang, Ollama | Hardware/model support or throughput requires it |
| Semantic routing | 10 | Deterministic policy first | vLLM Semantic Router, custom classifier | Several validated routes and enough routing data exist |
| OAuth provider bridge | 10 | None | CLIProxyAPI | A required provider lacks a suitable service credential flow |
| Multi-worker scheduler | 11 | Existing durable runtime | Restate, Temporal, Inngest, Hatchet | Single-node capacity is demonstrably exceeded |

## Swap protocol

1. Freeze the domain port and data schema version.
2. Export incumbent state and document ownership.
3. Run incumbent and candidate against identical contract tests.
4. Replay a representative evaluation dataset.
5. Fault-test timeout, retry, duplicate input, cancellation, restart, and backup recovery.
6. Run a limited canary with independent observability.
7. Prove rollback before raising traffic.
8. Remove the incumbent only after recovery drills pass.
