import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describeFeature, loadFeatureFromText } from "@amiceli/vitest-cucumber";
import { expect } from "vitest";
import {
	WorkflowExecutor,
	type WorkflowDefinition,
} from "../../../src/workflow";

const feature = loadFeatureFromText(`Feature: Resume a workflow session
  As a WorkflowOperator,
  I want to resume a workflow session by its run identifier,
  So that a correction or later workflow can use the existing context instead of starting cold

  Rule: Resume the active workflow context

    Scenario: Continue a workflow with its existing agent context
      Given WorkflowRun{runIdentifier: "run-001", status: Failed}
      And WorkflowSession{runIdentifier: "run-001", agentContext: Present, artifacts: Present}
      When I resumeWorkflow(runIdentifier: "run-001", correction: "Fix the validation failure")
      Then I view WorkflowRun{runIdentifier: "run-001", status: Running} in Workflow Execution: The existing workflow session continues
      And I view WorkflowSession{runIdentifier: "run-001", sameAgentContext: true} in Workflow Execution: Agent context is preserved
      And I view Artifact{producerInvocationId: Present, consumerInvocationId: Present} in Workflow Execution: Existing artifacts remain available

  Rule: Keep the session record across chained workflows

    Scenario: Start the next workflow in an existing session
      Given WorkflowRun{runIdentifier: "run-002", status: AwaitingReview}
      And WorkflowSession{runIdentifier: "run-002", agentContext: Present}
      When I executeWorkflow(workflowId: "document", runIdentifier: "run-002")
      Then I view WorkflowRun{runIdentifier: "run-002", status: Running} in Workflow Execution: The chained workflow uses the existing run
      And I view WorkflowSession{runIdentifier: "run-002", sameAgentContext: true} in Workflow Execution: The agent session is resumed
`);

const runStep = "WorkflowRun{runIdentifier: {string}, status: {word}}";
const sessionWithArtifactsStep = "WorkflowSession{any}";
const sessionStep = "WorkflowSession{any}";

type TestSetup = {
	executor: WorkflowExecutor;
	run: Awaited<ReturnType<WorkflowExecutor["executeWorkflow"]>>;
};

function createSessionWorkflows(): readonly WorkflowDefinition[] {
	return [
		{
			id: "correctable",
			name: "Correctable workflow",
			controller: async ({ ai, harness }) => {
				await ai("planner", "Create plan", "plan", { outputArtifact: "plan" });
				await harness(
					"builder",
					"Build request",
					"build",
					{ inputArtifact: "plan", outputArtifact: "build" },
				);
			},
		},
		{
			id: "document",
			name: "Document",
			controller: async ({ harness }) => {
				await harness("documenter", "Document change", "document");
			},
		},
	];
}

describeFeature(feature, ({ Rule }) => {
	Rule("Resume the active workflow context", ({ RuleScenario }) => {
		RuleScenario("Continue a workflow with its existing agent context", ({ Given, When, Then, And }) => {
			let setup: TestSetup;
			let sessionStorePath: string;
			let firstAttempt = true;

			Given(runStep, (_ctx: unknown, runIdentifier: string, status: string) => {
				expect(runIdentifier).toBe("run-001");
				expect(status).toBe("Failed");
				sessionStorePath = mkdtempSync(join(tmpdir(), "workflow-sessions-"));
				setup = {
					executor: new WorkflowExecutor(createSessionWorkflows(), {
						ai: () => ({ value: { plan: "prepared" } }),
						harness: ({ inputArtifact }) => {
							if (firstAttempt) {
								firstAttempt = false;
								throw new Error("validation failure");
							}
							return { value: inputArtifact?.value };
						},
					}, { sessionStorePath }),
					run: undefined as never,
				};
			});
			And(sessionWithArtifactsStep, (_ctx: unknown, details: string) => {
				expect(details).toContain('runIdentifier: "run-001"');
				expect(details).toContain("Present");
			});
			When(
				'I resumeWorkflow(runIdentifier: "run-001", correction: "Fix the validation failure")',
				async () => {
					const failed = await setup.executor.executeWorkflow("correctable", {
						runIdentifier: "run-001",
					});
				expect(failed.status).toBe("Failed");
					setup.run = await setup.executor.resumeWorkflow(
						"run-001",
						"Fix the validation failure",
					);
				},
			);
			Then(
				"I view WorkflowRun{runIdentifier: {string}, status: {word}} in Workflow Execution: The existing workflow session continues",
				(_ctx: unknown, runIdentifier: string, status: string) =>
					expect(setup.run).toMatchObject({ runIdentifier, status }),
			);
			And(
				"I view WorkflowSession{runIdentifier: {string}, sameAgentContext: {word}} in Workflow Execution: Agent context is preserved",
				(_ctx: unknown, runIdentifier: string, sameAgentContext: string) =>
					expect(setup.run.session).toMatchObject({ runIdentifier, sameAgentContext: sameAgentContext === "true" }),
			);
			And(
				"I view Artifact{producerInvocationId: Present, consumerInvocationId: Present} in Workflow Execution: Existing artifacts remain available",
				() => expect([...setup.run.context.artifacts.values()]).toEqual(expect.arrayContaining([
					expect.objectContaining({ producerInvocationId: "planner", consumerInvocationId: "builder" }),
				])),
			);
		});
	});

	Rule("Keep the session record across chained workflows", ({ RuleScenario }) => {
		RuleScenario("Start the next workflow in an existing session", ({ Given, When, Then, And }) => {
			let executor: WorkflowExecutor;
			let run: Awaited<ReturnType<WorkflowExecutor["executeWorkflow"]>>;
			let sessionStorePath: string;

			Given(runStep, (_ctx: unknown, runIdentifier: string, status: string) => {
				expect(runIdentifier).toBe("run-002");
				expect(status).toBe("AwaitingReview");
				sessionStorePath = mkdtempSync(join(tmpdir(), "workflow-sessions-"));
				executor = new WorkflowExecutor(createSessionWorkflows(), {}, { sessionStorePath });
			});
			And(sessionStep, (_ctx: unknown, details: string) => {
				expect(details).toContain('runIdentifier: "run-002"');
				expect(details).toContain("Present");
			});
			When(
				'I executeWorkflow(workflowId: "document", runIdentifier: "run-002")',
				async () => {
					await executor.executeWorkflow("correctable", { runIdentifier: "run-002" });
					run = await executor.executeWorkflow("document", { runIdentifier: "run-002" });
				},
			);
			Then(
				"I view WorkflowRun{runIdentifier: {string}, status: {word}} in Workflow Execution: The chained workflow uses the existing run",
				(_ctx: unknown, runIdentifier: string, status: string) =>
					expect(run).toMatchObject({ runIdentifier, status }),
			);
			And(
				"I view WorkflowSession{runIdentifier: {string}, sameAgentContext: {word}} in Workflow Execution: The agent session is resumed",
				(_ctx: unknown, runIdentifier: string, sameAgentContext: string) =>
					expect(run.session).toMatchObject({ runIdentifier, sameAgentContext: sameAgentContext === "true" }),
			);
		});
	});
});
