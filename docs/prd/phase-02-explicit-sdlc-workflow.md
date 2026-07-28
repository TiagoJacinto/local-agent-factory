# PRD Phase 2: Explicit plan-build-test-review workflow

## Summary

Add an explicit planning artifact and formalize the familiar SDLC sequence. The workflow remains sequential and local: human request, plan, build, deterministic validation, optional independent review, and human acceptance.

## Inherits

The Phase-0 coding worker and Phase-1 validation pipeline remain unchanged behind their ports.

## Human evolution represented

```text
Engineer intent → plan → build → deterministic validation → review → engineer accepts
                          ↑               fail              │
                          └─────────────────────────────────┘
```

## Progression gate

**Add when:** Build failures frequently come from unclear scope, missing acceptance criteria, or modifying the wrong files.

**Do not add when:** Small chores remain faster and equally reliable without an explicit plan.

## Goals

- Make intent, scope, acceptance criteria, and validation explicit before editing.
- Separate planning context from implementation context.
- Keep plan artifacts framework-neutral and reviewable.
- Add an optional independent review role only after deterministic checks pass.
- Preserve a lightweight path for trivial chores.

## Functional requirements

- Typed `ChangePlan` with objective, non-goals, expected files, risks, acceptance criteria, and validation commands.
- Plan approval policy: human approval by default for medium/high-risk changes; automatic acceptance allowed only for bounded chores.
- Plan-to-build contract tests.
- Independent reviewer receives plan, diff, and validation evidence, not the builder's full conversation.
- Review findings route back to the build session with bounded attempts.
- Final result packages plan, diff summary, validation report, review, and commit.

## Non-goals

- No task DAG or recursive decomposition.
- No parallel agents.
- No worktrees.
- No ticket automation.

## Acceptance criteria

- [ ] The plan is stored before repository mutation.
- [ ] Every acceptance criterion maps to deterministic evidence or an explicit human judgment.
- [ ] The builder cannot silently expand scope beyond the approved plan.
- [ ] Reviewer and builder contexts are separate.
- [ ] Trivial changes may use a documented fast path.
- [ ] Human review can reject the commit and preserve all evidence.

## Exit gate

Advance when representative changes have stable plan/build/review contracts and failures increasingly arise because one context or one task is too large.
