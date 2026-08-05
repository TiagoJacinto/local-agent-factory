# Roles

## Purpose

This catalog defines each role by the single horizontal through which it interacts with the system. A **horizontal** is an interaction environment or channel, such as source authoring, a code API, a browser application, or a REST API. The **verticals** within that horizontal are the bounded capabilities exposed to the role.

One person may perform multiple roles, but each role belongs to exactly one horizontal. An interface not listed for a role is outside that role's access boundary.

## Role catalog

### Factory Maintainer

A **Factory Maintainer** is a person who installs the Factory Package and configures the Agent Roster and Workflow Catalog for a repository.

#### Horizontal: Local Agent Factory CLI

The Factory Maintainer prepares the Local Agent Factory through its local command boundary.

| Vertical | Interface available to the role | Permitted interaction |
| --- | --- | --- |
| Factory installation | Local Agent Factory CLI | Install or refresh the Factory Package in a repository. |
| Factory configuration | Local Agent Factory CLI | Configure Agent Roles, model choices, instructions, tools, and Write Boundaries. |
| Workflow registration | Local Agent Factory CLI | Register, inspect, and select named workflows in the Workflow Catalog. |

#### Access boundary

- **CLI:** Access is limited to preparing and configuring the factory in the selected repository.
- **Direct run access:** The role does not directly control model or harness providers; it configures the factory that Workflow Operators later execute.

### Workflow Observer

A **Workflow Observer** is a person who watches a Workflow Run and inspects its Trace and Review Handoff.

#### Horizontal: Local Agent Factory Visualizer

The Workflow Observer uses the read-only visualizer boundary.

| Vertical | Interface available to the role | Permitted interaction |
| --- | --- | --- |
| Live run observation | Local Agent Factory Visualizer | Observe active Workflow Phases and Trace events. |
| Evidence inspection | Local Agent Factory Visualizer | Inspect Agent Sessions, Envelopes, Validation Gates, tool activity, and failure evidence. |

#### Access boundary

- **Visualizer:** Access is read-only. The role can inspect a Workflow Run but cannot change repository content or workflow configuration.
- **Direct execution access:** The role does not start or alter a run through the visualizer.

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

### Factory Maintainer

A **Factory Maintainer** installs and configures a reusable workflow package in a repository so that a Workflow Operator can run its registered workflows.

#### Horizontal: Local Agent Factory setup

The Factory Maintainer uses the Local Agent Factory setup capability from outside the system.

| Vertical | Interface available to the role | Permitted interaction |
| --- | --- | --- |
| Factory installation | Local Agent Factory setup | Install a workflow package into a target repository. |
| Factory configuration | Local Agent Factory setup | Set agent roles, instructions, models, tools, and repository write boundaries. |
| Factory verification | Local Agent Factory setup | Verify the installed workflow registry and configuration. |

#### Access boundary

- **Setup:** Access is limited to installing and configuring the workflow package.
- **Execution:** The role does not perform workflow work as part of installation.

### Workflow Observer

A **Workflow Observer** inspects live and completed workflow traces, phase details, validation evidence, envelopes, and process activity.

#### Horizontal: Local Agent Factory trace viewer

The Workflow Observer uses the Local Agent Factory trace viewer from outside the system.

| Vertical | Interface available to the role | Permitted interaction |
| --- | --- | --- |
| Trace inspection | Local Agent Factory trace viewer | Inspect a workflow trace while the run is active or after it finishes. |
| Evidence inspection | Local Agent Factory trace viewer | Inspect validation results, envelopes, artifacts, and process activity for a run. |

#### Access boundary

- **Trace viewer:** Access is limited to inspecting workflow evidence.
- **Mutation:** The role cannot change a workflow run through the trace viewer.
