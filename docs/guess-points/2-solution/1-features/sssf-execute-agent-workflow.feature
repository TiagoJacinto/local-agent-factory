# Source: Super Simple Software Factory README and current conversation.
Feature: Execute an agent workflow
  As a Workflow Operator,
  I want to execute a named agent workflow,
  So that I receive a validated and reviewable change
  Domain definitions: [Workflow](../../../../CONTEXT.md#workflow), [Workflow Primitive](../../../../CONTEXT.md#workflow-primitive), [Workflow Phase](../../../../CONTEXT.md#workflow-phase), [Agent Session](../../../../CONTEXT.md#agent-session), [Envelope](../../../../CONTEXT.md#envelope), [Validation Gate](../../../../CONTEXT.md#validation-gate), [Review Handoff](../../../../CONTEXT.md#review-handoff), and [Write Boundary](../../../../CONTEXT.md#write-boundary)
  Actor: [Workflow Operator](../../1-problem/1-ROLES.md#horizontal-local-agent-factory-cli)
  Platform: [Local Agent Factory](../../3-architecture/1-PLATFORMS.md#internal-platforms)

  Rule: Run bounded phases through the configured agent harness

    Scenario: Execute a plan-build-test workflow
      Given WorkflowRegistry{registeredWorkflows: [plan-build-test]}
      And AgentRoster{roles: [planner, builder]}
      And SourceRepository{workingTree: Clean, sourceRevision: "source-123"}
      When I executeWorkflow(workflowId: "plan-build-test", objective: "add a health endpoint", expectedSourceRevision: "source-123")
      Then I view WorkflowRun{status: Succeeded, sourceRevision: "source-123", workspaceIsolation: IndependentClone} in Workflow Execution: Workflow completes in a disposable workspace
      And I view WorkflowPhase{owners: [planner, builder, quality]} in Workflow Execution: Bounded phases are recorded

    Scenario: Run Pi with the configured role
      Given AgentRole{name: "builder", model: Present, instructions: Present, tools: [read, write, edit, bash]}
      And DisposableWorkspace{sourceRevision: "source-123"}
      When I executeWorkflow(workflowId: "build", objective: "add a health endpoint", expectedSourceRevision: "source-123")
      Then I view AgentSession{role: "builder", provider: Pi, status: Succeeded} in Workflow Execution: Pi performs the bounded work
      And I !view SourceRepository{changedBy: "builder"} in Source Repository: The source repository remains unchanged

  Rule: Transfer explicit typed results between phases

    Scenario: Pass a plan envelope to the builder
      Given Workflow{phases: [planner, builder]}
      When I executeWorkflow(workflowId: "plan-build", objective: "add a health endpoint")
      Then I view Envelope{producer: "planner", consumer: "builder", valid: true} in Workflow Execution: The typed plan reaches the builder
      And I view Artifact{id: "plan", producer: "planner", consumer: "builder"} in Workflow Execution: The plan artifact is recorded

  Rule: Validate work with deterministic gates

    Scenario: Stop before review when validation fails
      Given Workflow{validationCommands: [format, lint, typecheck, test]}
      When I executeWorkflow(workflowId: "quality", objective: "validate the health endpoint")
      Then I view ValidationResult{commands: [format, lint, typecheck, test], status: Failed} in Workflow Execution: Validation failure is recorded
      And I !view AgentSession{role: "reviewer"} in Workflow Execution: Review does not run after failed validation

  Rule: Correct failures without restarting the agent session

    Scenario: Correct invalid output in the same session
      Given AgentSession{role: "builder", resumable: true}
      When I executeWorkflow(workflowId: "build", objective: "add a health endpoint")
      Then I view AgentSession{role: "builder", continuationCount: 1} in Workflow Execution: The builder receives one correction
      And I view Envelope{status: Success} in Workflow Execution: Corrected output is accepted

    Scenario: Return review findings to the builder
      Given Workflow{phases: [builder, reviewer, builder, reviewer]}
      When I executeWorkflow(workflowId: "build-review", objective: "add a health endpoint")
      Then I view Envelope{producer: "reviewer", consumer: "builder", failure: Present} in Workflow Execution: Findings reach the builder
      And I view WorkflowRun{status: AwaitingReview} in Workflow Execution: Corrected work reaches human review

  Rule: Enforce agent permissions

    Scenario: Reject a change outside the builder write boundary
      Given AgentRole{name: "builder", allowedWrites: ["src/"]}
      When I executeWorkflow(workflowId: "build", objective: "change workflow machinery")
      Then I view WorkflowRun{status: Failed, failure: PermissionViolation} in Workflow Execution: Unauthorized work fails
      And I view SourceRepository{unauthorizedChanges: false} in Source Repository: Unauthorized changes are absent

  Rule: Preserve human integration authority

    Scenario: Return a reviewable change without automatic integration
      Given SourceRepository{workingTree: Clean, sourceRevision: "source-123"}
      When I executeWorkflow(workflowId: "simple-sdlc", objective: "add a health endpoint")
      Then I view ReviewHandoff{status: AwaitingReview, integration: Manual} in Workflow Execution: Human review is required
      And I !view AutomaticIntegration{} in Workflow Execution: The factory does not merge automatically
