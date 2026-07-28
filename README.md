# Local Agent Factory — Engineering Documentation

This package contains only the engineering documentation for a local-first software factory that combines engineers, agents, and deterministic code.

No application source code, tests, container definitions, build scripts, or executable scaffolding are included.

## Product objective

Build a locally operated AI developer workflow platform that starts with one small, reviewable coding workflow and evolves only when measured needs justify additional validation, planning, specialization, isolation, event automation, evaluation, learning, routing, or scale.

The factory is not one autonomous agent. It is an explicit software-development workflow in which:

- engineers provide intent, risk decisions, and final validation;
- agents handle ambiguous reasoning, planning, implementation, and specialist review;
- deterministic code owns control flow, validation, policy, retries, state, and external side effects.

## Recommended reading order

1. [Engineering principles](docs/engineering-principles.md)
2. [Architecture](ARCHITECTURE.md)
3. [Platform roadmap](ROADMAP.md)
4. [Progression decision checklist](docs/progression-decision-checklist.md)
5. [Component selection and swap matrix](docs/component-selection-and-swap-matrix.md)
6. [Component contracts](docs/contracts/component-ports.md)
7. [Event contract](docs/contracts/event-envelope.md)
8. [Local robustness runbook](docs/local-robustness-runbook.md)
9. Phase PRDs in numerical order

## Phase PRDs

- [Phase 0 — Manual local build-and-lint MVP](docs/prd/phase-00-local-agent-factory-mvp.md)
- [Phase 1 — Deterministic quality loop](docs/prd/phase-01-deterministic-quality-loop.md)
- [Phase 2 — Explicit SDLC workflow](docs/prd/phase-02-explicit-sdlc-workflow.md)
- [Phase 3 — Specialist decomposition](docs/prd/phase-03-specialist-decomposition.md)
- [Phase 4 — Parallel worktrees](docs/prd/phase-04-parallel-worktrees.md)
- [Phase 5 — Sandboxed coding workers](docs/prd/phase-05-sandboxed-coding-workers.md)
- [Phase 6 — Event-driven workflow](docs/prd/phase-06-event-driven-workflow.md)
- [Phase 7 — Specialized workflow router](docs/prd/phase-07-specialized-workflow-router.md)
- [Phase 8 — Observability and evaluation](docs/prd/phase-08-observability-evaluation.md)
- [Phase 9 — Controlled expertise](docs/prd/phase-09-controlled-expertise.md)
- [Phase 10 — Model routing](docs/prd/phase-10-model-routing.md)
- [Phase 11 — Multi-repository and multi-worker scale](docs/prd/phase-11-scale-platform.md)

## Governing progression rule

Phase 0 is the usable MVP. Every later phase must preserve it, solve a measured problem, add one primary capability, define rollback and removal, and retain local operation.
