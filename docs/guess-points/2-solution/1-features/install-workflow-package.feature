Feature: Install a workflow package
  Source: [Phase 0 issue #9](https://github.com/TiagoJacinto/local-agent-factory/issues/9)
  Reference: [Super Simple Software Factory README](https://github.com/disler/super-simple-software-factory/blob/de31374882e7a4e3e5b7bb9bd09e69dc2f779356/README.md)
  Domain definitions: [Workflow Package, Workflow Registry, Agent Role, Workflow, and Artifact](../../../../CONTEXT.md#language)
  Actor: [FactoryMaintainer](../../1-problem/1-ROLES.md#horizontal-local-agent-factory-setup)
  Platform: [Local Agent Factory setup](../../3-architecture/1-PLATFORMS.md#internal-platforms)

  As a FactoryMaintainer,
  I want to install a reusable workflow package in a repository,
  So that the repository has configurable workflows ready for its operators

  Rule: Install the factory package and starter registry

    Scenario: Install a reusable workflow package
      Given TargetRepository{path: "/work/project"}
      When I installWorkflowPackage(repository: "/work/project")
      Then I view WorkflowPackage{installed: true, repository: "/work/project"} in Factory Setup: The factory package is installed
      And I view WorkflowRegistry{registeredWorkflows: 12} in Factory Setup: Starter workflows are available
      And I view AgentRole{configuredRoles: ["planner", "builder", "scout", "reviewer", "documenter"]} in Factory Setup: Starter roles are available

  Rule: Configure the installed roles and workflows

    Scenario: Set role capabilities and workflow configuration
      Given WorkflowPackage{installed: true, repository: "/work/project"}
      When I configureWorkflowPackage(repository: "/work/project")
      Then I view AgentRole{model: Present, instructions: Present, tools: Present, allowedWrites: Present} in Factory Setup: Role configuration is explicit
      And I view WorkflowRegistry{registeredWorkflows: Present} in Factory Setup: Workflow configuration is available

  Rule: Make installation repeatable

    Scenario: Reinstall without overwriting local configuration
      Given WorkflowPackage{installed: true, repository: "/work/project", localConfiguration: Present}
      When I installWorkflowPackage(repository: "/work/project")
      Then I view WorkflowPackage{installed: true, localConfiguration: Preserved} in Factory Setup: Existing configuration is preserved
      And I view WorkflowRegistry{registeredWorkflows: Present} in Factory Setup: The registry remains usable
