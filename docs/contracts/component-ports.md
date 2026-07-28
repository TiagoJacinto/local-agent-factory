# Component ports

The ports are capability contracts, not vendor abstractions. A phase may add a richer adapter without changing the business meaning of the port.

## WorkflowRuntimePort

Owns explicit process sequence and lifecycle.

- Phase 0: in-process local workflow.
- Phase 6: durable event/runtime adapter after external waits and side effects exist.
- Later candidates: DBOS, Restate, Inngest, Temporal, Hatchet.

The runtime owns workflow retries, cancellation, resumption, and side-effect orchestration. Agent frameworks do not own external side-effect retries.

## CodingWorkerPort

Owns one bounded implementation task and returns a structured result.

- Phase 0: isolated local clone plus configurable coding-agent command.
- Phase 4: Git worktree adapter for parallel tasks.
- Phase 5: container/VM adapters and multiple coding-agent CLIs.

Inputs include objective, repository path, expected SHA, allowed files, validation commands, timeout, and correction budget. Outputs include status, changed files, validation commands, attempts, workspace, branch, commit, summary, and unresolved risks.

## ValidationPipelinePort

Introduced in Phase 1. Owns deterministic formatter, lint, type-check, test, and policy gates. It must be runnable without a model and return structured failure reports.

## AgentRuntimePort

Introduced in Phase 2 for planning and Phase 3 for specialists and decomposition. It owns typed reasoning for a role, not workflow durability or external side effects.

Candidate adapters:

- Pydantic AI
- LangGraph
- Mastra through a service boundary
- Agno
- AgentField reasoners
- Microsoft Agent Framework
- OpenAI Agents SDK

## RepositoryLocatorPort

Maps an approved repository identifier to a local path. It must never clone arbitrary untrusted repositories merely because an event names them.

## EventInboxPort

Phase 0 uses SQLite as a duplicate guard. Phase 6 expands event state to durable ingestion, reconciliation, and dead-letter behavior.

## TraceSinkPort

Phase 0 writes local JSONL. Phase 8 uses OpenTelemetry as the replaceable transport boundary for Langfuse, Opik, Phoenix, Braintrust, Future AGI, or another platform.

## MemoryStorePort

Reserved until Phase 9. Learned artifacts require provenance, scope, evaluation, approval, expiry, and rollback.

## ModelGatewayPort

Reserved until Phase 10. Agents request capability aliases rather than concrete models. Candidate adapters include LiteLLM, Bifrost, Portkey, vLLM, vLLM Semantic Router, and restricted CLIProxyAPI upstreams.
