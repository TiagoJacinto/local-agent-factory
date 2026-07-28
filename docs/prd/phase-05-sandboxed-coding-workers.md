# PRD Phase 5: Sandboxed coding workers

## Summary

Replace worktree-only execution with disposable local containers or VMs while preserving the same `CodingWorkerPort`. Each agent receives its own controlled computer-like environment.

## Inherits

Task planning, parallel scheduling, merge gates, and deterministic validation remain stable. The workspace adapter changes.

## Progression gate

**Add when:** Worktrees cannot safely isolate dependencies, generated commands, secrets, networking, or incompatible toolchains.

**Do not add when:** Worktree execution remains safe, reproducible, and faster to operate.

## Goals

- Isolate filesystem, process, dependency, and network effects.
- Allow humans to enter or inspect a retained failed sandbox.
- Standardize worker inputs and outputs across coding-agent CLIs.
- Support at least two interchangeable coding workers.
- Keep local startup and recovery straightforward.

## Functional requirements

- Container-based sandbox adapter first; optional local VM adapter later.
- Read-only source seed and disposable writable workspace.
- CPU, memory, disk, process, wall-clock, and network limits.
- Explicit secret mounts and egress allowlists.
- Standard coding-agent task/result protocol.
- Adapters for at least two workers such as Claude Code, Codex, OpenCode, Gemini CLI, or AgentField Harness.
- Snapshot or retain-on-failure option for human inspection.
- Deterministic artifact extraction, commit creation, and cleanup.

## Non-goals

- No Kubernetes requirement.
- No remote multi-tenant execution.
- No production deployment privileges.

## Acceptance criteria

- [ ] Host files outside mounted paths are inaccessible.
- [ ] Host secrets are absent unless explicitly provided.
- [ ] Network is disabled by default.
- [ ] A worker timeout terminates the sandbox.
- [ ] A failed sandbox can be retained and inspected locally.
- [ ] Two coding-agent adapters pass the same contract suite.
- [ ] Worktree adapter remains available as a rollback path.

## Exit gate

Advance when the internal workflow is dependable enough that external tickets and repository events should start or resume it automatically.
