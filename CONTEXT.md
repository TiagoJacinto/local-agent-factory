# Workflow Execution

This context defines how workflow authors coordinate model work, tool-enabled work, human decisions, and ordinary computation through one workflow interface.

## Language

**Workflow**:
A typed controller that sequences workflow primitives, composite functions, and pure computation through ordinary control flow.

**Workflow Primitive**:
A system-owned effectful operation available to workflows. Calling the primitive determines its primitive type; the workflow author does not declare that type separately.
_Avoid_: Step, user-defined kind

**Primitive Type**:
The system-owned classification of a workflow primitive and its invocation results. AI, Harness, and Gate are primitive types.
_Avoid_: User-defined kind

**AI Primitive**:
A workflow primitive that obtains a response from a language model without a tool-enabled working environment.

**Harness Primitive**:
A workflow primitive that delegates a goal within a tool-enabled working environment.

**Gate Primitive**:
A workflow primitive that waits for a human decision before the workflow continues.

**Primitive Invocation**:
One call to a workflow primitive. The workflow author gives the invocation an identifier and a name; the called primitive supplies its type.

**Pure Computation**:
Ordinary workflow code that transforms data without invoking a workflow primitive. It does not create an invocation result.

**Composite Function**:
A workflow-author-defined function that combines pure computation and workflow primitive calls. The function itself does not create an invocation result.

**Workflow Executor**:
The module that invokes a workflow controller in a run context and returns its workflow run.

**Workflow Run**:
The observable record of one workflow execution, identified by a locally generated run identifier and including its status, source revision, disposable workspace path when one was created, ordered invocation results, and artifacts.

**Source Repository**:
The local repository whose revision supplies the starting point for a workflow run and which must remain unchanged by that run.

**Source Revision**:
The commit identifying the exact source repository content requested for a workflow run.

**Working Tree**:
The observable state of tracked and untracked changes in a source repository. A clean working tree has no such changes.

**Disposable Workspace**:
An isolated local clone created from the source repository for one workflow run. Workflow and validation work occurs there rather than in the source repository, and the workspace is retained when the run fails.

**Run Identifier**:
A locally generated identity for one workflow run.

**Validation**:
The checking of generated work in the disposable workspace during a workflow run.

**Validation Result**:
The observable outcome of validation, including the disposable workspace where the checks ran.

**Invocation Result**:
The typed outcome of one primitive invocation, identified by the invocation and its system-owned primitive type.

**Run Context**:
The evolving state shared by primitive invocations during one workflow run.

**Artifact**:
A named output produced by one primitive invocation, retained in the run context, and available to later primitive invocations.
