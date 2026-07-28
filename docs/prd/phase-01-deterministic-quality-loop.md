# PRD Phase 1: Deterministic quality loop

## Summary

Evolve the Phase-0 workflow by adding deterministic code checks one at a time. The coding agent still performs the implementation, while the factory independently runs formatting, linting, type checking, and tests and returns precise failures to the same logical session.

## Inherits

All Phase-0 behavior, boundaries, and acceptance tests remain mandatory.

## Human evolution represented

```text
Engineer → build agent → format → lint → type-check → tests → engineer review
                    ↑         fail from any deterministic gate       │
                    └─────────────────────────────────────────────────┘
```

## Progression gate

**Add when:** One validation command no longer catches the failures humans repeatedly find during review.

**Do not add when:** A proposed check has no stable deterministic implementation or produces excessive false failures.

## Goals

- Increase confidence primarily by adding code, not more agents.
- Make each gate independently runnable and testable.
- Preserve exact failure output and gate identity.
- Prevent stacked or unbounded retries.
- Keep the engineer at request and review boundaries.

## Functional requirements

- Ordered `ValidationPipelinePort` with independently configured gates.
- Gate types: formatter check, linter, type checker, unit tests, and optional repository-specific command.
- Per-gate timeout and retry classification.
- One workflow-level correction budget shared across all gates.
- Same logical coding session ID for correction attempts when the worker supports it.
- Structured `ValidationReport` with gate, command, exit code, stdout/stderr summary, and duration.
- Contract tests proving gates can be added, removed, or reordered without changing the coding worker.

## Non-goals

- No test agent yet.
- No planner or decomposition.
- No parallelism.
- No CI service dependency.

## Acceptance criteria

- [ ] Each gate can be run without a model.
- [ ] A failed gate returns only relevant bounded context to the coding agent.
- [ ] Successful earlier gates are rerun only when changed files can invalidate them.
- [ ] The workflow stops after the shared correction budget is exhausted.
- [ ] A gate can be disabled without editing agent prompts.
- [ ] Human review receives the final validation report.

## Exit gate

Advance when the validation pipeline catches most routine formatting, lint, typing, and unit-test problems before human review, and remaining failures are predominantly planning or context problems.
