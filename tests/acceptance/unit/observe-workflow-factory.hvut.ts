import { describeFeature, loadFeatureFromText } from "@amiceli/vitest-cucumber";
import { expect } from "vitest";
import {
	InMemoryWorkflowTraceStore,
	WorkflowTraceViewer,
} from "../../../src/workflow-trace";

const feature = loadFeatureFromText(`Feature: Observe a workflow factory run
  As a Workflow Observer,
  I want to inspect a live or completed workflow trace,
  So that I can understand progress, activity, and failure evidence

  Rule: Observe active runs
    Scenario: View available workflow runs
      Given WorkflowRun{runIdentifiers: ["run-123", "run-456"]}
      When I listWorkflowRuns()
      Then I view WorkflowRun{runIdentifiers: ["run-123", "run-456"]} in Workflow Trace: Available runs are visible
`);

describeFeature(feature, ({ Rule }) => {
	Rule("Observe active runs", ({ RuleScenario }) => {
		RuleScenario("View available workflow runs", ({ Given, When, Then }) => {
			let viewer: WorkflowTraceViewer;
			let runIdentifiers: readonly string[] = [];

			Given("WorkflowRun{runIdentifiers: {any}}", (_ctx: unknown, details: string) => {
				expect(details).toBe('["run-123", "run-456"]');
				const store = new InMemoryWorkflowTraceStore();
				for (const [runIdentifier, status] of [
					["run-123", "Running"],
					["run-456", "AwaitingReview"],
				] as const) {
					store.start({
						runIdentifier,
						workflowId: "workflow",
						status,
						events: [],
						validationResults: [],
						envelopes: [],
						artifacts: [],
					});
				}
				viewer = new WorkflowTraceViewer(store);
			});
			When("I listWorkflowRuns()", async () => {
				runIdentifiers = (await viewer.listWorkflowRuns()).map(
					(run) => run.runIdentifier,
				);
			});
			Then(
				"I view WorkflowRun{runIdentifiers: {any}} in Workflow Trace: Available runs are visible",
				(_ctx: unknown, details: string) => {
					expect(details).toBe('["run-123", "run-456"]');
					expect(runIdentifiers).toEqual(["run-123", "run-456"]);
				},
			);
		});
	});
});
