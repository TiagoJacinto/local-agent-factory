# PRD Phase 11: Multi-repository and multi-worker scale

## Summary

Scale the locally proven software factory only after its workflows, evaluations, and recovery behavior are stable. Add coordinated repositories, additional worker machines, platform canaries, and stronger disaster recovery without changing established domain contracts.

## Inherits

Every prior workflow remains runnable on one local machine as a degraded or development mode.

## Progression gate

**Add when:** Measured workloads require multi-repository coordination, additional compute, stronger availability, or concurrent projects beyond one machine's safe capacity.

**Do not add when:** Scale is hypothetical.

## Goals

- Coordinate dependent repository changes and validation.
- Schedule workers by capability, trust level, and available resources.
- Preserve local backup, restore, and debugging.
- Version and canary agents, workflows, gateways, and runtimes.
- Maintain explicit compatibility for active durable executions.

## Functional requirements

- Cross-repository task and dependency graph.
- Integration branches and combined validation environments.
- Worker registration, health, leases, cancellation, and lost-worker recovery.
- Artifact and result caching with content hashes.
- Versioned workflow definitions and active-run compatibility policy.
- Platform and agent canary rollout with rollback.
- Capacity, chaos, backup, restore, upgrade, and downgrade tests.
- Migration playbooks among DBOS, Restate, Inngest, Temporal, Hatchet, or retained incumbent runtime.
- Defined RTO, RPO, queue, latency, and cost objectives.

## Non-goals

- No global distributed architecture without demonstrated value.
- No silent migration of active workflows.
- No dependency on one coding-agent or model provider.

## Acceptance criteria

- [ ] Dependent repositories are changed and validated in correct order.
- [ ] Worker loss does not lose durable progress or duplicate side effects.
- [ ] A component version receives canary traffic and can be rolled back.
- [ ] A full local backup restores a working control plane and run history.
- [ ] Capacity tests define safe concurrency limits.
- [ ] One noncritical adapter replacement is demonstrated end to end.

## Long-term rule

Scale compute and automation only where the workflow has already earned trust through deterministic checks, evaluation evidence, and explicit recovery behavior.
