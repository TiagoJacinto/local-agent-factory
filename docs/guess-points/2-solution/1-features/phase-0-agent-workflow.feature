# Source: Phase 0 issue #9 and the Super Simple Software Factory README.
Feature: Execute a reusable agent workflow
  Domain definitions: [Workflow](../../../../CONTEXT.md#workflow), [Workflow Catalog](../../../../CONTEXT.md#workflow-catalog), [Agent Role](../../../../CONTEXT.md#agent-role), [Agent Roster](../../../../CONTEXT.md#agent-roster), [Agent Session](../../../../CONTEXT.md#agent-session), [Workflow Phase](../../../../CONTEXT.md#workflow-phase), [Envelope](../../../../CONTEXT.md#envelope), [Validation Gate](../../../../CONTEXT.md#validation-gate), [Review Handoff](../../../../CONTEXT.md#review-handoff), [Workflow Run](../../../../CONTEXT.md#workflow-run), and [Trace](../../../../CONTEXT.md#trace)
  Actor: [Workflow Operator](../../1-problem/1-ROLES.md#horizontal-local-agent-factory-cli)
  Platform: [Local Agent Factory](../../3-architecture/1-PLATFORMS.md#internal-platforms)

  As a Workflow Operator,
  I want to execute a reusable agent workflow,
  So that I can receive and inspect a validated change proposal without changing my source repository

  Rule: Execute registered workflows through bounded phases

    Scenario: Execute a configured starter workflow
      Given WorkflowCatalog{starterWorkflows: 12}
      And AgentRoster{roles: [planner, builder, scout, reviewer, documenter]}
      And SourceRepository{workingTree: Clean, sourceRevision: "source-123"}
      When I executeWorkflow(workflowId: "plan-build-test", objective: "add a health endpoint", expectedSourceRevision: "source-123")
      Then I view WorkflowRun{status: Succeeded, sourceRevision: "source-123"} in Workflow Execution: Starter workflow completes
      And I view WorkflowPhase{names: [plan, build, test]} in Workflow Execution: Workflow phases are explicit

    Scenario: Run a coding agent in an isolated workspace
      Given AgentRole{name: "builder", purpose: "implement the approved change", tools: [read, write], writeBoundary: ["src/"]}
      And DisposableWorkspace{sourceRevision: "source-123"}
      When I executeWorkflow(workflowId: "build", objective: "add a health endpoint", expectedSourceRevision: "source-123")
      Then I view HarnessInvocationResult{status: Succeeded, workspaceRevision: "source-123"} in Workflow Execution: Builder ran in the disposable workspace
      And I !view SourceRepository{changedBy: "builder"} in Source Repository: Source repository remains untouched

    Scenario: Carry a typed envelope between phases
      Given Workflow{phases: [planner, builder]}
      And Envelope{type: "PlanOutput", fields: [objective, expectedFiles, risks, acceptanceCriteria, validationCommands]}
      When I executeWorkflow(workflowId: "plan-build", objective: "add a health endpoint")
      Then I view Envelope{producer: "planner", consumer: "builder", valid: true} in Workflow Execution: Plan reaches the builder
      And I view WorkflowRun{status: Succeeded} in Workflow Execution: Typed handoff is recorded

    Scenario: Run configurable validation as ordinary code
      Given Workflow{validationCommands: [format, lint, typecheck, test]}
      And DisposableWorkspace{changedFiles: ["src/health.ts"]}
      When I executeWorkflow(workflowId: "quality", objective: "validate the health endpoint")
      Then I view ValidationResult{commands: [format, lint, typecheck, test], status: Succeeded} in Workflow Execution: Validation evidence is recorded
      And I view ValidationGate{checked: [format, lint, typecheck, test], passed: true} in Workflow Execution: Validation gates pass

    Scenario: Correct an invalid agent envelope in the same session
      Given AgentSession{role: "builder", resumable: true}
      And Envelope{type: "BuildOutput", valid: false, failure: "missing changedFiles"}
      When I executeWorkflow(workflowId: "build", objective: "add a health endpoint")
      Then I view AgentSession{role: "builder", continuationCount: 1} in Workflow Execution: Builder receives a correction without a cold restart
      And I view Envelope{type: "BuildOutput", valid: true} in Workflow Execution: Corrected envelope is accepted

    Scenario: Return validation findings to the builder
      Given Workflow{phases: [builder, test, builder, test]}
      And ValidationResult{status: Failed, findings: ["test failure"]}
      When I executeWorkflow(workflowId: "build-test", objective: "add a health endpoint")
      Then I view Envelope{producer: "test", consumer: "builder", failure: "test failure"} in Workflow Execution: Findings reach the builder
      And I view ValidationResult{status: Succeeded} in Workflow Execution: Corrected work passes validation

    Scenario: Review the change before the run is accepted
      Given Workflow{phases: [planner, builder, test, reviewer, documenter]}
      And ReviewHandoff{plan: present, diff: present, validationEvidence: present}
      When I executeWorkflow(workflowId: "simple-sdlc", objective: "add a health endpoint")
      Then I view GateInvocationResult{decision: AwaitingReview} in Workflow Execution: Human review is required
      And I view ReviewHandoff{status: AwaitingReview, manualIntegrationGuidance: present} in Workflow Execution: Review handoff is complete

    Scenario: Resume a workflow with the same agent context
      Given AgentSession{role: "planner", sessionId: "session-123", resumable: true}
      And WorkflowRun{runIdentifier: "run-123", status: AwaitingReview}
      When I executeWorkflow(workflowId: "build-test", objective: "continue the health endpoint", runIdentifier: "run-123")
      Then I view AgentSession{role: "planner", sessionId: "session-123"} in Workflow Execution: Existing agent context is resumed
      And I view WorkflowRun{runIdentifier: "run-123"} in Workflow Execution: Continued run keeps its identity

    Scenario: Enforce an agent write boundary
      Given AgentRole{name: "reviewer", writeBoundary: []}
      And AgentSession{role: "reviewer"}
      When I executeWorkflow(workflowId: "review", objective: "review the health endpoint")
      Then I view WorkflowRun{status: Succeeded} in Workflow Execution: Read-only review completes
      And I !view SourceRepository{unauthorizedChanges: true} in Source Repository: Unauthorized reviewer changes are absent

    Scenario: Preserve failure evidence
      Given AgentRole{name: "builder", purpose: "implement the approved change"}
      And ValidationResult{status: Failed, output: "test failure output"}
      When I executeWorkflow(workflowId: "build-test", objective: "add a health endpoint")
      Then I view WorkflowRun{status: Failed} in Workflow Execution: Failed run is visible
      And I view ValidationResult{status: Failed, output: "test failure output"} in Workflow Execution: Failure output is retained
      And I view DisposableWorkspace{retained: true} in Workflow Execution: Failed workspace is inspectable

    Scenario: Separate code-owned commits from agent-owned work
      Given Workflow{phases: [planner, commit-plan, builder, test, commit-build, documenter, commit-docs]}
      When I executeWorkflow(workflowId: "simple-sdlc", objective: "add a health endpoint")
      Then I view ReviewHandoff{commits: [plan, build, documentation]} in Workflow Execution: Work products have separate commits
      And I view Trace{phaseOwners: [planner, git, builder, quality, documenter]} in Workflow Execution: Code and agent ownership is visible
