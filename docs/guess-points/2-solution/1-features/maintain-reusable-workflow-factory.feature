Feature: Maintain a reusable workflow factory
  As a Factory Maintainer,
  I want to install and maintain a reusable workflow factory,
  So that Workflow Operators can run consistent agents-plus-code workflows
  Domain definitions: [Workflow Package](../../../../CONTEXT.md#workflow-package), [Agent Roster](../../../../CONTEXT.md#agent-roster), [Workflow Catalog](../../../../CONTEXT.md#workflow-catalog), [Agent Role](../../../../CONTEXT.md#agent-role), and [Write Boundary](../../../../CONTEXT.md#write-boundary)
  Actor: [Factory Maintainer](../../1-problem/1-ROLES.md#factory-maintainer)
  Platform: [Local Agent Factory setup](../../3-architecture/1-PLATFORMS.md#internal-platforms)

  Rule: Install a complete package in a target repository

    Scenario: Install the starter factory
      Given TargetRepository{path: "/work/project", existingConfiguration: Absent}
      When I installWorkflowPackage(repository: "/work/project")
      Then I view WorkflowPackage{status: Installed} in Factory Setup: The reusable package is installed
      And I view WorkflowCatalog{starterWorkflows: 12} in Factory Setup: The starter catalog is available
      And I view AgentRoster{roles: [planner, builder, scout, reviewer, documenter]} in Factory Setup: The starter roster is available

    Scenario: Refresh without losing local configuration
      Given WorkflowPackage{status: Installed}
      And AgentRole{name: "builder", model: "local-model", writeBoundary: ["src/"]}
      When I installWorkflowPackage(repository: "/work/project")
      Then I view AgentRole{name: "builder", model: "local-model", writeBoundary: ["src/"]} in Factory Setup: Local role configuration is preserved
      And I view WorkflowPackage{status: Installed} in Factory Setup: The package remains usable

  Rule: Configure the agent roster

    Scenario: Configure a role with explicit capabilities
      Given WorkflowPackage{status: Installed}
      When I configureAgentRole(role: "builder", model: "builder-model", instructions: "Build the requested change", tools: [read, write, edit, bash], writeBoundary: ["src/"])
      Then I view AgentRole{name: "builder", model: "builder-model", instructions: Present, tools: [read, write, edit, bash], writeBoundary: ["src/"]} in Factory Setup: Builder capabilities are explicit

    Scenario: Reject an unavailable role
      Given WorkflowPackage{status: Installed}
      When I configureAgentRole(role: "unknown", model: "model")
      Then I view FactorySetup{status: Failed, failure: UnknownAgentRole} in Factory Setup: Only configured roles can be changed

  Rule: Author and verify workflows

    Scenario: Create a bounded workflow
      Given WorkflowPackage{status: Installed}
      When I createWorkflow(workflowId: "plan-build-security", phases: [planner, builder, security], acceptance: Present)
      Then I view WorkflowCatalog{workflowId: "plan-build-security", status: Registered} in Factory Setup: The custom workflow is registered
      And I view WorkflowPhase{names: [planner, builder, security]} in Factory Setup: The workflow phases are bounded

    Scenario: Update a registered workflow
      Given WorkflowCatalog{workflowId: "plan-build-security", status: Registered}
      When I updateWorkflow(workflowId: "plan-build-security", phases: [planner, builder, tester, security], acceptance: Present)
      Then I view WorkflowCatalog{workflowId: "plan-build-security", status: Registered} in Factory Setup: The workflow definition is updated
      And I view WorkflowPhase{names: [planner, builder, tester, security]} in Factory Setup: The updated phases are available

    Scenario: Reject an incomplete workflow configuration
      Given WorkflowPackage{status: Installed}
      When I verifyFactory(repository: "/work/project")
      Then I view FactorySetup{status: Failed, failure: InvalidWorkflowConfiguration} in Factory Setup: Invalid configuration is reported before execution
