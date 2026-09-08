Feature: Implement a structure outline as reviewed stacked pull requests
  A Workflow Operator can turn each phase of a structure outline into a validated pull request while deterministic code controls sequencing, publication, visual evidence, and feedback handling.

  Rule: Publish each validated outline phase as one pull request in a stack

    Scenario: Implement and publish a two-phase outline
      Given a clean Source Repository at its expected Source Revision
      And a structure outline with these phases
        | phase | title               | changesUI |
        | 1     | Add account panel   | yes       |
        | 2     | Persist preferences | no        |
      When I execute the implement-outline Workflow
      Then the Workflow Run publishes these pull requests in order
        | phase | headBranch                | baseBranch                |
        | 1     | rpi/account-panel/phase-1 | main                      |
        | 2     | rpi/account-panel/phase-2 | rpi/account-panel/phase-1 |
      And each pull request contains only its phase's reviewed diff
      And each pull request description accounts for every changed file and records its verification evidence
      And phase 1 contains verified before-and-after visual evidence
      But phase 2 contains no visual evidence
      And Run Evidence shows that phase 1 captures were produced before its pull request was created

  Rule: Repair failed deterministic validation before publication

    Scenario: Publish a phase after an agent repairs a failed command
      Given an outline phase whose first deterministic validation attempt fails
      And an implementation agent can repair the reported failure
      When I execute the implement-outline Workflow
      Then the failed command output is preserved as Run Evidence
      And one fresh implementation agent receives the verbatim failure
      And deterministic validation runs again
      And the phase pull request is published only after validation passes

    Scenario: Stop when validation remains unsuccessful
      Given an outline phase whose deterministic validation fails three times
      When I execute the implement-outline Workflow
      Then the Workflow Run stops after three validation attempts
      And the failed Disposable Workspace is retained
      And no pull request is published for the failed phase
      And no later outline phase begins

  Rule: Process pull request feedback without concurrent stack mutation

    Scenario: Inspect each new pull request comment exactly once
      Given a published pull request stack
      And GitHub reports these previously unseen comments
        | commentId | pullRequest | requiredAction |
        | C1        | phase-1     | no_change      |
        | C2        | phase-2     | reply_only     |
        | C3        | phase-1     | fix            |
      When the Workflow babysits the pull request stack
      Then one fresh agent inspects comment C1
      And one fresh agent inspects comment C2
      And one fresh agent inspects comment C3
      And each comment receives one evidence-backed disposition
      And comment C3 is repaired, validated, committed, pushed, and answered
      And descendant branches are synchronized and validated in stack order
      And already processed comments do not spawn another agent

  Rule: Finish babysitting only when the stack is settled

    Scenario: Wait for review completion
      Given every stack pull request has been published
      When required checks pass
      And every observed comment has been processed
      And every review thread is resolved
      And every pull request has the required approval
      And the configured quiet window elapses without new feedback
      Then the Workflow Run enters AwaitingIntegration
      But the Workflow does not merge any pull request
