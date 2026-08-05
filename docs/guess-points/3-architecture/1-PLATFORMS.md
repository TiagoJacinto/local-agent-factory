# Platforms

## Definition

A **platform** is a feature-bearing execution environment presented as a black box that users interact with. It runs code behind a stable interaction boundary while hiding its internal implementation.

## Internal platforms

An **internal platform** is a platform that we own and can change as part of this system.

- **Local Agent Factory** — provides workflow installation, configuration, execution, and run inspection through stable local boundaries. It coordinates model work, tool-enabled work, human decisions, and ordinary computation behind those boundaries.
- **Local Agent Factory setup** — installs and verifies a reusable workflow package and its configuration in a target repository.
- **Local Agent Factory Visualizer** — provides a read-only view through which Workflow Observers inspect active and completed Workflow Run traces and evidence.
- **Local Agent Factory trace viewer** — presents live and completed Workflow Traces, including phases, primitive invocations, validation results, envelopes, artifacts, and process activity.

## External platforms

An **external platform** is a platform that we do not own. We interact with it through its public boundary and must accommodate its capabilities, constraints, and changes.

- **Agent harness** — provides features for delegating goals to a coding agent in a tool-enabled working environment.
- **Model platform** — provides features for submitting model requests and receiving generated responses.
