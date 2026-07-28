# PRD Phase 3: Specialist agents and bounded decomposition

## Summary

Split oversized steps into specialist contexts. Introduce scout, planner, builder, tester, reviewer, and optional security roles only where separate expertise or context measurably improves outcomes.

## Inherits

The same sequential SDLC remains the outer workflow. Decomposition occurs inside approved stages and may not bypass deterministic gates or human policy.

## Human evolution represented

```text
Scout → planner → bounded task graph → specialist workers → deterministic gates → reviewer
```

## Progression gate

**Add when:** A representative step exceeds context limits, one agent repeatedly misses domain information, or independent specialist evaluation measurably improves quality.

**Do not add when:** Additional roles merely repeat the same prompt or increase cost without evaluation gains.

## Goals

- Automatically decompose large work into bounded tasks.
- Keep each subagent's context isolated and purpose-specific.
- Support subagents, RLM-style recursive context processing, map/reduce, or another pattern behind one contract.
- Use deterministic code to validate task graphs and dependencies.
- Bound recursion, cost, time, and fan-out.

## Functional requirements

- `TaskGraph` domain model with dependencies, scope, owner role, acceptance criteria, allowed files, and validation plan.
- Deterministic cycle and conflict detection.
- `AgentRuntimePort` supporting role invocation and bounded subagent delegation.
- Context-pack artifacts rather than one ever-growing conversation.
- Limits for depth, fan-out, model calls, tokens, time, and aggregate cost.
- Escalation actions: retry with feedback, change strategy, split, request human clarification, record debt, or abort.
- Mock agent runtime for deterministic workflow tests.

## Non-goals

- No parallel repository editing yet.
- No worktree merge logic.
- No autonomous modification of workflow definitions.

## Acceptance criteria

- [ ] A large fixture is decomposed into independently understandable tasks.
- [ ] Invalid or cyclic graphs fail deterministically.
- [ ] A failed task can be split without rerunning successful reasoning artifacts.
- [ ] Context for one specialist does not automatically include every other agent transcript.
- [ ] Recursion and fan-out stop at configured limits.
- [ ] A second agent framework can implement the same contracts.

## Exit gate

Advance when independent tasks exist that humans would naturally execute in parallel and sequential execution has become the primary bottleneck.
