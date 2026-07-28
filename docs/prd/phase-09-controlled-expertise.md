# PRD Phase 9: Controlled expertise and trace mining

## Summary

Turn evaluated experience into scoped, versioned candidate lessons, examples, skills, prompts, tool descriptions, and policies. Agents become specialists through controlled evidence, not unrestricted self-modification.

## Inherits

Phase-8 datasets and evaluation gates are mandatory. No learned artifact can bypass deterministic quality, security, or human-approval policies.

## Progression gate

**Add when:** Repeated failure classes and successful patterns are visible across a statistically useful set of evaluated runs.

**Do not add when:** Outcomes are weakly labeled or evaluators are not trusted.

## Goals

- Encode engineering expertise into reusable role artifacts.
- Scope knowledge by repository, language, framework, role, and workflow.
- Mine both failures and exemplary runs.
- Evaluate retrieval, prompt, skill, and tool-schema changes offline.
- Promote through approval, canary, and rollback.

## Functional requirements

- Candidate lesson schema with provenance, evidence, scope, confidence, owner, expiry, and rollback state.
- Trace-mining jobs for human corrections, repeated failures, expensive paths, reverts, and excellent runs.
- Versioned expert-role packages containing instructions, examples, skills, and retrieval policy.
- Prompt/tool/workflow optimization adapter using Opik, DSPy, Future AGI, custom optimization, or equivalent.
- Training, validation, holdout, and adversarial datasets.
- Human approval for broad, security-sensitive, or policy-changing artifacts.
- Canary role versions and immediate rollback.
- Memory-retrieval evaluations for relevance and harmful interference.

## Non-goals

- No direct model-weight training initially.
- No automatic ingestion of every trace into permanent memory.
- No promotion based on one evaluator or one task.

## Acceptance criteria

- [ ] A corrected trace produces a reviewable candidate artifact.
- [ ] Worse candidates are rejected on holdout or safety regression.
- [ ] Every active lesson has provenance and an owner.
- [ ] Prompt-injection text cannot become expertise without sanitization and approval.
- [ ] A candidate expert can receive limited traffic and be rolled back.
- [ ] Measurable repeated failure classes decline without broader regression.

## Exit gate

Advance when multiple approved models or inference routes exist and manual model selection creates recurring cost, latency, availability, or quality problems.
