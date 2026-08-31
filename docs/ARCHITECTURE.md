# Architecture

Local Agent Factory is one system, not a collection of scripts. It converts an engineer's request into bounded work in an isolated workspace, captures enough evidence to judge the result, and leaves integration to a person.

## Read this first

| Need                                    | Read next                                                                                |
| --------------------------------------- | ---------------------------------------------------------------------------------------- |
| Domain language                         | [`../CONTEXT.md`](../CONTEXT.md)                                                         |
| Product intent and current behavior     | [`../README.md`](../README.md)                                                           |
| Actor and platform contracts            | [`guess-points/README.md`](guess-points/README.md)                                       |
| Long-term reliability options           | [`../ROBUSTNESS.md`](../ROBUSTNESS.md)                                                   |
| How an installed factory agent operates | [`../src/skills/sssf/SKILL.md`](../src/skills/sssf/SKILL.md)                             |
| Target source migration                 | [`plans/agent-native-source-architecture.md`](plans/agent-native-source-architecture.md) |

## One control loop

```text
engineer request
  → registered workflow
  → bounded phases in a disposable workspace
  → envelopes, artifacts, commands, and gates
  → run evidence
  → integration decision
  → candidate regression case or lesson proposal
```

Agents propose. Deterministic code owns sequencing, validation, evidence, and resource limits. A person owns integration and any promotion of cross-run knowledge.

## Tower of abstractions

```text
Operator interface
  CLI and visualizer translate input and render results
      ↓
Factory facade
  execute(request), inspect(run), decide(run, decision)
      ↓
Workflow registry
  capability name → typed workflow definition
      ↓
Workflow executor
  source checks, workspace lifecycle, phase order, budgets, final status
      ↓
Phase ledger and typed handoff
  phases, primitive invocations, envelopes, artifacts, gate reports
      ↓
Capability ports
  agent runtime, command runner, workspace, trace sink, artifact store, human gate
      ↓
Adapters
  Pi, OpenCode, Bun, Git, SQLite, filesystem, CLI, visualizer
```

The **Workflow Executor** is the primary product and testing seam. The Factory facade is the small caller-facing interface over it. Workflow authors use the registration contract, not adapter APIs.

## Architectural rules

1. One canonical execution kernel owns a Workflow Run. The current `src/workflow.ts` prototype and `src/adws/adw_modules/runner.ts` are migration inputs, not permanent peer architectures.
2. A Workflow owns a capability. Its entrypoint, typed request, phase graph, tests, and agent-facing guide stay together.
3. A Phase owns one purpose and its budget. Phase descriptions explain why the work exists, not merely its name.
4. Workflow control flow is typed code. Prompts, configuration, and skills select behavior inside a bounded phase. They do not own outer sequencing.
5. Known commands use the Command Primitive. Agents receive failures as typed evidence and decide only what requires judgement.
6. Source-changing workflows require a clean Git Source Repository at an expected Source Revision and run only in a Disposable Workspace. The Factory never merges, pushes, deploys, or integrates automatically.
7. The Envelope is a claim manifest. Gates verify claims against artifacts and command results. A passing command never substitutes for review of whether the requested capability was delivered.
8. Every run produces a compact Evidence Manifest that indexes raw evidence. SQLite is a queryable mirror, never the sole record.
9. Proposals are untrusted across runs. Only scoped Decisions and explicitly promoted lessons may guide a later run, and each carries provenance, status, and expiry.
10. `shared/` contains only code whose meaning is genuinely shared by at least two modules. No global utility dumping ground.

## Dependency direction

```text
entrypoints → factory facade → registry → workflows → domain contracts → capability ports
                                                                       ↑
                                                               infrastructure adapters
```

- Domain contracts import no adapters.
- Workflows import contracts and capability ports, never Pi, Git, SQLite, Commander, or filesystem details.
- Adapters implement ports and never import workflow controllers.
- The visualizer reads trace projections and evidence manifests. It does not control execution.
- Tests cross a module's public interface and replace ports with deterministic adapters.

## Agent route

An agent should take the shortest route that proves its next action:

1. Read `AGENTS.md`, then this map and the relevant module's `CONTEXT.md`.
2. Read that module's `README.md` and `index.ts` before implementation files.
3. Read the named use case, its contract, and its colocated tests.
4. Follow an import only when it crosses the current module's seam or the task changes that capability.
5. Read an adapter only when the task touches its external capability.
6. Run the module's documented cheapest relevant check before wider validation.
7. Record changed files, evidence, unresolved risks, and candidate lessons in the run handoff.

A module guide must name its public interface, invariants, failure modes, dependencies, adapters, tests, and the next document to read. This is progressive disclosure, not extra documentation.

## Truth and freshness

| Surface                                 | Authority                                                                |
| --------------------------------------- | ------------------------------------------------------------------------ |
| `src/`                                  | Canonical source                                                         |
| `src/skills/`                           | Canonical skill source                                                   |
| `dist/`                                 | Generated package output. Rebuild with `bun run build:skill`.            |
| Stamped `adws/` in a target repository  | Installed copy generated from the package. Update through the installer. |
| `adws/adw_data/` in a target repository | Runtime evidence, not source.                                            |

A generated tree must identify its source and regeneration command. Checks must fail when a generated package, contract triad, workflow inventory, or document link drifts from its authority.
