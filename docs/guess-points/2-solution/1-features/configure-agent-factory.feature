# Source: Phase 0 issue #9 and the Super Simple Software Factory README.
Feature: Configure a reusable agent factory
  Domain definitions: [Factory Package](../../../../CONTEXT.md#factory-package), [Agent Role](../../../../CONTEXT.md#agent-role), [Agent Roster](../../../../CONTEXT.md#agent-roster), [Workflow Catalog](../../../../CONTEXT.md#workflow-catalog), and [Write Boundary](../../../../CONTEXT.md#write-boundary)
  Actor: [Factory Maintainer](../../1-problem/1-ROLES.md#horizontal-local-agent-factory-cli)
  Platform: [Local Agent Factory](../../3-architecture/1-PLATFORMS.md#internal-platforms)

  As a Factory Maintainer,
  I want to install and configure a reusable agent factory,
  So that Workflow Operators can run consistent workflows in a repository

  Rule: Install the factory package

    Scenario: Stamp the factory into a repository
      Given SourceRepository{workingTree: Clean}
      And FactoryPackage{version: "current", installable: true}
      When I configureFactory(action: install, sourceRepository: "repository")
      Then I view FactoryPackage{installed: true, starterConfiguration: present} in Factory Configuration: Factory is installed
      And I view WorkflowCatalog{starterWorkflows: 12} in Factory Configuration: Starter workflows are available

    Scenario: Reinstall without overwriting repository configuration
      Given FactoryPackage{version: "current"}
      And AgentRoster{configuration: "repository configuration"}
      When I configureFactory(action: install, sourceRepository: "repository")
      Then I view FactoryPackage{installed: true, skippedExistingFiles: true} in Factory Configuration: Existing configuration is preserved
      And I view AgentRoster{configuration: "repository configuration"} in Factory Configuration: Repository choices remain intact

  Rule: Configure the agent roster

    Scenario: Configure role-specific models and instructions
      Given FactoryPackage{installed: true}
      When I configureFactory(action: updateRoster, roles: [planner, builder, scout, reviewer, documenter])
      Then I view AgentRoster{roles: [planner, builder, scout, reviewer, documenter], modelPerRole: true, instructionsPerRole: true} in Factory Configuration: Role configuration is available
      And I view WorkflowCatalog{configurationSource: AgentRoster} in Factory Configuration: Workflows use the configured roster

    Scenario: Configure role tools and write boundaries
      Given AgentRoster{roles: [scout, builder, reviewer]}
      When I configureFactory(action: updatePermissions, role: "reviewer", tools: [read], writeBoundary: [])
      Then I view AgentRole{name: "reviewer", tools: [read], writeBoundary: []} in Factory Configuration: Reviewer capabilities are constrained
      And I !view AgentRole{name: "reviewer", writeBoundary: ["repository"]} in Factory Configuration: Reviewer has no unrestricted write access

    Scenario: Register a named workflow
      Given FactoryPackage{installed: true}
      When I configureFactory(action: registerWorkflow, workflowId: "simple-sdlc", phases: [plan, build, test, review, document])
      Then I view Workflow{ id: "simple-sdlc", phases: [plan, build, test, review, document] } in Factory Configuration: Workflow is registered
      And I view WorkflowCatalog{contains: "simple-sdlc"} in Factory Configuration: Registered workflow can be selected
