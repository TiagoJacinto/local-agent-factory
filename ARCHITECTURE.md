# Architecture

## Architectural thesis

The product is a versioned AI developer workflow, not one giant autonomous agent.

Three actors cooperate:

- **Engineers** provide intent, risk decisions, and final validation.
- **Agents** perform ambiguous reasoning, planning, implementation, and specialist review.
- **Deterministic code** owns process control, checks, state, security, retries, and external side effects.

Stable repeated behavior should migrate from prompts into ordinary tested code as the platform matures.

## Phase-0 conceptual architecture

```text
Human request
      ↓
Request and duplicate guard
      ↓
Explicit workflow controller
      ↓
Replaceable coding-worker interface
      ↓
Isolated local workspace
      ├── coding-agent execution
      ├── deterministic validation
      ├── bounded correction
      └── reviewable local commit
      ↓
Trace evidence + mandatory human decision
```

Phase 0 intentionally excludes planning agents, subagents, distributed runtimes, event buses, model gateways, evaluation platforms, memory services, and automatic integration.

## Stable architectural boundaries

### Domain contracts

Framework-neutral definitions for requests, plans, tasks, runs, validation evidence, reviews, events, and learned artifacts.

### Workflow control

The factory owns sequencing, conditions, retries, cancellation, resumption, and side-effect policy. Agent conversations do not secretly own the SDLC.

### Capability ports

Small interfaces describe capabilities rather than vendors:

- workflow runtime;
- agent runtime;
- coding worker;
- validation pipeline;
- repository access;
- event inbox;
- trace sink;
- memory store;
- model gateway.

### Adapters

Vendor and infrastructure implementations translate external APIs into the stable capability contracts. An adapter must be replaceable without changing domain artifacts or workflow meaning.

## Evolution invariants

1. The outer workflow remains explicit and testable.
2. Deterministic checks run independently of agents.
3. Humans remain at request and review boundaries until evaluation evidence supports a narrower role.
4. Additional agents solve measured context or expertise problems.
5. Parallelism follows proven task independence.
6. Worktrees are an interim parallelism mechanism; stronger sandboxes follow measured isolation needs.
7. External events are automated only after the internal workflow is understood and trustworthy.
8. Evaluations precede trace-derived learning.
9. Model routing follows measured route quality.
10. Distributed scale follows measured single-machine limits.
11. Every phase remains operable locally.

## Replaceability strategy

- Domain artifacts never embed framework-specific graph, SDK, or provider objects.
- One component owns each category of state and each retry boundary.
- OpenTelemetry is the preferred observability transport boundary when mature tracing is introduced.
- External side effects require idempotency keys, expected-state checks, and reconciliation.
- Candidate adapters must pass contract, failure, backup, restore, export, and removal tests.
- Incumbent and candidate components may run side by side during canaries.

## Local robustness principles

- Prefer the smallest local persistence mechanism that satisfies measured concurrency and recovery needs.
- Keep failed workspaces and evidence inspectable.
- Treat local repositories as authoritative product history.
- Avoid Kubernetes or distributed infrastructure before measured demand.
- Document backup and restore before introducing each stateful component.
- Preserve a one-machine development and recovery mode even after later scale phases.
