Feature: Execute a workflow from a safe source repository
  Source: [GitHub issue #2](https://github.com/TiagoJacinto/local-agent-factory/issues/2)
  Domain definitions: [Workflow, HarnessPrimitive, PrimitiveInvocation, WorkflowRun, SourceRepository, SourceRevision, WorkingTree, DisposableWorkspace, and RunIdentifier](../../../../CONTEXT.md#language)
  Actor: [WorkflowOperator](../../1-problem/1-ROLES.md#horizontal-local-agent-factory-cli)
  Platform: [Local Agent Factory](../../3-architecture/1-PLATFORMS.md#internal-platforms)

  As a WorkflowOperator,
  I want to execute a workflow against an expected clean source revision,
  So that generated work is isolated from my source repository

  Rule: Use an isolated workspace for an expected clean source revision

    Scenario: Execute worker activity in a disposable workspace
      Given SourceRepository{path: "/work/project", sourceRevision: "abc123", workingTree: Clean}
      And Workflow{id: "update-readme", name: "Update README"}
        | callOrder | function | invocationId | name          |
        | 1         | Harness  | update       | Update README |
      When I executeWorkflow(workflowId: "update-readme", sourceRepository: "/work/project", expectedSourceRevision: "abc123")
      Then I view WorkflowRun{runIdentifier: "local-run-001", runIdentifierOrigin: Local, status: Succeeded, sourceRevision: "abc123", workspacePath: "/tmp/local-run-001", workspaceIsolation: IndependentClone, sourceIntegrity: Verified} in Workflow Execution: Run records its source and isolated workspace
      And I view HarnessInvocationResult{invocationId: "update", workspacePath: "/tmp/local-run-001", status: Succeeded} in Workflow Execution: Worker activity uses the disposable workspace

  Rule: Reject an unsafe source before workspace or worker execution

    Scenario: Reject a dirty source repository
      Given SourceRepository{path: "/work/project", sourceRevision: "abc123", workingTree: Dirty}
      And Workflow{id: "update-readme", name: "Update README"}
        | callOrder | function | invocationId | name          |
        | 1         | Harness  | update       | Update README |
      When I executeWorkflow(workflowId: "update-readme", sourceRepository: "/work/project", expectedSourceRevision: "abc123")
      Then I view WorkflowRun{runIdentifier: "local-run-002", runIdentifierOrigin: Local, status: Failed, sourceRevision: "abc123", failure: DirtySource, sourceIntegrity: Verified} in Workflow Execution: Dirty source is rejected visibly
      And I !view DisposableWorkspace{} in Workflow Execution: Workspace is not created
      And I !view InvocationResult{invocationId: "update"} in Workflow Execution: Worker is not invoked

    Scenario: Reject an unexpected source revision
      Given SourceRepository{path: "/work/project", sourceRevision: "def456", workingTree: Clean}
      And Workflow{id: "update-readme", name: "Update README"}
        | callOrder | function | invocationId | name          |
        | 1         | Harness  | update       | Update README |
      When I executeWorkflow(workflowId: "update-readme", sourceRepository: "/work/project", expectedSourceRevision: "abc123")
      Then I view WorkflowRun{runIdentifier: "local-run-003", runIdentifierOrigin: Local, status: Failed, sourceRevision: "def456", failure: UnexpectedSourceRevision, sourceIntegrity: Verified} in Workflow Execution: Revision mismatch is rejected visibly
      And I !view DisposableWorkspace{} in Workflow Execution: Workspace is not created
      And I !view InvocationResult{invocationId: "update"} in Workflow Execution: Worker is not invoked

  Rule: Retain an isolated workspace when execution fails

    Scenario: Preserve failed worker activity for inspection
      Given SourceRepository{path: "/work/project", sourceRevision: "abc123", workingTree: Clean}
      And Workflow{id: "failing-update", name: "Failing README update"}
        | callOrder | function | invocationId | name          | outcome |
        | 1         | Harness  | update       | Update README | Failed  |
      When I executeWorkflow(workflowId: "failing-update", sourceRepository: "/work/project", expectedSourceRevision: "abc123")
      Then I view WorkflowRun{runIdentifier: "local-run-004", runIdentifierOrigin: Local, status: Failed, sourceRevision: "abc123", workspacePath: "/tmp/local-run-004", workspaceDisposition: Retained, sourceIntegrity: Verified} in Workflow Execution: Failed run retains its disposable workspace
      And I view HarnessInvocationResult{invocationId: "update", workspacePath: "/tmp/local-run-004", status: Failed} in Workflow Execution: Worker failure is visible in the disposable workspace
