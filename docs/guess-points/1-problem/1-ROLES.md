# Roles

## Purpose

This catalog defines each role by the single horizontal through which it interacts with the system. A **horizontal** is an interaction environment or channel, such as source authoring, a code API, a browser application, or a REST API. The **verticals** within that horizontal are the bounded capabilities exposed to the role.

One person may perform multiple roles, but each role belongs to exactly one horizontal. An interface not listed for a role is outside that role's access boundary.

## Role catalog

### Workflow Operator

A **Workflow Operator** is a person who executes a registered workflow and inspects its workflow run, primitive invocation results, and artifacts.

Source features: [`execute-workflow.feature`](../2-solution/1-features/execute-workflow.feature), [`execute-workflow-from-safe-source.feature`](../2-solution/1-features/execute-workflow-from-safe-source.feature)

#### Horizontal: Local Agent Factory CLI

The Workflow Operator calls the Local Agent Factory from outside the system through its CLI.

| Vertical | Interface available to the role | Permitted interaction |
| --- | --- | --- |
| Workflow execution | Local Agent Factory CLI | Request execution of one registered workflow, optionally against an expected revision of a clean source repository. |
| Workflow-run inspection | CLI workflow-run output | Inspect the run identifier, status, source revision, disposable workspace path when one was created, and ordered primitive invocation results. |
| Artifact inspection | CLI artifact output | Inspect artifacts and their production and consumption within the workflow run. |

#### Access boundary

- **CLI:** Access is limited to executing registered workflows and inspecting their returned runs through the CLI.
- **Direct platform access:** The role does not directly access the model platform or agent harness; it reaches them only through CLI workflow execution.

#### Observable workflow

1. Select a registered workflow by identifier through the CLI.
2. Request its execution, including the source repository and expected revision when required.
3. Inspect the CLI's workflow-run output.
4. Inspect ordered primitive invocation results and artifacts reported for that run.
