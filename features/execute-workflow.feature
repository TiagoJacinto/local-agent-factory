Feature: Execute a workflow controller
  Domain definitions: [Workflow, Workflow Primitive, Primitive Invocation, Pure Computation, Composite Function, Workflow Executor, Workflow Run, Run Context, and Artifact](../CONTEXT.md#language)

  As a workflow author,
  I want to execute a workflow controller through one workflow executor,
  So that I can inspect its ordered invocation results and artifacts

  Rule: Record primitive invocations in controller order

    Scenario: Execute AI, Harness, and Gate primitives
      Given Workflow{id: "readme-update", name: "Update README"}
        | callOrder | function | invocationId | name                | input                 |
        | 1         | AI       | draft        | Draft README        | Draft a README update |
        | 2         | Harness  | apply        | Apply README update  | Apply the draft       |
        | 3         | Gate     | approve      | Approve README update | Review the change     |
      When I executeWorkflow(workflowId: "readme-update")
      Then I view WorkflowRun{workflowId: "readme-update", status: Succeeded} in Workflow Execution: Primitive invocations follow controller order
        | invocationOrder | invocationId | name                  | primitiveType | resultType              | status    |
        | 1               | draft        | Draft README          | AI            | AIInvocationResult      | Succeeded |
        | 2               | apply        | Apply README update    | Harness       | HarnessInvocationResult | Succeeded |
        | 3               | approve      | Approve README update  | Gate          | GateInvocationResult    | Succeeded |

  Rule: Carry artifacts between primitive invocations

    Scenario: Harness receives an artifact produced by AI
      Given Workflow{id: "artifact-demo", name: "Apply an AI draft"}
        | callOrder | function | invocationId | name             | inputArtifact | outputArtifact   |
        | 1         | AI       | draft        | Draft README     | none          | readme-draft     |
        | 2         | Harness  | apply        | Apply AI draft   | readme-draft  | repository-change |
      When I executeWorkflow(workflowId: "artifact-demo")
      Then I view WorkflowRun{workflowId: "artifact-demo", status: Succeeded} in Workflow Execution: Artifact workflow succeeds
        | invocationOrder | invocationId | primitiveType | resultType              | consumedArtifact | producedArtifact  |
        | 1               | draft        | AI            | AIInvocationResult      | none             | readme-draft      |
        | 2               | apply        | Harness       | HarnessInvocationResult | readme-draft     | repository-change |
      And I view Artifact{id: "readme-draft", producerInvocationId: "draft", consumerInvocationId: "apply"} in Run Context: AI artifact is available to Harness

  Rule: Compose ordinary code with workflow primitives

    Scenario: Pure computation supplies input without creating an invocation
      Given Workflow{id: "pure-computation", name: "Build an AI prompt"}
        | callOrder | function          | functionClass      | invocationId | name         | input                         | output                       |
        | 1         | BuildReadmePrompt | Pure Computation   | none         | none         | README.md                     | Draft an update to README.md |
        | 2         | AI                | Workflow Primitive | draft-readme | Draft README | Draft an update to README.md  | readme-draft                 |
      When I executeWorkflow(workflowId: "pure-computation")
      Then I view WorkflowRun{workflowId: "pure-computation", status: Succeeded} in Workflow Execution: Only the primitive call creates an invocation result
        | invocationOrder | invocationId | name         | primitiveType | resultType         | status    |
        | 1               | draft-readme | Draft README | AI            | AIInvocationResult | Succeeded |
      And I view AIInvocationResult{invocationId: "draft-readme", prompt: "Draft an update to README.md"} in Workflow Execution: Pure computation output reaches AI
      But I view InvocationResult{function: "BuildReadmePrompt"} not in Workflow Run: Pure computation is not recorded as a primitive invocation

    Scenario: A composite function calls a primitive without becoming an invocation
      Given Workflow{id: "composite-function", name: "Verify README"}
        | callOrder | function                           | functionClass     | callsPrimitive | invocationId | invocationName |
        | 1         | VerifyThatREADMEFollowsRepoRules   | Composite Function | Harness        | verify-readme | Verify README  |
      When I executeWorkflow(workflowId: "composite-function")
      Then I view WorkflowRun{workflowId: "composite-function", status: Succeeded} in Workflow Execution: Called primitive creates the invocation result
        | invocationOrder | invocationId | name          | primitiveType | resultType              | status    |
        | 1               | verify-readme | Verify README | Harness       | HarnessInvocationResult | Succeeded |
      And I view HarnessInvocationResult{invocationId: "verify-readme", status: Succeeded} in Workflow Execution: Composite function delegates to Harness
      But I view InvocationResult{function: "VerifyThatREADMEFollowsRepoRules"} not in Workflow Run: Composite function itself is not recorded
