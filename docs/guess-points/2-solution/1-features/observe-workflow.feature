# Source: Phase 0 issue #9 and the Super Simple Software Factory README.
Feature: Observe a workflow run
  Domain definitions: [Workflow Run](../../../../CONTEXT.md#workflow-run), [Workflow Phase](../../../../CONTEXT.md#workflow-phase), [Agent Session](../../../../CONTEXT.md#agent-session), [Envelope](../../../../CONTEXT.md#envelope), [Validation Gate](../../../../CONTEXT.md#validation-gate), [Trace](../../../../CONTEXT.md#trace), and [Workflow Visualizer](../../../../CONTEXT.md#workflow-visualizer)
  Actor: [Workflow Observer](../../1-problem/1-ROLES.md#horizontal-local-agent-factory-visualizer)
  Platform: [Local Agent Factory Visualizer](../../3-architecture/1-PLATFORMS.md#internal-platforms)

  As a Workflow Observer,
  I want to observe a workflow run,
  So that I can understand its progress and inspect its evidence without changing the run

  Rule: Observe active workflow progress

    Scenario: Follow phases while a run is active
      Given WorkflowRun{runIdentifier: "run-123", status: Running}
      And Trace{events: [phase_started, agent_started, tool_call]}
      When I observeWorkflow(runIdentifier: "run-123")
      Then I view WorkflowPhase{active: true, ordered: true} in Workflow Visualizer: Active phase progress is visible
      And I view Trace{events: [phase_started, agent_started, tool_call]} in Workflow Visualizer: Live events are visible

    Scenario: Inspect agent and validation evidence
      Given WorkflowRun{runIdentifier: "run-123", status: AwaitingReview}
      And Trace{events: [envelope, gate_pass, agent_end]}
      When I observeWorkflow(runIdentifier: "run-123")
      Then I view AgentSession{role: "builder", toolCalls: present} in Workflow Visualizer: Agent activity is inspectable
      And I view Envelope{valid: true} in Workflow Visualizer: Agent output is inspectable
      And I view ValidationGate{checks: present, passed: true} in Workflow Visualizer: Validation evidence is inspectable

    Scenario: Inspect a failed run and retained workspace
      Given WorkflowRun{runIdentifier: "run-456", status: Failed}
      And DisposableWorkspace{retained: true}
      When I observeWorkflow(runIdentifier: "run-456")
      Then I view WorkflowRun{runIdentifier: "run-456", status: Failed} in Workflow Visualizer: Failed run is identifiable
      And I view DisposableWorkspace{retained: true} in Workflow Visualizer: Failed workspace is available
      And I view Trace{failureEvidence: present} in Workflow Visualizer: Failure evidence is available
