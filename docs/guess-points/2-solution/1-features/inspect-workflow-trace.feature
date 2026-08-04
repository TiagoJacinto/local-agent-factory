Feature: Inspect a workflow trace
  Source: [Phase 0 issue #9](https://github.com/TiagoJacinto/local-agent-factory/issues/9)
  Reference: [Super Simple Software Factory README](https://github.com/disler/super-simple-software-factory/blob/de31374882e7a4e3e5b7bb9bd09e69dc2f779356/README.md)
  Domain definitions: [Workflow Run, Workflow Trace, Workflow Envelope, Validation Result, Invocation Result, and Artifact](../../../../CONTEXT.md#language)
  Actor: [WorkflowObserver](../../1-problem/1-ROLES.md#horizontal-local-agent-factory-trace-viewer)
  Platform: [Local Agent Factory trace viewer](../../3-architecture/1-PLATFORMS.md#internal-platforms)

  As a WorkflowObserver,
  I want to inspect a live or completed workflow trace,
  So that I can understand what the factory did and why it stopped

  Rule: Observe phases and primitive activity while a run is active

    Scenario: Inspect a running workflow
      Given WorkflowRun{runIdentifier: "run-001", status: Running}
      When I inspectWorkflowRun(runIdentifier: "run-001")
      Then I view WorkflowTrace{runIdentifier: "run-001", status: Running} in Workflow Trace: The active run is visible
        | sequence | kind        | name             | status  |
        | 1        | phase       | build            | Running |
        | 2        | primitive   | Build request    | Running |
        | 3        | tool_call   | read source      | Running |

  Rule: Inspect completed evidence

    Scenario: Inspect validation and review evidence
      Given WorkflowRun{runIdentifier: "run-002", status: AwaitingReview}
      When I inspectWorkflowRun(runIdentifier: "run-002")
      Then I view WorkflowTrace{runIdentifier: "run-002", status: AwaitingReview} in Workflow Trace: The completed run is visible
      And I view ValidationResult{status: Succeeded, evidence: Present} in Workflow Trace: Validation evidence is available
      And I view WorkflowEnvelope{status: Success, artifacts: Present} in Workflow Trace: Phase output is available
      And I view Artifact{kind: ReviewableChange, reference: Present} in Workflow Trace: The reviewable change is available

  Rule: Preserve failed evidence

    Scenario: Inspect a failed workflow and its retained workspace
      Given WorkflowRun{runIdentifier: "run-003", status: Failed, workspaceDisposition: Retained}
      When I inspectWorkflowRun(runIdentifier: "run-003")
      Then I view WorkflowTrace{runIdentifier: "run-003", status: Failed} in Workflow Trace: The failed run is visible
      And I view ValidationResult{status: Failed, evidence: Present} in Workflow Trace: Failed validation evidence is available
      And I view WorkflowRun{runIdentifier: "run-003", workspaceDisposition: Retained} in Workflow Trace: The failed workspace remains inspectable
