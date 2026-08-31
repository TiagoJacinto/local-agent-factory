# Workflow execution

Public interface: `Factory` (`execute`, `inspect`, `decide`) and the canonical `WorkflowExecutor`.

The executor admits clean Git sources at an expected revision, runs each workflow in an independent clone, records typed invocations and phases, bounds work with budgets, and writes an Evidence Manifest. Worker proposals are untrusted; integration requires an explicit decision.

Failure modes include dirty or non-Git sources, unexpected revisions, source changes, command failures, rejected gates, and exhausted budgets. Ports isolate Git, processes, tracing, artifacts, and human decisions from workflow control flow.

Tests live beside workflow-execution contracts and under `tests/acceptance`. Read `docs/plans/agent-native-source-architecture.md` next.
