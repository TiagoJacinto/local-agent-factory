# One Workflow Executor

**Status:** accepted

Local Agent Factory will converge its prototype executor and operational ADW runner into one Workflow Executor behind a small Factory facade. The two existing kernels describe overlapping run lifecycles and create incompatible mental models for operators and agents. The canonical executor will preserve the operational kernel's workspace safety, phase ledger, typed handoff, evidence, permissions, and session behavior while exposing one public execution seam. The migration removes obsolete paths instead of keeping permanent compatibility layers.

## Consequences

Workflow definitions, entrypoints, adapters, tests, documentation, skills, and generated package mappings must target the canonical executor. A future adapter or visualizer may vary behind an explicit port, but it may not introduce another run lifecycle.
