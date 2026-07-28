# PRD Phase 6: Ticket and event-driven developer workflow

## Summary

Connect the proven local workflow to GitHub issues, comments, PRs, reviews, pushes, and CI. Introduce durable event handling only now, because external events, long waits, and irreversible side effects create a measured need for it.

## Inherits

The same factory workflow runs whether invoked manually or by an event. GitHub is an ingress and side-effect adapter, not the owner of agent logic.

## Human evolution represented

```text
Ticket/event → move status → scout/plan/build/test/review workflow → PR evidence → human decision
```

## Progression gate

**Add when:** Humans repeatedly copy ticket information into the factory or manually resume work after reviews and CI results.

**Do not add when:** The workflow is still changing too quickly to automate its external lifecycle.

## Goals

- Start work from a ticket without manual re-entry.
- Resume the correct run from PR feedback and CI.
- Handle duplicates, reordering, restarts, and stale commits safely.
- Keep humans in approval positions appropriate to risk.
- Expose a curated MCP/API surface and `/factory` coding-agent skill.

## Functional requirements

- GitHub App/webhook adapter with signature verification and delivery deduplication.
- Event support for issues, issue comments, pull requests, reviews, inline comments, review threads, check runs, check suites, and workflow runs.
- Durable runtime adapter using DBOS, Restate, Inngest, Temporal, or equivalent after a local fault-test comparison.
- Per-repository/PR concurrency keys and expected-head-SHA checks.
- Cancellation or supersession when newer commits invalidate active work.
- Idempotency keys for comments, branches, commits, labels, and PR writes.
- Retry classification, backoff, jitter, deadlines, reconciliation, and dead-letter state.
- Self-trigger suppression for factory-authored events.
- Curated MCP tools for capability discovery, run start/status/wait/cancel, and feedback.
- Versioned `/factory` coding-agent skill that discovers and reuses capabilities.

## Non-goals

- No automatic workflow selection among many specialized factories yet.
- No automatic merge by default.
- No public unauthenticated MCP endpoint.

## Acceptance criteria

- [ ] Duplicate deliveries create one logical action.
- [ ] A new PR head supersedes work against the old SHA.
- [ ] Restart after a completed external write does not duplicate the write.
- [ ] A review comment creates one bounded remediation task.
- [ ] Factory-authored comments do not cause an event loop.
- [ ] A coding agent can discover and invoke an authorized factory capability.
- [ ] Missed events can be reconciled from GitHub state.

## Exit gate

Advance when the system receives varied work types and one universal workflow is either too expensive, too slow, or poorly matched to risk.
