# PRD Phase 8: Observability and evaluation

## Summary

Make every workflow, agent, deterministic gate, coding worker, model route, and external effect inspectable and comparable. Convert real failures into repeatable evaluation cases before attempting self-improvement.

## Inherits

All existing traces and domain artifacts receive stable identifiers and OpenTelemetry instrumentation. Observability must never become a hard dependency for workflow success.

## Progression gate

**Add when:** Failures are difficult to explain, routing choices cannot be compared, or agent changes are promoted by intuition.

**Do not add when:** There are too few representative executions to form meaningful datasets.

## Goals

- Trace the full information flow, not only LLM calls.
- Evaluate nodes, trajectories, artifacts, and end-to-end outcomes.
- Build versioned datasets from real tasks and failures.
- Compare candidate agents, prompts, tools, and workflows before promotion.
- Preserve local operation and exportability.

## Functional requirements

- OpenTelemetry transport boundary.
- Local Langfuse, Opik, Phoenix, or equivalent adapter selected by a contract test.
- Trace redaction and sampling policies.
- Dataset, evaluator, prompt, skill, workflow, and model-route versioning.
- Deterministic evaluators first; model and human evaluators where judgment is required.
- Trajectory evaluation for tool and subagent choices.
- Evaluation CLI and CI gate.
- Trace-to-regression-case workflow.
- Dashboards for success, corrections, cost, latency, retries, human rejection, and reverts.

## Non-goals

- No autonomous promotion.
- No storing secrets or unrestricted repository contents in observability systems.
- No dependence on one proprietary trace schema.

## Acceptance criteria

- [ ] A failed run becomes a reproducible local case.
- [ ] A candidate workflow runs against the same dataset as the incumbent.
- [ ] Tool selection and decomposition trajectories can be scored.
- [ ] Sensitive fields are redacted before export.
- [ ] Trace sink failure does not block the workflow.
- [ ] Every promoted agent or workflow has an evaluation report.

## Exit gate

Advance when the factory has enough trustworthy traces, labels, and holdout cases to evaluate retained expertise rather than simply storing memories.
