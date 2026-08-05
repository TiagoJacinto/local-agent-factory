Feature: Execute a configured agent workflow
  Source: [Phase 0 issue #9](https://github.com/TiagoJacinto/local-agent-factory/issues/9)
  Reference: [Super Simple Software Factory README](https://github.com/disler/super-simple-software-factory/blob/de31374882e7a4e3e5b7bb9bd09e69dc2f779356/README.md)
  Domain definitions: [Workflow, Workflow Primitive, Workflow Run, Workflow Envelope, Agent Role, Workflow Registry, Workflow Session, Validation, Validation Result, and Artifact](../../../../CONTEXT.md#language)
  Actor: [WorkflowOperator](../../1-problem/1-ROLES.md#horizontal-local-agent-factory-cli)
  Platform: [Local Agent Factory](../../3-architecture/1-PLATFORMS.md#internal-platforms)

  As a WorkflowOperator,
  I want to execute a configured agent workflow against a safe source revision,
  So that I receive validated work and retain control of integration

  Rule: Execute a registered workflow with configured roles

    Scenario: Execute a plan-build-test-review workflow
      Given WorkflowRegistry{registeredWorkflows: ["plan-build-test-review"]}
      And AgentRole{names: ["planner", "builder", "reviewer", "documenter"]}
      And SourceRepository{path: "/work/project", sourceRevision: "abc123", workingTree: Clean}
      When I executeWorkflow(workflowId: "plan-build-test-review", sourceRepository: "/work/project", expectedSourceRevision: "abc123")
      Then I view WorkflowRun{status: AwaitingReview, sourceRevision: "abc123", workspaceIsolation: IndependentClone} in Workflow Execution: Configured workflow completes before integration
        | invocationOrder | name              | primitiveType | status    |
        | 1               | Plan request      | AI            | Succeeded |
        | 2               | Build request     | Harness       | Succeeded |
        | 3               | Review change     | AI            | Succeeded |
        | 4               | Await human review | Gate          | Succeeded |
      And I view ValidationResult{status: Succeeded, evidence: Present} in Workflow Execution: Validation is recorded outside agent judgement

  Rule: Carry typed workflow envelopes and artifacts between roles

    Scenario: Pass a plan envelope to the builder
      Given WorkflowRegistry{registeredWorkflows: ["plan-build"]}
      And SourceRepository{path: "/work/project", sourceRevision: "abc123", workingTree: Clean}
      When I executeWorkflow(workflowId: "plan-build", sourceRepository: "/work/project", expectedSourceRevision: "abc123")
      Then I view WorkflowEnvelope{producer: "planner", consumer: "builder", status: Success, fields: [objective, risks, expectedFiles, acceptanceCriteria, validationCommands]} in Workflow Execution: Planner output is handed to the builder
      And I view Artifact{id: "plan", producerInvocationId: "planner", consumerInvocationId: "builder"} in Run Context: Plan artifact is consumed by the builder

  Rule: Run known validation as code and return inspectable evidence

    Scenario: Stop before review when validation fails
      Given WorkflowRegistry{registeredWorkflows: ["build-test-review"]}
      And SourceRepository{path: "/work/project", sourceRevision: "abc123", workingTree: Clean}
      When I executeWorkflow(workflowId: "build-test-review", sourceRepository: "/work/project", expectedSourceRevision: "abc123")
      Then I view WorkflowRun{status: Failed, failure: ValidationFailed} in Workflow Execution: Validation failure stops the workflow
      And I view ValidationResult{status: Failed, evidence: Present} in Workflow Execution: Validation evidence is inspectable
      And I !view InvocationResult{name: "Review change"} in Workflow Run: Review does not run on failed validation

  Rule: Correct a workflow without losing the active agent session

    Scenario: Send a review finding back to the builder
      Given WorkflowRegistry{registeredWorkflows: ["build-review"]}
      And SourceRepository{path: "/work/project", sourceRevision: "abc123", workingTree: Clean}
      When I executeWorkflow(workflowId: "build-review", sourceRepository: "/work/project", expectedSourceRevision: "abc123")
      Then I view WorkflowRun{status: AwaitingReview} in Workflow Execution: Corrected work reaches human review
        | invocationOrder | name                 | primitiveType | status    |
        | 1               | Build request        | Harness       | Succeeded |
        | 2               | Review change        | AI            | Succeeded |
        | 3               | Correct build        | Harness       | Succeeded |
        | 4               | Review corrected work | AI            | Succeeded |
        | 5               | Await human review   | Gate          | Succeeded |
      And I view WorkflowSession{sameAgentContext: true} in Workflow Execution: Correction keeps the active agent context

  Rule: Enforce role boundaries

    Scenario: Reject an unauthorized repository change
      Given WorkflowRegistry{registeredWorkflows: ["review"]}
      And AgentRole{name: "reviewer", allowedWrites: [], protectedPaths: ["workflow-engine"]}
      And SourceRepository{path: "/work/project", sourceRevision: "abc123", workingTree: Clean}
      When I executeWorkflow(workflowId: "review", sourceRepository: "/work/project", expectedSourceRevision: "abc123")
      Then I view WorkflowRun{status: Failed, failure: PermissionViolation} in Workflow Execution: Unauthorized changes fail the role phase
      And I view WorkflowEnvelope{status: Fail, summary: "repository change outside role boundary"} in Workflow Execution: Permission failure is reported

  Rule: Return a reviewable result without automatic integration

    Scenario: Finish with a commit or diff and manual integration guidance
      Given WorkflowRegistry{registeredWorkflows: ["simple-sdlc"]}
      And SourceRepository{path: "/work/project", sourceRevision: "abc123", workingTree: Clean}
      When I executeWorkflow(workflowId: "simple-sdlc", sourceRepository: "/work/project", expectedSourceRevision: "abc123")
      Then I view WorkflowRun{status: AwaitingReview, sourceRepositoryUnchanged: true, integration: Manual} in Workflow Execution: Human review is required
      And I view AgentRole{name: "documenter", output: Present} in Workflow Execution: The completed change has a documentation phase
      And I view Artifact{kind: ReviewableChange, reference: Present} in Workflow Execution: The change can be reviewed
      And I !view Artifact{kind: AutomaticIntegration} in Workflow Run: The factory does not integrate automatically
