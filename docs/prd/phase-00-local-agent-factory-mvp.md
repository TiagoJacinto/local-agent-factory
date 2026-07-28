# PRD Phase 0: Manual local build-and-lint MVP

## Product promise

A human provides one bounded change request. One coding agent changes a clean local repository clone. Deterministic code runs one validation command. Failure feedback returns to the same logical coding session for a bounded number of attempts. The system creates a reviewable commit but never merges or pushes automatically.

This is the smallest end-to-end AI developer workflow and the base inherited by every later phase.

## Human evolution represented

This phase mirrors the first useful human workflow:

```text
Engineer request → build agent → deterministic lint → engineer review
                              ↑          │
                              └── fail ──┘
```

The engineer remains at both constraints of the workflow: initial intent and final validation.

## Goals

- Run fully on one developer machine.
- Complete one real vertical slice instead of proving only infrastructure.
- Keep agent work and deterministic validation as separate steps.
- Preserve one logical coding session across bounded correction attempts.
- Produce a local commit and workspace for human inspection.
- Keep framework and coding-agent integrations replaceable.

## Non-goals

- No planning agent or task decomposition.
- No specialist agents.
- No Git worktree parallelism.
- No containers or VM sandboxes.
- No GitHub webhook automation.
- No automatic merge, push, deployment, or self-learning.

## Functional requirements

- Local HTTP/CLI request containing repository path, objective, allowed paths, and one optional validation command.
- SQLite inbox for duplicate request protection and basic local recovery evidence.
- One `CodingWorkerPort` implementation using an isolated local Git clone.
- Demo worker for offline tests and one configurable coding-agent command adapter.
- Validation owned by factory code, not hidden inside the agent skill.
- Maximum correction-attempt limit and wall-clock timeout.
- Changed-file allowlist verification.
- Local JSONL trace with request, attempts, commands, result, commit, and workspace.
- Human review required before any integration.

## Local robustness requirements

- Source repository must be clean and committed.
- Source HEAD is checked before execution and remains unchanged.
- Agent works in `.factory/workspaces/<run-id>`.
- Validation failures cannot create a successful commit.
- No host secrets are intentionally forwarded beyond the explicit coding-agent process environment.
- A failed run leaves inspectable evidence rather than silently deleting the workspace.

## Acceptance criteria

- [ ] One local request invokes the coding worker.
- [ ] A deterministic validation command runs outside the agent.
- [ ] Validation failure is returned for a bounded correction attempt.
- [ ] A successful run creates a commit in an isolated local clone.
- [ ] The source repository HEAD and working tree remain unchanged.
- [ ] Disallowed file changes block success.
- [ ] The result includes workspace path, branch, commit, commands, and attempts.
- [ ] A human must explicitly integrate the result.

## Exit gate

Advance only after at least ten representative small changes can be run manually end to end and the team can explain every step, failure, and artifact without relying on hidden agent behavior.

## Replaceability requirements

The workflow depends on `CodingWorkerPort`, not a specific CLI. Claude Code, Codex, OpenCode, Gemini CLI, or another worker can replace the command adapter after passing the same contract tests.
