Feature: Hand off from planning to implementation
  Domain definitions: [Workflow, Harness Primitive, Workflow Run, Run Context, and Prewalk](../../../../CONTEXT.md#language)
  Actor: [Workflow Operator](../../1-problem/1-ROLES.md#workflow-operator)
  Platform: [Local Agent Factory](../../3-architecture/1-PLATFORMS.md#local-agent-factory)

  As a Workflow Operator,
  I want a coding run to hand off from planning to implementation,
  So that a strong model can prepare the work before a faster model implements it

  Rule: Switch models at the first source edit

    Scenario: Handoff follows a successful Todo update
      Given Prewalk{planningModel: "slow", implementationModel: "fast", tools: "todo,read,edit,write"}
      And PiSession{identifier: "session-001", events: "read,todo,edit"}
      When I runPrewalk()
      Then I view PrewalkRun{sessionIdentifier: "session-001", status: HandedOff, handoffTool: "edit", implementationModel: "fast"} in Workflow Execution: The existing Pi session continues on the implementation model

  Rule: Keep discovery on the planning model

    Scenario: Discovery and Todo updates do not trigger a handoff
      Given Prewalk{planningModel: "slow", implementationModel: "fast", tools: "todo,read,grep,bash"}
      And PiSession{identifier: "session-002", events: "read,grep,bash,todo"}
      When I runPrewalk()
      Then I view PrewalkRun{sessionIdentifier: "session-002", status: CompletedWithoutHandoff, planningModel: "slow"} in Workflow Execution: Discovery remains on the planning model

  Rule: Skip a redundant handoff

    Scenario: Equal model selections do not create a handoff
      Given Prewalk{planningModel: "same", implementationModel: "same", planningThinking: "medium", implementationThinking: "medium", tools: "todo,edit"}
      And PiSession{identifier: "session-003", events: "todo,edit"}
      When I runPrewalk()
      Then I view PrewalkRun{sessionIdentifier: "session-003", status: CompletedWithoutHandoff, planningModel: "same"} in Workflow Execution: Equivalent selections do not switch models
