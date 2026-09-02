# Update canonical modules

Put reusable behavior behind the canonical Factory seams:

- `src/modules/workflow-execution/domain/` — phase, workflow, handoff, budget, and evidence contracts.
- `src/modules/workflow-execution/ports/` — agent runtime, workspace, command, artifact, human review, and trace ports.
- `src/modules/workflow-execution/adapters/` — Git workspace, local process/permissions, SQLite trace, deterministic test trace, and filesystem artifacts.
- `src/modules/change-delivery/adapters/` — configured-agent, Pi/OpenCode, and workflow-skill adapters.
- `src/modules/change-delivery/workflows/<workflow>/` — workflow-local state, request/result contracts, controller, README, and tests.

Do not add provider calls, subprocesses, or persistence to `run.ts`. Keep those concerns in the Factory modules; `run.ts` only invokes the selected workflow ID. Use typed ports so tests can inject deterministic adapters. Every phase has a meaningful description and every artifact handoff names its producer and consumer. Run typecheck, focused tests, and `check:skill` after changes.
