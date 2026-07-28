# PRD Phase 4: Parallel worktrees and merge gate

## Summary

Run independent implementation tasks concurrently in separate Git worktrees. Add deterministic dependency levels, file-conflict detection, integration merging, and post-merge validation.

## Inherits

Planning, task decomposition, specialist contexts, and validation remain unchanged. Only execution scheduling and workspace isolation evolve.

## Human evolution represented

```text
Approved task graph → worktree per independent task → parallel build/validate
                                          ↓
                               merge gate → integration tests → human review
```

## Progression gate

**Add when:** The task graph consistently contains independent work and sequential execution materially delays completion.

**Do not add when:** Tasks overlap heavily or merge conflicts cost more than the parallel speedup.

## Goals

- Scale compute without allowing workers to overwrite each other.
- Keep one branch and worktree per task.
- Detect likely file conflicts before parallel dispatch.
- Integrate only validated commits.
- Preserve a complete merge and provenance trail.

## Functional requirements

- Deterministic topological levels for parallel execution.
- Worktree lifecycle manager with cleanup and stale recovery.
- Per-task branch and expected base SHA.
- Static file-manifest conflict detection before dispatch.
- Merge gate owned by factory code, not individual workers.
- Conflict-resolution policy with human fallback.
- Full validation after integration, even when every task passed independently.
- Concurrency and resource limits suitable for one local machine.

## Non-goals

- No container or VM isolation yet.
- No arbitrary distributed workers.
- No race-to-first hotfix strategy.

## Acceptance criteria

- [ ] Independent tasks run concurrently in distinct worktrees.
- [ ] Two workers cannot write the same worktree.
- [ ] Predicted file conflicts are serialized or explicitly approved.
- [ ] Failed tasks do not block preservation of successful task commits.
- [ ] Integration validation catches cross-task failures.
- [ ] The complete workflow can fall back to sequential execution.

## Exit gate

Advance when worktree limitations become concrete: dependency contamination, host-risk concerns, conflicting toolchains, resource leakage, or a need to inspect fully isolated environments.
