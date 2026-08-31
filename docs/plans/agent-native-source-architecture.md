# Agent-native source architecture

## Decision

Rebuild `src/` around Workflow Capabilities. A directory should answer what an engineer or agent can make the Factory do, not which framework, adapter, or implementation technique happens to be involved.

The target has one execution kernel. It replaces the prototype kernel in `src/workflow.ts` and the operational kernel centered on `src/adws/adw_modules/runner.ts`. The new executor retains the operational kernel's real capabilities: workspace safety, phases, typed handoff, agent sessions, deterministic commands, permissions, tracing, and explicit review. It does not preserve either old directory shape as a compatibility layer.

## Target tree

```text
src/
├── modules/
│   ├── workflow-execution/
│   │   ├── CONTEXT.md
│   │   ├── README.md
│   │   ├── index.ts                         # Public Factory facade
│   │   ├── domain/
│   │   │   ├── workflow.ts
│   │   │   ├── phase.ts
│   │   │   ├── handoff.ts                   # Envelope, Artifact, GateReport
│   │   │   ├── run.ts
│   │   │   ├── evidence.ts
│   │   │   └── budget.ts
│   │   ├── application/
│   │   │   ├── execute-workflow/
│   │   │   ├── inspect-run/
│   │   │   ├── decide-integration/
│   │   │   └── run-prewalk/
│   │   ├── ports/
│   │   │   ├── agent-runtime.ts
│   │   │   ├── command-runner.ts
│   │   │   ├── workspace.ts
│   │   │   ├── trace-sink.ts
│   │   │   ├── artifact-store.ts
│   │   │   └── human-gate.ts
│   │   └── adapters/
│   │       ├── git-workspace/
│   │       ├── local-process/
│   │       ├── sqlite-trace/
│   │       └── filesystem-artifacts/
│   │
│   ├── change-delivery/
│   │   ├── CONTEXT.md
│   │   ├── README.md
│   │   ├── index.ts                         # Workflow registration only
│   │   ├── domain/
│   │   │   ├── agent-role.ts
│   │   │   ├── change-plan.ts
│   │   │   ├── validation.ts
│   │   │   └── review.ts
│   │   ├── workflows/
│   │   │   ├── prompt/
│   │   │   ├── scout/
│   │   │   ├── plan/
│   │   │   ├── build/
│   │   │   ├── quality/
│   │   │   ├── build-review/
│   │   │   ├── double-tdd/
│   │   │   ├── document/
│   │   │   ├── research/
│   │   │   ├── prd-oriented-design/
│   │   │   └── prd-oriented-discovery/
│   │   └── adapters/
│   │       ├── pi-agent/
│   │       └── opencode-agent/
│   │
│   └── factory-distribution/
│       ├── CONTEXT.md
│       ├── README.md
│       ├── index.ts
│       ├── application/
│       │   ├── build-skill/
│       │   ├── check-generated-package/
│       │   ├── install-factory/
│       │   ├── package-skill/
│       │   ├── create-workflow/
│       │   └── create-config/
│       └── assets/
│           ├── skill/
│           ├── workflow-skills/
│           └── visualizer/
│
├── entrypoints/
│   ├── cli.ts
│   └── workflows/                         # Thin executable wrappers only
│
└── shared/
    └── core/                              # Types or functions with proven cross-module meaning
```

A workflow directory contains its registration, typed request and result, phase graph, local prompts or prompt references, examples, tests, and `README.md`. A change to `build-review` therefore begins and ends in `modules/change-delivery/workflows/build-review/`, unless it deliberately crosses a declared seam.

## Interfaces

Most callers need one deep module:

```ts
interface Factory {
  execute(request: ExecuteWorkflowRequest): Promise<WorkflowRun>;
  inspect(runId: RunIdentifier): Promise<RunSnapshot>;
  decide(input: IntegrationDecision): Promise<WorkflowRun>;
}
```

Workflow authors use the registration contract:

```ts
interface WorkflowDefinition {
  id: WorkflowId;
  capability: WorkflowCapability;
  describe(): WorkflowDescription;
  controller(context: WorkflowContext): Promise<void>;
}
```

`Factory` hides registry lookup, source checks, workspace creation, phase state, retries, session resumption, evidence persistence, adapter selection, and finalization. A controller receives only the operations required to compose its workflow. It cannot control SQLite, filesystem layout, or provider-specific details.

