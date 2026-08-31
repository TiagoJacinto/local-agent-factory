# Local Agent Factory

This context defines the language for turning an engineer's intent into bounded, inspectable coding work while deterministic code retains control of execution and acceptance.

## Language

**Local Agent Factory**:
The system that registers, runs, observes, and governs code-defined agent workflows.
_Avoid_: SSSF runtime, ADW runtime, workflow platform

**Workflow Capability**:
An actor-facing outcome the Local Agent Factory can produce, such as planning a change, implementing a plan, or reviewing a result.
_Avoid_: Script, pipeline, job

**Workflow**:
A typed controller that realizes one Workflow Capability by sequencing Phases, Workflow Primitives, and Pure Computation through ordinary control flow.
_Avoid_: Operation list, YAML pipeline

**Workflow Registry**:
The catalog of Workflow definitions available to the Local Agent Factory.
_Avoid_: Script directory, workflow list

**Workflow Executor**:
The module through which callers execute, inspect, and decide the outcome of Workflow Runs.
_Avoid_: Runner, engine, orchestrator

**Workflow Run**:
The observable record of one Workflow execution, including its source, Phases, Primitive Invocations, artifacts, evidence, status, and Integration Decision.
_Avoid_: Session, job

**Phase**:
A named unit of intent within a Workflow Run that groups related computation and Primitive Invocations under one purpose, owner, policy, and outcome.
_Avoid_: Step, task

**Workflow Primitive**:
A system-owned effectful operation available inside a Phase. AI, Harness, Command, and Gate are Primitive Types.
_Avoid_: User-defined kind, action

**AI Primitive**:
A Workflow Primitive that obtains a model response without a tool-enabled working environment.

**Harness Primitive**:
A Workflow Primitive that delegates a bounded goal to an agent in a tool-enabled working environment.
_Avoid_: Agent phase

**Command Primitive**:
A Workflow Primitive that executes a known deterministic command without asking an agent to rediscover it.
_Avoid_: Code phase, tester agent

**Gate Primitive**:
A Workflow Primitive that records a human decision required before the Workflow can continue or finish.
_Avoid_: Approval flag

**Primitive Invocation**:
One call to a Workflow Primitive, recorded in its enclosing Phase with its type, inputs, outputs, evidence, and outcome.
_Avoid_: Step

**Pure Computation**:
Ordinary Workflow code that transforms data without invoking a Workflow Primitive or creating a Primitive Invocation.

**Composite Function**:
A Workflow-defined function that combines Pure Computation and Workflow Primitive calls without becoming a Primitive Invocation itself.

**Run Context**:
The typed state shared by Phases during one Workflow Run.

**Envelope**:
A typed manifest of claims produced by an agent or deterministic adapter for another Phase to consume and verify.
_Avoid_: Free-form handoff, agent memory

**Artifact**:
A named, immutable output referenced by a Workflow Run and available to later Phases without embedding its full contents in their context.

**Gate Report**:
The evidence-backed result of checking every relevant Envelope claim.
_Avoid_: Agent verdict

**Source Repository**:
The Git repository whose clean expected Source Revision supplies the starting state for a Workflow Run.
_Avoid_: Working directory

**Source Revision**:
The commit that identifies the exact Source Repository state requested for a Workflow Run.

**Working Tree**:
The observable set of tracked and untracked changes relative to a Source Repository's Source Revision.

**Run Identifier**:
A locally generated identity for one Workflow Run that joins its phases, evidence, agent sessions, and integration decision.

**Disposable Workspace**:
An isolated local clone in which a Workflow Run may read, modify, and validate repository content without changing the Source Repository.
_Avoid_: Source checkout

**Execution Budget**:
The declared upper bounds on attempts, turns, elapsed time, tokens, and cost available to a Workflow Run or Phase.
_Avoid_: Best effort

**Run Evidence**:
The immutable observations, decisions, outputs, and measurements that explain what a Workflow Run did and why it reached its outcome.
_Avoid_: Transcript dump, model reasoning

**Evidence Manifest**:
The bounded index of a Workflow Run's Run Evidence, with provenance and content references for cheap inspection.
_Avoid_: Run summary

**Observation**:
Run Evidence directly produced by code, tools, tests, or a person. Its authority is limited to the fact and scope observed.

**Decision**:
A scoped outcome selected by a person or deterministic policy and linked to the Run Evidence that justified it.

**Proposal**:
An agent interpretation or suggested reusable lesson that has no authority as instruction until explicitly promoted.
_Avoid_: Memory, learned rule

**Regression Case**:
A replayable request and expected observable behavior derived from accepted or failed Run Evidence.

**Integration Decision**:
The person's explicit choice to accept, reject, accept with changes, or abandon a Workflow Run's result.
_Avoid_: Successful run

**Prewalk**:
A bounded handoff policy that keeps discovery and planning on a planning model, then continues the same agent session on an implementation model after the plan exists and repository modification begins.
