# PRD Phase 10: Model routing and compute optimization

## Summary

Replace hard-coded model choices with capability aliases and policy-aware routing across local vLLM and approved external providers. Route by measured quality, privacy, modality, context, cost, and latency.

## Inherits

Specialized workflows request capabilities. Evaluation data provides the evidence used to approve routes. The workflow runtime remains owner of side-effect retries.

## Progression gate

**Add when:** At least two routes have representative evaluation results and manual selection is a measurable burden.

**Do not add when:** One model reliably satisfies all tasks.

## Goals

- Prefer local inference where it meets quality and privacy requirements.
- Separate model routing from agent and workflow code.
- Support provider fallback without duplicated external effects.
- Introduce semantic routing only after deterministic role routing has a baseline.
- Make every route decision auditable.

## Functional requirements

- Capability aliases such as `factory/scout`, `factory/fast-code`, `factory/deep-plan`, `factory/review`, and `factory/vision`.
- vLLM OpenAI-compatible local serving.
- One gateway adapter such as LiteLLM, Bifrost, Portkey, or equivalent.
- Optional CLIProxyAPI adapter only for approved OAuth-backed upstreams.
- Routing policy using role, workflow, modality, context size, sensitivity, budget, availability, and measured evaluation score.
- Fallback, rate limits, circuit breakers, cost accounting, and trace attributes.
- Optional vLLM Semantic Router or custom classifier after offline route evaluation.
- Route canary and rollback.

## Non-goals

- No routing sensitive code to unapproved external providers.
- No provider retry logic duplicated inside every agent.
- No cheapest-model optimization without quality constraints.

## Acceptance criteria

- [ ] A role changes model route without application-code changes.
- [ ] Provider failure uses an approved fallback.
- [ ] Sensitive tasks remain on approved routes.
- [ ] Route reason and actual model appear in traces.
- [ ] Routing changes pass evaluation before promotion.
- [ ] Gateway retries cannot repeat completed workflow effects.

## Exit gate

Advance when one local machine or one repository at a time is a demonstrated capacity or product limitation.
