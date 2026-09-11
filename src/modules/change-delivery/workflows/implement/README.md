# Implement with TDD

Implements a specification in an isolated Factory workspace using ordinary red-green cycles, then publishes and follows one pull request.

## Interface

The workflow is registered as `implement`. Its request is a specification path relative to or visible from the disposable workspace.

## Invariants

The Factory creates the disposable workspace before controller phases begin. The builder receives a seam proposal and must write one behavioral test before each production change. The workflow runs the fast test suite before publication, never merges, and delegates pull-request follow-up to the shared pull-request module.

## Verification

```bash
bunx vitest run src/modules/change-delivery/tests/workflows.test.ts
```
