# Platforms

## Definition

A **platform** is a feature-bearing execution environment presented as a black box through a stable interaction boundary while hiding its implementation.

## Internal platform

### Local Agent Factory

Local Agent Factory accepts registered Workflow Capability requests, executes the selected Workflow through one Workflow Executor, and presents Workflow Runs and Run Evidence to operators and observers.

Its operator interface is currently a local CLI. Its trace view is a read-only projection. Both are adapters over the same Factory facade and Workflow Executor. Neither owns workflow control flow.

The Factory owns source admission, Disposable Workspace lifecycle, Phase and Primitive Invocation records, typed handoff, validation, evidence, execution budgets, and human integration decisions. It never merges, pushes, deploys, releases, or applies an Integration Decision to a repository.

## External platforms

- **Agent runtime**: executes a Harness Primitive in a tool-enabled working environment. Pi and OpenCode are current adapter candidates. The Factory selects them through the Agent Runtime port.
- **Model platform**: receives AI Primitive requests and returns generated responses. It remains behind the Agent Runtime adapter.
- **Git**: identifies Source Revisions and creates Disposable Workspaces. Git is required for source-changing Workflow Capabilities.
- **Operating system**: executes bounded Command Primitives and hosts local process, filesystem, and SQLite adapters.
