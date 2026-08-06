Feature: Execute a repeatable agent workflow
  As a Workflow Operator,
  I want to execute a repeatable agents-plus-code workflow,
  So that I receive a validated change proposal without changing my source repository
  Domain definitions: [Workflow](../../../../CONTEXT.md#workflow), [Workflow Phase](../../../../CONTEXT.md#workflow-phase), [Workflow Run](../../../../CONTEXT.md#workflow-run), [Agent Session](../../../../CONTEXT.md#agent-session), [Envelope](../../../../CONTEXT.md#envelope), [Validation](../../../../CONTEXT.md#validation), [Review Handoff](../../../../CONTEXT.md#review-handoff), and [Disposable Workspace](../../../../CONTEXT.md#disposable-workspace)
  Actor: [Workflow Operator](../../1-problem/1-ROLES.md#workflow-operator)
  Platform: [Local Agent Factory](../../3-architecture/1-PLATFORMS.md#internal-platforms)

  Rule: Execute bounded phases through the configured agent harness

    Scenario: Execute a starter workflow in an isolated workspace
      Given WorkflowCatalog{workflowId: "plan-build-test-quality", status: Registered}
      And AgentRoster{roles: [planner, builder, reviewer]}
      And SourceRepository{workingTree: Clean, sourceRevision: "source-123"}
      When I executeWorkflow(workflowId: "plan-build-test-quality", objective: "add a health endpoint", expectedSourceRevision: "source-123")
      Then I view WorkflowRun{status: AwaitingReview, sourceRevision: "source-123", workspaceIsolation: IndependentClone} in Workflow Execution: The workflow runs in a disposable workspace
      And I view WorkflowPhase{owners: [planner, builder, reviewer]} in Workflow Execution: Bounded phases are recorded
      And I !view SourceRepository{changedBy: WorkflowRun} in Source Repository: The source repository remains unchanged

    Scenario: Run a configured Pi agent
      Given AgentRole{name: "builder", model: Present, instructions: Present, tools: [read, write, edit, bash], writeBoundary: ["src/"]}
      And DisposableWorkspace{sourceRevision: "source-123"}
      When I executeWorkflow(workflowId: "build", objective: "add a health endpoint", expectedSourceRevision: "source-123")
      Then I view AgentSession{role: "builder", provider: Pi, status: Succeeded} in Workflow Execution: Pi performs the bounded work
      And I !view SourceRepository{changedBy: builder} in Source Repository: Agent work stays out of the source repository

  Rule: Carry explicit typed results between phases

    Scenario: Pass a typed plan to the builder
      Given Workflow{phases: [planner, builder]}
      When I executeWorkflow(workflowId: "plan-build", objective: "add a health endpoint")
      Then I view Envelope{producer: "planner", consumer: "builder", valid: true} in Workflow Execution: The plan crosses the phase boundary
      And I view Artifact{id: "plan", producer: "planner", consumer: "builder"} in Workflow Execution: The plan artifact is available

    Scenario: Correct an invalid agent envelope in the same session
      Given AgentSession{role: "planner", resumable: true}
      And AgentOutput{status: Invalid, failure: "missing acceptance criteria"}
      When I executeWorkflow(workflowId: "plan-build", objective: "add a health endpoint")
      Then I view AgentSession{role: "planner", continuationCount: 1} in Workflow Execution: The planner receives a correction without a cold restart
      And I view Envelope{status: Valid} in Workflow Execution: The corrected envelope is accepted

  Rule: Use deterministic code for validation and acceptance

    Scenario: Run configured quality commands
      Given Workflow{validationCommands: [format, lint, typecheck, test]}
      And DisposableWorkspace{changedFiles: ["src/health.ts"]}
      When I executeWorkflow(workflowId: "quality", objective: "validate the health endpoint")
      Then I view ValidationResult{commands: [format, lint, typecheck, test], status: Succeeded, evidence: Present} in Workflow Execution: Known checks run as code
      And I view ValidationGate{passed: true} in Workflow Execution: The validation result is accepted

    Scenario: Return a failed check to the active builder
      Given Workflow{phases: [builder, test, builder, test]}
      And ValidationResult{status: Failed, findings: ["test failure"]}
      When I executeWorkflow(workflowId: "build-test", objective: "add a health endpoint")
      Then I view Envelope{producer: "test", consumer: "builder", failure: "test failure"} in Workflow Execution: The finding reaches the builder
      And I view ValidationResult{status: Succeeded} in Workflow Execution: Corrected work passes validation

  Rule: Enforce role boundaries and preserve review authority

    Scenario: Reject work outside the write boundary
      Given AgentRole{name: "builder", writeBoundary: ["src/"]}
      And SourceRepository{workingTree: Clean, sourceRevision: "source-123"}
      When I executeWorkflow(workflowId: "build", objective: "change protected workflow machinery", expectedSourceRevision: "source-123")
      Then I view WorkflowRun{status: Failed, failure: PermissionViolation} in Workflow Execution: Unauthorized work fails the phase
      And I !view SourceRepository{unauthorizedChanges: true} in Source Repository: Protected content remains unchanged

    Scenario: Return a review handoff without automatic integration
      Given SourceRepository{workingTree: Clean, sourceRevision: "source-123"}
      When I executeWorkflow(workflowId: "simple-sdlc", objective: "add a health endpoint", expectedSourceRevision: "source-123")
      Then I view ReviewHandoff{status: AwaitingReview, manualIntegrationGuidance: Present} in Workflow Execution: Human review is required
      And I !view AutomaticIntegration{} in Workflow Execution: The operator retains integration authority

  Rule: Resume the same workflow session

    Scenario: Continue an existing run
      Given WorkflowRun{runIdentifier: "run-123", status: AwaitingReview}
      And AgentSession{role: "builder", sessionId: "session-123", resumable: true}
      When I resumeWorkflow(runIdentifier: "run-123", correction: "address the review finding")
      Then I view WorkflowRun{runIdentifier: "run-123"} in Workflow Execution: The run keeps its identity
      And I view AgentSession{role: "builder", sessionId: "session-123"} in Workflow Execution: The active agent context is resumed

  Rule: Preserve code-owned products when the workflow defines commit phases

    Scenario: Produce separate accepted work products
      Given Workflow{phases: [planner, commit-plan, builder, test, commit-build, documenter, commit-docs]}
      When I executeWorkflow(workflowId: "simple-sdlc", objective: "add a health endpoint")
      Then I view ReviewHandoff{commits: [plan, build, documentation]} in Workflow Execution: Work products have separate commits
      And I view WorkflowPhase{owners: [planner, git, builder, quality, documenter]} in Workflow Execution: Code and agent ownership is visible
