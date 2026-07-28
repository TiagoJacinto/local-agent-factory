# PRD Phase 7: Workflow router and specialized factories

## Summary

Route each ticket to an intentionally specialized AI developer workflow: chore, bug, feature, refactor, security change, or hotfix. Specialization changes agents, deterministic gates, approvals, compute, and time budgets—not just prompts.

## Inherits

Event handling and durable execution remain generic. Specialized workflows implement a versioned `DeveloperWorkflowPort` and share common validation and side-effect services.

## Human evolution represented

```text
Ticket → factory router → chore | bug | feature | hotfix | security workflow
```

## Progression gate

**Add when:** Measured work classes need materially different validation, urgency, expertise, or compute.

**Do not add when:** Routing labels are cosmetic and all paths still execute the same process.

## Goals

- Select the simplest workflow capable of meeting quality and risk requirements.
- Create expert roles with scoped instructions and context.
- Use deterministic routing where possible and semantic routing only where ambiguity remains.
- Add a hotfix path with explicit human approval and optional race-to-first validated solution.
- Make workflow choice visible and reversible.

## Functional requirements

- Typed work classification with confidence, risk, urgency, and rationale.
- Deterministic label/rule router before LLM classification.
- Versioned workflow registry and capability metadata.
- Chore fast path: one worker plus essential deterministic checks.
- Feature path: scout, planner, decomposition, parallel build, integration review.
- Bug path: reproduce, diagnose, fix, regression test.
- Hotfix path: specialist context, human plan approval, bounded parallel sandbox race, fastest validated candidate, human release approval.
- Security path: restricted tools, threat review, stronger human gate.
- Cost/time/resource budgets per workflow.

## Non-goals

- No zero-touch production deployment.
- No automatic permanent expertise from raw traces.
- No unconstrained model selection.

## Acceptance criteria

- [ ] A chore does not invoke the full feature workflow.
- [ ] A hotfix cannot proceed past the defined human gates.
- [ ] Routing decisions are stored with rationale and version.
- [ ] A low-confidence route requests human classification.
- [ ] Each specialized workflow passes common contract tests.
- [ ] A workflow can be disabled or rolled back independently.

## Exit gate

Advance when several workflow versions and agent changes exist and humans can no longer compare quality reliably from logs and final diffs alone.
