# Implement outline

Public interface: `implementOutlineWorkflow`, registered as `implement-outline`.

This Workflow reads a structure outline from the request path, implements phases in order with fresh builder sessions, runs each phase's declared validation commands, and publishes one stacked pull request per verified phase. A failed validation receives its bounded command evidence in a fresh repair invocation; publication never occurs before validation passes.

Outline phases use `## Phase N: Title` headings. Validation commands may be declared as `Validation: \`command\``or`$ command`. UI phases may declare`Before capture: \`command\``and`After capture: \`command\``. The capture commands own browser navigation and media creation; the Workflow installs the`before-and-after` skill before visual publication.

The Workflow never merges pull requests. It processes each new PR comment once, serially, and leaves the run awaiting explicit integration review.

Focused verification:

```bash
bunx vitest run src/modules/change-delivery/workflows/implement-outline/outline-parser.test.ts src/modules/change-delivery/tests/workflows.test.ts
```
