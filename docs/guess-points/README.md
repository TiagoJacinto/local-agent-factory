# Product contracts

This directory contains the actor-facing contracts for Local Agent Factory. It is not an implementation tree and it does not compete with `src/` for source authority.

## Read order

1. [`../../CONTEXT.md`](../../CONTEXT.md) defines the shared language.
2. [`1-problem/1-ROLES.md`](1-problem/1-ROLES.md) defines who may act and what they can observe.
3. [`3-architecture/1-PLATFORMS.md`](3-architecture/1-PLATFORMS.md) defines the Local Agent Factory boundary and its external dependencies.
4. [`2-solution/1-features/`](2-solution/1-features/) defines behavior with Gherkin contracts.
5. [`../ARCHITECTURE.md`](../ARCHITECTURE.md) maps those contracts to the target module architecture.

## Status

The existing feature files describe the original workflow-kernel prototype. They remain characterization contracts during migration. New behavior must use the vocabulary in `CONTEXT.md`: Workflow, Phase, Workflow Primitive, Envelope, Artifact, Run Evidence, and Integration Decision.

The runtime currently has operational behavior under `src/adws/` and a prototype kernel under `src/workflow.ts`. The target design in [`../plans/agent-native-source-architecture.md`](../plans/agent-native-source-architecture.md) converges them into one Workflow Executor. Do not add a third execution model.

## Terminology bridge

| Original contract term | Canonical term       | Migration meaning                                                        |
| ---------------------- | -------------------- | ------------------------------------------------------------------------ |
| Workflow Executor      | Workflow Executor    | Remains the primary execution seam.                                      |
| Primitive Invocation   | Primitive Invocation | Remains the observable record of an effectful call.                      |
| Run Context            | Run Context          | Remains typed state shared across a run.                                 |
| Harness                | Harness Primitive    | An agent-enabled primitive inside a Phase.                               |
| code phase             | Command Primitive    | A known deterministic command executed by the Workflow Executor.         |
| ADW                    | Workflow             | An implementation name being retired from architecture language.         |
| `Run`                  | Workflow Run         | Internal runtime state becomes an implementation detail of the executor. |

## Contract discipline

A feature contract specifies actor-visible behavior. It does not specify folders, classes, providers, SQLite tables, or prompt wording. Code and documentation must agree on the same Workflow Executor, source safety policy, and capability inventory before a contract is treated as acceptance evidence.
