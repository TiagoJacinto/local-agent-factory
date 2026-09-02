# SSSF architecture

The installed runtime contains `run.ts`, canonical Factory modules under `factory/modules`, workflow skills, configuration, evidence, and SQLite trace data.

A workflow is a registered `WorkflowDefinition` with a local controller. Controllers compose `WorkflowContext` operations:

- `phase` records intent and lifecycle.
- `ai` invokes the configured agent runtime and records typed artifacts.
- `gate` validates required evidence.
- `command` runs deterministic checks in the disposable workspace.
- `review` waits for an explicit human integration decision.

The supported change-delivery IDs are prompt, scout, plan, prewalk, build, quality, build-review, double-tdd, document, research, prd-oriented-design, and prd-oriented-discovery. Source-changing workflows require a clean Git source and expected revision; execution happens in an independent clone. The evidence manifest and SQLite trace are the durable run record.