Ports exist only where production and deterministic test behavior both vary. The first ports are Agent Runtime, Command Runner, Workspace, Trace Sink, Artifact Store, and Human Gate.

## Agent ergonomics requirements

Every module and workflow must meet these requirements before it is considered migrated:

1. **Wayfinding.** `README.md` starts with purpose, public interface, invariant, verification command, and links to the next relevant files.
2. **Locality.** A feature's code, contract, tests, and prompt references live beneath the feature directory.
3. **Legible names.** Directories name capabilities and use cases. `utils`, `helpers`, `common`, `manager`, and `service` are not destination names.
4. **Typed handoff.** Every cross-phase datum is a typed Envelope or Artifact with a producer, consumer, and evidence reference. Full artifact content is loaded only when the consumer needs it.
5. **Bounded control.** Every agent phase declares a turn, time, retry, token, and cost policy. Prewalk has an explicit maximum-turn and cancellation policy.
6. **Cheap verification.** Each module documents its smallest focused command. Tests cross the public interface and use deterministic adapters where possible.
7. **Executable consistency.** The output-contract triad, workflow inventory, source-to-package mapping, and Markdown links have repository checks.
8. **Evidence first.** Every run produces an Evidence Manifest before any cross-run learning is considered.
9. **Safe accretion.** Observations, Decisions, Proposals, and Regression Cases remain distinct. An agent proposal never becomes instruction by being written to disk.

## Evidence and learning model

The immediate implementation target is a file-backed Evidence Manifest. It indexes existing run artifacts with content hashes, source revision, workflow version, role/model/prompt identity, phase outcomes, gate evidence, and the Integration Decision.

A later system may write Candidate Proposals next to the evidence. It keeps them explicitly untrusted. Phase 5 owns scoped context packs, Phase 12 owns replayable regression cases and comparison, and Phase 13 owns approved lessons and expert-role packages. None is a prerequisite for the execution kernel.

```text
run → evidence manifest → decision or deterministic outcome
    → candidate proposal or candidate regression case
    → corroboration or replay → explicit promotion → scoped retrieval
```

Every retrieved record names its source run, status, scope, owner, expiry, and evidence. Only an active Decision may change required behavior. A lesson can suggest a check but cannot override current source facts, deterministic policy, or the engineer's request.

## Migration sequence

### 1. Characterize behavior

Add public-interface tests for source admission, workspace retention, phase ordering, typed handoff, command failure, gate correction, permissions, resumption, Prewalk budget exhaustion, trace projection, and integration decisions. These tests define the migration boundary.

### 2. Create the canonical contracts

Create `modules/workflow-execution/domain` and its ports. Move the vocabulary and types there. Introduce the Factory facade with deterministic adapters. Do not retain a second executor API.

### 3. Move the operational kernel behind the facade

Move the current operational behavior from `adw_modules/runner.ts`, `session.ts`, `tracer.ts`, `permissions.ts`, `process.ts`, and related helpers behind workflow-execution use cases and ports. Make Git source admission mandatory for source-changing workflows. Delete the non-Git copy path.

### 4. Migrate workflow capabilities one at a time

Move each `adw_*.ts` and the matching composition from `adw_modules/workflows.ts` into its workflow directory. Replace `any` requests and envelopes with named local types. Leave a thin entrypoint under `entrypoints/workflows/`.

### 5. Move distribution last

Move build, package, installer, generated-sync, and template assets into `factory-distribution`. Its manifest becomes the only mapping from canonical source to generated package. Generated files carry their source and regeneration command.

### 6. Remove obsolete paths

Delete `src/workflow.ts`, `src/prewalk.ts`, `src/adws/`, and `src/scripts/` after their callers and tests migrate. Do not add forwarding modules, fallback paths, or permanent re-export shims. Update generated package tests, README, skills, and feature contracts in the same change.

## Completion criteria

The migration is complete only when:

- one Factory facade executes every workflow capability;
- no source file imports an obsolete execution kernel;
- every workflow has one local guide, contract, test location, and focused verification command;
- source-changing workflows reject a dirty or unexpected Git source before any agent or command runs;
- every run writes an Evidence Manifest and records an explicit integration outcome when it reaches human review;
- contract, link, inventory, and generated-package checks run in CI;
- `bun run format:check`, `bun run lint`, `bun run typecheck`, `bun run test`, `bun run check:skill`, and package verification pass.
