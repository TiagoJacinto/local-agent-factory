# Roles

## Purpose

This catalog defines each role by its single horizontal. A **horizontal** is the interaction environment through which a role acts and observes outcomes. The **verticals** within that horizontal are the bounded capabilities available to that role.

One person may perform multiple roles, but each role belongs to exactly one horizontal. An interface not listed for a role is outside that role's access boundary.

## Role catalog

### Workflow Operator

A **Workflow Operator** requests registered Workflow Capabilities and inspects the resulting Workflow Runs.

Source features: [`execute-workflow.feature`](../2-solution/1-features/execute-workflow.feature), [`execute-workflow-from-safe-source.feature`](../2-solution/1-features/execute-workflow-from-safe-source.feature), [`prewalk-model-handoff.feature`](../2-solution/1-features/prewalk-model-handoff.feature)

#### Horizontal: Local Agent Factory

The Workflow Operator interacts with the Local Agent Factory through its operator interface. The first adapter is a local CLI. A future adapter may use the same Factory facade without creating another role horizontal.

| Vertical                | Permitted interaction                                                                                                                                        |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Workflow execution      | Request one registered Workflow Capability against a clean expected Source Revision when the workflow changes source.                                        |
| Workflow-run inspection | Inspect the run identifier, status, source, Disposable Workspace, ordered Phases and Primitive Invocations, Envelopes, Artifacts, budgets, and Run Evidence. |
| Integration decision    | Accept, reject, accept with changes, or abandon a result at the human Gate. Integration itself remains outside the Factory.                                  |
| Evidence inspection     | Inspect the Evidence Manifest, validation evidence, review findings, and retained failed workspaces.                                                         |

#### Access boundary

- The operator requests a registered Workflow. It does not issue raw adapter calls or modify execution state directly.
- The operator may inspect evidence but cannot treat an agent Proposal as an accepted Decision without an explicit promotion path.
- The operator may integrate an accepted result outside the Factory. The Factory does not merge, push, deploy, or release on the operator's behalf.

### Workflow Observer

A **Workflow Observer** examines live or completed Workflow Runs without starting, changing, or integrating them.

#### Horizontal: Local Agent Factory trace view

| Vertical          | Permitted interaction                                                                                                    |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Run inspection    | Inspect status, Phases, Primitive Invocations, budgets, tool activity, and Run Evidence through the trace projection.    |
| Failure diagnosis | Inspect failed Gate Reports, invalid Envelopes, command output, retained workspaces, and recorded Integration Decisions. |

#### Access boundary

The Workflow Observer has no authority to execute a Workflow, resume an agent session, change a write boundary, promote a Proposal, or integrate a result.
