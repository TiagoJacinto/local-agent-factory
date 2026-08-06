Feature: Observe a workflow factory run
  As a Workflow Observer,
  I want to inspect a live or completed workflow trace,
  So that I can understand progress, activity, and failure evidence
  Domain definitions: [Trace](../../../../CONTEXT.md#trace), [Workflow Trace](../../../../CONTEXT.md#workflow-trace), [Workflow Phase](../../../../CONTEXT.md#workflow-phase), [Agent Session](../../../../CONTEXT.md#agent-session), [Validation Result](../../../../CONTEXT.md#validation-result), [Envelope](../../../../CONTEXT.md#envelope), and [Artifact](../../../../CONTEXT.md#artifact)
  Actor: [Workflow Observer](../../1-problem/1-ROLES.md#workflow-observer)
  Platform: [Local Agent Factory trace viewer](../../3-architecture/1-PLATFORMS.md#internal-platforms)

  Rule: Observe active runs

    Scenario: View available workflow runs
      Given WorkflowRun{runIdentifiers: ["run-123", "run-456"]}
      When I listWorkflowRuns()
      Then I view WorkflowRun{runIdentifiers: ["run-123", "run-456"]} in Workflow Trace: Available runs are visible

    Scenario: View phases while a workflow is running
      Given WorkflowRun{runIdentifier: "run-123", status: Running}
      When I inspectWorkflowRun(runIdentifier: "run-123")
      Then I view WorkflowTrace{runIdentifier: "run-123", status: Running} in Workflow Trace: The active run is visible
      And I view WorkflowPhase{status: Running} in Workflow Trace: The current phase is visible
      And I view ProcessActivity{status: Running} in Workflow Trace: The active process is visible

    Scenario: View agent tool activity
      Given WorkflowRun{runIdentifier: "run-123", status: Running}
      And AgentSession{role: "builder", status: Running}
      When I inspectWorkflowRun(runIdentifier: "run-123")
      Then I view ToolCall{agent: "builder", arguments: Present, result: Present} in Workflow Trace: Agent activity is visible

  Rule: Inspect completed evidence

    Scenario: Inspect successful validation and phase handoffs
      Given WorkflowRun{runIdentifier: "run-123", status: AwaitingReview}
      When I inspectWorkflowRun(runIdentifier: "run-123")
      Then I view WorkflowTrace{runIdentifier: "run-123", status: AwaitingReview} in Workflow Trace: The completed run is visible
      And I view ValidationResult{status: Succeeded, evidence: Present} in Workflow Trace: Validation evidence is available
      And I view Envelope{producer: Present, consumer: Present} in Workflow Trace: Phase handoffs are available
      And I view Artifact{producer: Present, consumer: Present} in Workflow Trace: Produced work is available

    Scenario: Inspect sessions and process history
      Given WorkflowRun{runIdentifier: "run-123", status: AwaitingReview}
      When I inspectWorkflowRun(runIdentifier: "run-123")
      Then I view AgentSession{role: Present, sessionId: Present} in Workflow Trace: Agent sessions are available
      And I view ProcessActivity{status: Succeeded} in Workflow Trace: Process history is available

  Rule: Preserve failed evidence

    Scenario: Inspect a failed workflow
      Given WorkflowRun{runIdentifier: "run-456", status: Failed, workspaceDisposition: Retained}
      When I inspectWorkflowRun(runIdentifier: "run-456")
      Then I view WorkflowTrace{runIdentifier: "run-456", status: Failed, failureEvidence: Present} in Workflow Trace: Failure evidence is visible
      And I view ValidationResult{status: Failed, evidence: Present} in Workflow Trace: Failed validation evidence is available
      And I view DisposableWorkspace{workspaceDisposition: Retained} in Workflow Trace: The failed workspace remains inspectable

    Scenario: Observe without changing the run
      Given WorkflowRun{runIdentifier: "run-123", status: Running}
      When I inspectWorkflowRun(runIdentifier: "run-123")
      Then I !view WorkflowRun{changedBy: WorkflowObserver} in Workflow Trace: Observation is read-only
