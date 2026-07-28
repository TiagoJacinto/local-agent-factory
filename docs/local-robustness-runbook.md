# Local operations runbook

## Phase-0 state

- `.factory/factory.db`: local request duplicate guard.
- `.factory/traces.jsonl`: basic execution traces.
- `.factory/workspaces/<run-id>/`: retained isolated clone containing the factory commit.
- `.factory/workspaces/prompts/`: transient prompt payloads; removed after runs.

The source repository is not modified by Phase 0.

## Backups

- Stop the API before copying SQLite for the simplest consistent backup.
- Back up `.factory/factory.db`, `.factory/traces.jsonl`, `.env`, and any retained workspaces still under review.
- Back up source repositories independently; they remain the authoritative product history.
- Keep at least one backup on another physical disk.
- Test restore by starting the API against restored state and running a read-only inspection.

Later phases add runtime-native and PostgreSQL backups only when those components are introduced.

## Phase-0 smoke test

1. Create or select a clean committed local Git repository.
2. Start the API in demo mode.
3. Call `/api/v1/runs/local` with `allowed_paths=["factory-output/**"]`.
4. Verify success and `human_review_required=true`.
5. Inspect the returned workspace, branch, diff, and commit.
6. Verify the source repository HEAD and working tree are unchanged.
7. Verify a JSONL trace was written.
8. Repeat with a failing validation command and verify no successful commit result is returned.
9. Repeat with a disallowed path and verify the run is blocked.

## Phase-0 failure drills

1. Dirty the source repository and verify the worker blocks.
2. Change source HEAD after constructing the request and verify expected-SHA protection.
3. Exhaust the correction-attempt limit.
4. Exhaust the process timeout.
5. Kill the API and document that Phase 0 does not promise mid-run durable resumption.
6. Restore SQLite and traces from backup.
7. Rebuild the local environment using only repository files and documented configuration.

## Phase-specific drills

- Phase 1: gate ordering, false-failure handling, shared retry budget.
- Phase 4: stale worktrees, merge conflicts, post-merge failures.
- Phase 5: filesystem escape, secret isolation, network denial, sandbox cleanup.
- Phase 6: duplicate/reordered events, restart after side effect, dead letter, reconciliation.
- Phase 8: trace sink outage, redaction, reproducible regression cases.
- Phase 9: harmful lesson retrieval, candidate rollback, prompt-injection provenance.
- Phase 10: provider outage, fallback, privacy routing, retry stacking.
- Phase 11: worker loss, capacity saturation, backup restore, runtime upgrade/downgrade.
