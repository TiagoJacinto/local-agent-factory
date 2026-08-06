# Platforms

## Definition

A **platform** is a feature-bearing execution environment presented as a black box that users interact with. It runs code behind a stable interaction boundary while hiding its internal implementation.

## Internal platforms

- **Local Agent Factory setup** — installs and verifies a reusable Workflow Package and its configuration in a Target Repository.
- **Local Agent Factory** — executes registered workflows and returns Workflow Runs, Review Handoffs, and artifacts.
- **Local Agent Factory trace viewer** — provides a read-only view of active and completed Workflow Traces and evidence.

## External platforms

- **Agent harness** — delegates goals to a coding agent in a tool-enabled Disposable Workspace.
- **Model platform** — receives model requests and returns generated responses.
