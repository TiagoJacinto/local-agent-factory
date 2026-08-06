# Source: Super Simple Software Factory README and current conversation.
Feature: Observe an agent workflow
  As a Workflow Observer,
  I want to inspect a workflow trace,
  So that I can understand progress, tool activity, and failure evidence
  Domain definitions: [Trace](../../../../CONTEXT.md#trace), [Workflow Trace](../../../../CONTEXT.md#workflow-trace), [Workflow Visualizer](../../../../CONTEXT.md#workflow-visualizer), [Workflow Phase](../../../../CONTEXT.md#workflow-phase), [Agent Session](../../../../CONTEXT.md#agent-session), [Envelope](../../../../CONTEXT.md#envelope), and [Validation Result](../../../../CONTEXT.md#validation-result)
  Actor: [Workflow Observer](../../1-problem/1-ROLES.md#horizontal-local-agent-factory-visualizer)
  Platform: [Local Agent Factory Visualizer](../../3-architecture/1-PLATFORMS.md#internal-platforms)

  Rule: Observe an active workflow

    Scenario: View phases while a workflow is running
      Given WorkflowRun{status: Running, runIdentifier: "run-123"}
      When I observeWorkflow(runIdentifier: "run-123")
      Then I view WorkflowTrace{runIdentifier: "run-123", status: Running} in Workflow Visualizer: Active run is visible
      And I view WorkflowPhase{status: Running} in Workflow Visualizer: Current phase is visible
      And I view ProcessActivity{status: Running} in Workflow Visualizer: Active process is visible

    Scenario: View tool calls during an agent phase
      Given AgentSession{role: "builder", status: Running}
      When I observeWorkflow(runIdentifier: "run-123")
      Then I view ToolCall{agent: "builder", arguments: Present, result: Present} in Workflow Visualizer: Agent activity is visible

  Rule: Inspect completed evidence

    Scenario: Inspect envelopes and validation results
      Given WorkflowRun{status: Succeeded, runIdentifier: "run-123"}
      When I observeWorkflow(runIdentifier: "run-123")
      Then I view Envelope{producer: Present, consumer: Present} in Workflow Visualizer: Phase handoffs are visible
      And I view ValidationResult{status: Succeeded, evidence: Present} in Workflow Visualizer: Validation evidence is visible

    Scenario: Inspect failed-workflow evidence
      Given WorkflowRun{status: Failed, runIdentifier: "run-456"}
      When I observeWorkflow(runIdentifier: "run-456")
      Then I view WorkflowTrace{status: Failed, failureEvidence: Present} in Workflow Visualizer: Failure evidence is retained
      And I view DisposableWorkspace{retained: true} in Workflow Visualizer: Failed workspace is inspectable
