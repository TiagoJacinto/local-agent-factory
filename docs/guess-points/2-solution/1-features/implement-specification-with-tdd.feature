Feature: Implement a specification through TDD and deliver a reviewed pull request
  A Workflow Operator can provide a specification and receive an isolated, tested, reviewed pull request while deterministic workflow control preserves TDD ordering and integration safety.

  Rule: Isolate all implementation work from the source checkout

    Scenario: Create the implementation worktree before agent activity
      Given a clean Source Repository at its expected Source Revision
      And a specification path in that Source Repository
      When I execute the implement Workflow for that specification
      Then one worktree and feature branch are created from the expected Source Revision
      And the starting commit is recorded as the code-review fixed point
      And every agent, command, test, commit, and GitHub operation executes from the worktree
      And the original checkout remains unchanged

  Rule: Confirm behavioral seams before writing tests

    Scenario: Wait for approval of the proposed test seams
      Given the implementation worktree has been created
      When the implementation agent identifies the modules and behavior affected by the specification
      Then the Workflow proposes the public interfaces and seams through which behavior will be tested
      And the proposal identifies existing focused test suites and mockable external adapters
      And no test or production code is changed before the Workflow Operator approves those seams

  Rule: Implement each required behavior through vertical red-green cycles

    Scenario: Complete the specification through ordinary TDD
      Given the Workflow Operator has approved the test seams
      And the existing focused tests at those seams are green
      When the Workflow implements the specification
      Then each cycle selects one next-smallest uncovered behavior
      And one behavioral test is written through an approved public interface
      And Run Evidence shows that the test fails for the expected behavioral reason before production code changes
      And only enough production code is added to make that test pass
      And the active approved-seam test suite remains green
      And no refactoring occurs during the red-green cycles
      And the cycles continue until every specification requirement is covered by a passing test

    Scenario: Record an additional seam without interrupting implementation
      Given a driving test remains red
      And making it green requires behavior from another independently meaningful public interface
      When the Factory starts a supporting red-green cycle at that seam
      Then the Factory records the module, interface, test paths, and rationale
      And the supporting cycle completes before the driving test is rerun
      But imports or internal module edits alone do not create another test seam

  Rule: Review the completed behavior before publication

    Scenario: Repair findings from independent Standards and Spec reviews
      Given every required behavior is covered by passing tests
      When the Workflow creates a review checkpoint
      Then Standards and Spec reviews inspect the diff from the recorded fixed point in parallel
      And a missing or incorrect behavior returns to a red-green cycle
      And a concrete Standards finding is corrected while approved-seam tests remain green
      And both review axes run again after corrections
      And publication remains blocked until neither review reports a blocker

  Rule: Validate according to the affected behavior

    Scenario: Pass the tiered validation gate
      Given the implementation has passed Standards and Spec review
      When deterministic validation runs
      Then all fast tests run
      And integration tests for affected seams run
      And lint, typecheck, and build checks run
      And affected end-to-end tests run when the changed behavior crosses an end-to-end seam
      And every relevant validation result is preserved as Run Evidence
      And publication remains blocked while a relevant validation failure is unresolved

  Rule: Publish and babysit the pull request without merging it

    Scenario: Create a ready-for-review pull request
      Given code review and tiered validation have passed
      When the Workflow publishes the implementation
      Then the worktree is clean
      And the feature branch is pushed
      And one ready-for-review pull request is created
      And its description records the specification, approved seams, tests, validation, review results, and residual risks
      And its description contains an "Additional test seams" section
      And that section lists each seam introduced after initial approval with its interface, tests, and rationale
      And the section explicitly states when no additional seams were introduced
      And the pull request URL and head commit are preserved as Run Evidence

    Scenario: Repair pull request feedback and change-caused GitHub Actions failures
      Given the implementation pull request has been created
      And GitHub reports an unseen review comment or a failed required check caused by the change
      When the Workflow follows up on the pull request
      Then one fresh agent classifies the feedback or failure
      And a behavioral correction returns to a red-green cycle
      And every correction is validated and reviewed
      And the correction is committed and pushed from the worktree
      And evidence of the correction is posted to the pull request
      And each comment and check result is processed exactly once
      And required GitHub Actions are watched again for the new head commit

    Scenario: Retry GitHub Actions infrastructure failures without changing code
      Given a required GitHub Actions check fails because of infrastructure
      When the Workflow classifies the failed check
      Then the failed check is retried without changing implementation code
      And the retry result is preserved as Run Evidence

    Scenario: Finish only after the pull request is settled
      Given the implementation pull request has been published
      When every required GitHub Actions check passes
      And every observed comment has been processed
      And every review thread is resolved
      And the required approvals exist
      And the configured quiet window elapses without new feedback
      Then the Workflow Run enters AwaitingIntegration
      But the Workflow does not merge the pull request
