# Source: Super Simple Software Factory README and current conversation.
Feature: Configure a reusable agent factory
  As a Factory Maintainer,
  I want to install and configure a reusable agent factory,
  So that Workflow Operators can run consistent workflows in a target repository
  Domain definitions: [Factory Package](../../../../CONTEXT.md#factory-package), [Workflow Package](../../../../CONTEXT.md#workflow-package), [Agent Role](../../../../CONTEXT.md#agent-role), [Agent Roster](../../../../CONTEXT.md#agent-roster), [Workflow Registry](../../../../CONTEXT.md#workflow-registry), and [Write Boundary](../../../../CONTEXT.md#write-boundary)
  Actor: [Factory Maintainer](../../1-problem/1-ROLES.md#horizontal-local-agent-factory-cli)
  Platform: [Local Agent Factory](../../3-architecture/1-PLATFORMS.md#internal-platforms)

  Rule: Install a reusable workflow package

    Scenario: Stamp the factory into a target repository
      Given TargetRepository{path: "/work/project"}
      When I installWorkflowPackage(repository: "/work/project")
      Then I view WorkflowPackage{installed: true, repository: "/work/project"} in Factory Setup: Factory package is installed
      And I view WorkflowRegistry{starterWorkflows: 12} in Factory Setup: Starter workflows are available
      And I view AgentRoster{roles: [planner, builder, scout, reviewer, documenter]} in Factory Setup: Starter roles are available

    Scenario: Reinstall without losing local configuration
      Given WorkflowPackage{installed: true, localConfiguration: Present}
      When I installWorkflowPackage(repository: "/work/project")
      Then I view WorkflowPackage{localConfiguration: Preserved} in Factory Setup: Existing configuration remains active

  Rule: Configure each agent role

    Scenario: Configure role capabilities
      Given WorkflowPackage{installed: true}
      When I configureAgentRole(role: "builder", model: Present, instructions: Present, tools: Present, allowedWrites: ["src/"])
      Then I view AgentRole{name: "builder", model: Present, instructions: Present, tools: Present, allowedWrites: ["src/"]} in Factory Setup: Builder capabilities are explicit

    Scenario: Configure role-specific harness support
      Given WorkflowPackage{installed: true}
      When I configureAgentRole(role: "planner", harnessSupport: Present)
      Then I view AgentRole{name: "planner", harnessSupport: Present} in Factory Setup: Planner support is configured

  Rule: Register reusable workflows

    Scenario: Select a named starter workflow
      Given WorkflowRegistry{starterWorkflows: [prompt, scout, plan, build, quality, plan-build, build-test, build-review, plan-build-test, plan-build-test-quality, document, simple-sdlc]}
      When I selectWorkflow(workflowId: "simple-sdlc")
      Then I view Workflow{ id: "simple-sdlc" } in Workflow Catalog: Named workflow is available
