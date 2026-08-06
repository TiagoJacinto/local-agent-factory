# Roles

## Purpose

This catalog defines each role by the single horizontal through which it interacts with the system. A horizontal is an interaction environment or channel. One person can perform more than one role, but each role belongs to one horizontal.

## Role catalog

### Factory Maintainer

A **Factory Maintainer** installs and configures a reusable Workflow Package in a Target Repository. The role also maintains the Agent Roster and Workflow Catalog.

#### Horizontal: Local Agent Factory setup

| Vertical | Permitted interaction |
| --- | --- |
| Factory installation | Install or refresh the Workflow Package in a Target Repository. |
| Factory configuration | Configure Agent Roles, model choices, instructions, tools, and Write Boundaries. |
| Workflow authoring | Create or update named workflows and their bounded phases. |
| Factory verification | Verify the installed package, Agent Roster, and Workflow Catalog. |

#### Access boundary

- Access is limited to installing and configuring the factory.
- The role does not perform workflow work during installation or configuration.

### Workflow Operator

A **Workflow Operator** executes a registered workflow and inspects its Workflow Run, primitive results, artifacts, and Review Handoff.

#### Horizontal: Local Agent Factory CLI

| Vertical | Permitted interaction |
| --- | --- |
| Workflow execution | Request one registered workflow with an objective and optional source revision. |
| Session continuation | Resume an existing Workflow Session with the same run identity. |
| Run inspection | Inspect the returned run identifier, status, source revision, workspace, invocations, and artifacts. |
| Integration decision | Inspect the Review Handoff and decide whether to integrate the result manually. |

#### Access boundary

- Access is limited to executing registered workflows and inspecting their returned run data.
- The role does not directly control the model platform or agent harness.

### Workflow Observer

A **Workflow Observer** inspects active and completed Workflow Traces and evidence.

#### Horizontal: Local Agent Factory trace viewer

| Vertical | Permitted interaction |
| --- | --- |
| Run listing | View available Workflow Runs. |
| Live observation | Inspect active Workflow Phases, process activity, and agent tool activity. |
| Evidence inspection | Inspect Agent Sessions, Envelopes, Validation Results, Artifacts, and failure evidence. |

#### Access boundary

- Access is read-only.
- The role cannot execute workflows, change configuration, or change repository content.
