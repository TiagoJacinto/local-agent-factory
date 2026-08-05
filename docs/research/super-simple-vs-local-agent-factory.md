# Super Simple Software Factory vs Local Agent Factory

## Scope

Reviewed:

- Super Simple Software Factory (`main` at commit [`de313748`](https://github.com/disler/super-simple-software-factory/tree/de31374882e7a4e3e5b7bb9bd09e69dc2f779356)).
- The local repository source, tests, and recent commit [`b45c095`](https://github.com/TiagoJacinto/local-agent-factory/commit/b45c095bd1213d4a5a420d0365e13d4f7312a3b73).
- All local GitHub issues. Issue status and scope were read on 2026-08-04.

Primary sources:

- [SSSF README](https://github.com/disler/super-simple-software-factory/blob/de31374882e7a4e3e5b7bb9bd09e69dc2f779356/README.md)
- [SSSF skill rules](https://github.com/disler/super-simple-software-factory/blob/de31374882e7a4e3e5b7bb9bd09e69dc2f779356/.claude/skills/sssf/SKILL.md)
- [Local workflow source](https://github.com/TiagoJacinto/local-agent-factory/blob/main/src/workflow.ts)
- [Local PRD issue #7](https://github.com/TiagoJacinto/local-agent-factory/issues/7)

## Important answer about dates

The local issues do **not** contain calendar dates, sprint dates, or delivery estimates.

The PRD says that Phase 0 is the current implementation focus, Phase 1 is the first candidate for promotion, and later phases are configurable priorities. Issues #10–#22 are explicitly **roadmap only** and say that implementation is not authorized until each phase is promoted and fully specified.

Therefore, the honest answer for every open feature below is: **no implementation date is published**. The issue number gives the planned phase, not a date.

## What local agent factory already has

1. A typed workflow controller and executor.
2. System-owned `AI`, `Harness`, and `Gate` primitives.
3. Ordered invocation results and named artifacts shared through a run context.
4. Dirty-source and unexpected-revision checks.
5. Disposable clone workspaces, source-revision metadata, and failed-workspace retention.

The first four kernel items are covered by closed issues [#1](https://github.com/TiagoJacinto/local-agent-factory/issues/1) and [#23](https://github.com/TiagoJacinto/local-agent-factory/pull/23). Source-revision safety was delivered by merged [PR #24](https://github.com/TiagoJacinto/local-agent-factory/pull/24), related to [issue #2](https://github.com/TiagoJacinto/local-agent-factory/issues/2).

The local CLI currently exposes only a `greet` command. It does not yet run a workflow from a repository and objective.

## SSSF features missing from local agent factory

| SSSF feature | Local status | Local issue / planned time |
| --- | --- | --- |
| **Run a real coding agent through a replaceable adapter.** SSSF runs Pi agents in the workspace, selects a model per agent, and passes prompts and tools to the agent. | Missing. Local adapters are deterministic by default; the CLI does not yet run a coding agent. | [#3](https://github.com/TiagoJacinto/local-agent-factory/issues/3). Open; no date. |
| **One run command.** SSSF provides `adw_*.py` commands and accepts a prompt, agent, config, and resumable run ID. | Missing. Local CLI has no workflow-run command. | [#6](https://github.com/TiagoJacinto/local-agent-factory/issues/6). Open; no date. |
| **A typed change-plan product.** SSSF has planner output with objective, risks, expected files, acceptance criteria, and validation commands. | Missing as a product workflow. | [#10](https://github.com/TiagoJacinto/local-agent-factory/issues/10). Roadmap only; no date. |
| **Typed JSON envelopes between agents.** SSSF parses a declared output type, stores an envelope, and passes it to the next phase. | Missing. Local artifacts are typed in the executor, but there is no agent envelope protocol. | Mainly [#5](https://github.com/TiagoJacinto/local-agent-factory/issues/5), [#10](https://github.com/TiagoJacinto/local-agent-factory/issues/10), and [#14](https://github.com/TiagoJacinto/local-agent-factory/issues/14). All open; no date. |
| **Correction loops in the same agent session.** Invalid JSON and gate failures re-prompt the same session instead of restarting it. | Missing. | [#13](https://github.com/TiagoJacinto/local-agent-factory/issues/13) covers review findings returning to the builder. There is no exact issue for all SSSF parse and gate correction behavior. No date. |
| **Configurable deterministic validation.** SSSF runs formatter, lint, type-check, test, and repository commands as code, with bounded test/fix loops. | Missing. Local has a Gate primitive, but no configurable command pipeline. | [#11](https://github.com/TiagoJacinto/local-agent-factory/issues/11). Roadmap only; no date. |
| **Independent review and review-to-build revision.** SSSF sends the plan, diff, and validation evidence to a reviewer, then sends findings back to the builder and retests changed code. | Missing. | [#12](https://github.com/TiagoJacinto/local-agent-factory/issues/12) and [#13](https://github.com/TiagoJacinto/local-agent-factory/issues/13). Roadmap only; no date. |
| **Specialist roster.** SSSF ships planner, builder, scout, reviewer, and documenter roles; its examples also include testing and quality responsibilities. Each role can have its own model, prompt, tools, and write boundary. | Missing. Local has no role registry or live agent roster. | [#16](https://github.com/TiagoJacinto/local-agent-factory/issues/16) plans scout, planner, builder, tester, reviewer, and security roles. [#3](https://github.com/TiagoJacinto/local-agent-factory/issues/3) covers the adapter. Roadmap only; no date. `documenter` has no exact local issue. |
| **Prebuilt workflow library.** SSSF ships 12 starter ADWs, including prompt, scout, plan, build, quality, plan-build-test, build-review, document, and simple SDLC flows. | Missing. Local has a workflow executor, but no starter workflow library. | [#19](https://github.com/TiagoJacinto/local-agent-factory/issues/19) plans a registry for chore, bug, feature, hotfix, and security controllers. Roadmap only; no date. |
| **Bounded task decomposition.** SSSF does not expose the full local task-graph feature, but its multi-phase chains provide bounded plan/build/test/review work. | Missing. | [#15](https://github.com/TiagoJacinto/local-agent-factory/issues/15). Roadmap only; no date. |
| **Parallel independent tasks and integration.** SSSF README identifies branch-per-run, sandbox, and merge as future work, so this is not a shipped SSSF feature. Local plans the stronger version. | Missing locally, but not a current SSSF feature. | [#17](https://github.com/TiagoJacinto/local-agent-factory/issues/17) and [#18](https://github.com/TiagoJacinto/local-agent-factory/issues/18). Roadmap only; no date. |
| **Persistent resumable sessions.** SSSF uses `--adw-id`, `agent_map.json`, session directories, and the same agent context for chained workflows. | Missing. Local run IDs are returned, but there is no persistent session store or agent-session resume. | No exact local issue. [#20](https://github.com/TiagoJacinto/local-agent-factory/issues/20) covers routing feedback to an active run, but not the full session system. Not scheduled. |
| **SQLite event trace and live visualizer.** SSSF records sessions, phases, envelopes, gates, agent sessions, processes, and tool calls in SQLite and includes a read-only Vue/Vite visualizer. | Missing. Local returns in-memory run results and has no SQLite trace or UI. | No exact local issue. [#5](https://github.com/TiagoJacinto/local-agent-factory/issues/5) asks for a reviewable handoff and evidence, but does not specify a trace database or UI. Not scheduled. |
| **Reusable install-and-stamp package.** SSSF is a Claude skill with `install.py`, templates, cookbooks, references, a config generator, and a `justfile`; it can stamp the factory into another repository. | Missing. Local is a TypeScript package/repository, not an install-and-stamp skill. | No matching local issue. Not scheduled. |
| **Per-agent permissions and protected files.** SSSF enforces `writes` and `protected_files` after every agent call and rolls back unauthorized changes. | Missing. Local has workspace isolation, but no agent write policy or protected-path enforcement. | No exact local issue. [#14](https://github.com/TiagoJacinto/local-agent-factory/issues/14) plans role-specific context; [#22](https://github.com/TiagoJacinto/local-agent-factory/issues/22) plans scoped expert-role packages. Neither explicitly promises write rollback. No date. |
| **Commit and document phases.** SSSF can commit the plan, verified code, and documentation as separate code-owned phases. | Missing as an end-to-end workflow. Local does not yet create a review handoff or integrate changes automatically. | [#5](https://github.com/TiagoJacinto/local-agent-factory/issues/5) plans the human handoff; [#18](https://github.com/TiagoJacinto/local-agent-factory/issues/18) plans integration. Both open; no date. |

## Bottom line

- Local Agent Factory has the small typed workflow kernel and source safety foundation.
- SSSF is much further ahead on the usable agent-factory product: live agent execution, agent configuration, typed envelopes, correction loops, validation loops, role chains, starter workflows, session resume, trace storage, and visual observation.
- The closest local roadmap matches are #3, #5, #6, and #10–#19.
- SSSF-specific features with **no direct local issue** are the install-and-stamp package, SQLite/visualizer, full resumable agent sessions, and explicit per-agent write rollback.
- No local issue promises a calendar delivery date. Any date would be an estimate, not information in the issue tracker.
