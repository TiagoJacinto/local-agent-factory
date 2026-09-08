---
name: rpi-implement-outline
description: Implement a HumanLayer structure outline through the registered implement-outline Workflow.
---

# Implement an outline

The `implement-outline` Workflow is the canonical execution path for this capability. It combines this skill with `rpi-describe-pr`, deterministic validation, stacked pull-request publication, visual evidence, and pull-request feedback handling.

## Contract

Invoke the registered `implement-outline` Workflow with the structure-outline path as its request. The Workflow:

1. Reads `## Phase N: Title` sections in order.
2. Creates a fresh builder-agent invocation for each phase.
3. Runs declared validation commands as deterministic Command Primitives.
4. Sends failed command evidence to a bounded fresh repair invocation.
5. Captures declared before/after media for UI phases.
6. Creates one stacked pull request per verified phase.
7. Processes each new pull-request comment once with a fresh reviewer invocation.
8. Stops in `AwaitingIntegration`; it never merges.

The predecessor pull request is the base of the next phase branch. A failed phase prevents all descendant phases from starting.

## Outline syntax

Use headings such as:

```markdown
## Phase 1: Add the account panel

Validation: `bun test -- account-panel`
Changes UI: yes
Before capture: `agent-browser screenshot captures/account-before.png`
After capture: `agent-browser screenshot captures/account-after.png`
```

Validation commands must be explicit. The Workflow treats command output and exit status as evidence, not as agent interpretation.

## Boundaries

The Workflow owns sequencing, retries, branch ordering, PR publication, comment deduplication, and evidence. Agents implement or assess one bounded request at a time. Human integration remains the final authority.
