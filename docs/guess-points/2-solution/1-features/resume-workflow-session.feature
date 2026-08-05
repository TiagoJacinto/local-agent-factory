Feature: Resume a workflow session
  Source: [Phase 0 issue #9](https://github.com/TiagoJacinto/local-agent-factory/issues/9)
  Reference: [Super Simple Software Factory README](https://github.com/disler/super-simple-software-factory/blob/de31374882e7a4e3e5b7bb9bd09e69dc2f779356/README.md)
  Domain definitions: [Workflow Session, Workflow Run, Workflow Envelope, Artifact, and Run Identifier](../../../../CONTEXT.md#language)
  Actor: [WorkflowOperator](../../1-problem/1-ROLES.md#horizontal-local-agent-factory-cli)
  Platform: [Local Agent Factory](../../3-architecture/1-PLATFORMS.md#internal-platforms)

  As a WorkflowOperator,
  I want to resume a workflow session by its run identifier,
  So that a correction or later workflow can use the existing context instead of starting cold

  Rule: Resume the active workflow context

    Scenario: Continue a workflow with its existing agent context
      Given WorkflowRun{runIdentifier: "run-001", status: Failed}
      And WorkflowSession{runIdentifier: "run-001", agentContext: Present, artifacts: Present}
      When I resumeWorkflow(runIdentifier: "run-001", correction: "Fix the validation failure")
      Then I view WorkflowRun{runIdentifier: "run-001", status: Running} in Workflow Execution: The existing workflow session continues
      And I view WorkflowSession{runIdentifier: "run-001", sameAgentContext: true} in Workflow Execution: Agent context is preserved
      And I view Artifact{producerInvocationId: Present, consumerInvocationId: Present} in Workflow Execution: Existing artifacts remain available

  Rule: Keep the session record across chained workflows

    Scenario: Start the next workflow in an existing session
      Given WorkflowRun{runIdentifier: "run-002", status: AwaitingReview}
      And WorkflowSession{runIdentifier: "run-002", agentContext: Present}
      When I executeWorkflow(workflowId: "document", runIdentifier: "run-002")
      Then I view WorkflowRun{runIdentifier: "run-002", status: Running} in Workflow Execution: The chained workflow uses the existing run
      And I view WorkflowSession{runIdentifier: "run-002", sameAgentContext: true} in Workflow Execution: The agent session is resumed
