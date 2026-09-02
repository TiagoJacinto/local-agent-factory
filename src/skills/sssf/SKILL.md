---
name: sssf
description: Run and monitor registered change-delivery workflows through the local factory runtime.
---

# SSSF

SSSF runs registered change-delivery workflows through the canonical Factory. Start by listing installed `adws/factory/modules/change-delivery/workflows/` definitions and choose one workflow ID for the operator request.

## Supported workflows

| Workflow               | Purpose                             |
| ---------------------- | ----------------------------------- |
| prompt                 | bounded agent request               |
| scout                  | read-only repository mapping        |
| plan                   | implementable plan                  |
| prewalk                | bounded planning handoff            |
| build                  | implementation with human review    |
| quality                | deterministic validation            |
| build-review           | bounded build/review/revise loop    |
| double-tdd             | acceptance and unit TDD loop        |
| document               | diff capture and documentation      |
| research               | scoped RPI research                 |
| prd-oriented-design    | PRD then technical design           |
| prd-oriented-discovery | research followed by PRD and design |

## Operating contract

Workflows are local typed `WorkflowDefinition` modules with request/result contracts, controller, README, and tests. Controllers compose `WorkflowContext.phase`, `ai`, `gate`, `command`, and `review`. The distributed `run.ts` entrypoint invokes the selected workflow ID and maps Factory status to process exit code.

AI calls use configured agent owners and generic success/fail envelopes. Artifact handoffs are explicit and appear in the evidence manifest. Deterministic checks use `command`; human decisions use `review`. Source-changing workflows require a clean Git source, expected revision, and an independent disposable workspace. Agent permissions enforce configured writes and protected paths.

## Where to read next

- [references/config.md](references/config.md) — roster, paths, credentials, and permissions.
- [references/handoff.md](references/handoff.md) — typed artifact handoffs and gates.
- [references/observability.md](references/observability.md) — evidence manifests and SQLite traces.
- [cookbooks/create_adw.md](cookbooks/create_adw.md) — add a workflow.
- [cookbooks/update_modules.md](cookbooks/update_modules.md) — extend canonical ports/adapters.
- [cookbooks/install.md](cookbooks/install.md) — package and install the skill.

Do not inspect unrelated run history before receiving the request. Ask for the request, route it to one supported workflow, and report the resulting status and evidence.
