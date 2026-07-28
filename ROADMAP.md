# Platform progression roadmap

## Governing idea

This roadmap follows the way a careful engineering team would evolve an AI developer workflow in practice:

1. prove one small human-agent-code loop;
2. add deterministic checks before adding more agents;
3. make planning and review explicit;
4. split contexts only when one context becomes too large;
5. parallelize only after tasks are genuinely independent;
6. replace worktrees with sandboxes only when isolation problems are real;
7. automate ticket and PR events only after the internal workflow is trustworthy;
8. create specialized workflows only after work classes differ materially;
9. add evaluations before learning;
10. add model routing only after multiple routes are measured;
11. distribute only after one machine becomes a demonstrated limit.

## Progression rule

Phase 0 is the usable MVP. Every later phase must:

- preserve the prior vertical slice;
- solve a measured failure or repeated human burden;
- add one primary capability;
- keep control flow in factory code rather than hidden inside prompts or skills;
- keep deterministic checks separate from agent execution;
- define entry, exit, rollback, and removal conditions;
- pass every earlier phase's contract and acceptance tests.

## Phase 0 — Manual local build-and-lint MVP

One human request, one coding worker, one deterministic validation loop, one reviewable local commit, and mandatory human review.

**Exit:** Ten representative small changes can be explained and reviewed end to end.

## Phase 1 — Deterministic quality loop

Add formatter, lint, type-check, and test gates one at a time. Factory code owns the loop and returns failures to the same logical coding session.

**Exit:** Routine mechanical defects are usually caught before human review.

## Phase 2 — Explicit plan-build-test-review workflow

Add a typed plan, scope, acceptance criteria, optional independent reviewer, and human approval policy.

**Exit:** Failures are increasingly caused by task size or missing specialist context rather than vague intent.

## Phase 3 — Specialist agents and bounded decomposition

Add scout, planner, builder, tester, reviewer, and security roles only where useful; support bounded subagents, RLM-style decomposition, and task graphs.

**Exit:** Independent tasks exist that humans would naturally run in parallel.

## Phase 4 — Parallel worktrees and merge gate

Use one worktree per independent task, parallel dependency levels, conflict prediction, integration merging, and full post-merge validation.

**Exit:** Worktree limitations become concrete.

## Phase 5 — Sandboxed coding workers

Move workers into disposable local containers or VMs with resource, secret, and network controls; support at least two worker adapters.

**Exit:** The internal workflow is reliable enough to automate external ticket lifecycles.

## Phase 6 — Ticket and event-driven workflow

Connect GitHub issues, comments, PRs, reviews, pushes, and CI; add durable execution, idempotent side effects, reconciliation, MCP, and the `/factory` skill.

**Exit:** Varied work types need materially different workflows.

## Phase 7 — Workflow router and specialized factories

Add chore, bug, feature, hotfix, refactor, and security workflows with different agents, checks, budgets, and human gates.

**Exit:** Multiple workflow and agent variants cannot be compared reliably by inspection alone.

## Phase 8 — Observability and evaluation

Add OpenTelemetry, local traces, datasets, deterministic/model/human evaluators, trajectory scoring, and regression gates.

**Exit:** Enough trustworthy evaluated history exists to build expertise safely.

## Phase 9 — Controlled expertise and trace mining

Mine evaluated traces into scoped candidate lessons, skills, prompts, examples, and policies; promote through holdouts, approval, canary, and rollback.

**Exit:** Multiple approved model routes exist and manual selection is a measurable burden.

## Phase 10 — Model routing and compute optimization

Add capability aliases, vLLM, one provider gateway, fallback, budgets, privacy policy, and only then semantic routing.

**Exit:** One machine or one repository at a time is a demonstrated limit.

## Phase 11 — Multi-repository and multi-worker scale

Coordinate dependent repositories, additional worker machines, versioned active workflows, canaries, and disaster recovery while retaining local mode.

**Exit:** Ongoing; every scale step requires measured evidence.
