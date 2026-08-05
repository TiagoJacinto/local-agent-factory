import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describeFeature, loadFeatureFromText } from "@amiceli/vitest-cucumber";
import { expect } from "vitest";
import { createStarterWorkflowDefinitions } from "../../../src/workflow-package";
import { WorkflowExecutor } from "../../../src/workflow";

const feature = loadFeatureFromText(`Feature: Execute a configured agent workflow
  As a WorkflowOperator,
  I want to execute a configured agent workflow against a safe source revision,
  So that I receive validated work and retain control of integration

  Rule: Run known validation as code and return inspectable evidence

    Scenario: Stop before review when validation fails
      Given WorkflowRegistry{registeredWorkflows: ["build-test-review"]}
      And SourceRepository{path: "/work/project", sourceRevision: "abc123", workingTree: Clean}
      When I executeWorkflow(workflowId: "build-test-review", sourceRepository: "/work/project", expectedSourceRevision: "abc123")
      Then I view WorkflowRun{status: Failed, failure: ValidationFailed} in Workflow Execution: Validation failure stops the workflow
      And I view ValidationResult{status: Failed, evidence: Present} in Workflow Execution: Validation evidence is inspectable
      And I !view InvocationResult{name: "Review change"} in Workflow Run: Review does not run on failed validation

  Rule: Correct a workflow without losing the active agent session

    Scenario: Send a review finding back to the builder
      Given WorkflowRegistry{registeredWorkflows: ["build-review"]}
      And SourceRepository{path: "/work/project", sourceRevision: "abc123", workingTree: Clean}
      When I executeWorkflow(workflowId: "build-review", sourceRepository: "/work/project", expectedSourceRevision: "abc123")
      Then I view WorkflowRun{status: AwaitingReview} in Workflow Execution: Corrected work reaches human review
        | invocationOrder | name                 | primitiveType | status    |
        | 1               | Build request        | Harness       | Succeeded |
        | 2               | Review change        | AI            | Succeeded |
        | 3               | Correct build        | Harness       | Succeeded |
        | 4               | Review corrected work | AI            | Succeeded |
        | 5               | Await human review   | Gate          | Succeeded |
      And I view WorkflowSession{sameAgentContext: true} in Workflow Execution: Correction keeps the active agent context

  Rule: Carry typed workflow envelopes and artifacts between roles

    Scenario: Pass a plan envelope to the builder
      Given WorkflowRegistry{registeredWorkflows: ["plan-build"]}
      And SourceRepository{path: "/work/project", sourceRevision: "abc123", workingTree: Clean}
      When I executeWorkflow(workflowId: "plan-build", sourceRepository: "/work/project", expectedSourceRevision: "abc123")
      Then I view WorkflowEnvelope{producer: "planner", consumer: "builder", status: Success, fields: [objective, risks, expectedFiles, acceptanceCriteria, validationCommands]} in Workflow Execution: Planner output is handed to the builder
      And I view Artifact{id: "plan", producerInvocationId: "planner", consumerInvocationId: "builder"} in Run Context: Plan artifact is consumed by the builder
`);
const workflowStep = "WorkflowRegistry{registeredWorkflows: {any}}";
const sourceStep =
	"SourceRepository{path: {string}, sourceRevision: {string}, workingTree: {word}}";

function createRepository(): { path: string; revision: string } {
	const path = mkdtempSync(join(tmpdir(), "envelope-source-"));
	execFileSync("git", ["init", "--quiet", path]);
	execFileSync("git", ["-C", path, "config", "user.email", "test@example.com"]);
	execFileSync("git", ["-C", path, "config", "user.name", "Test"]);
	writeFileSync(join(path, "README.md"), "before\n");
	execFileSync("git", ["-C", path, "add", "README.md"]);
	execFileSync("git", ["-C", path, "commit", "--quiet", "-m", "initial"]);
	return {
		path,
		revision: execFileSync("git", ["-C", path, "rev-parse", "HEAD"], {
			encoding: "utf8",
		}).trim(),
	};
}

type Row = Record<string, string>;

function expectInvocations(
	run: Awaited<ReturnType<WorkflowExecutor["executeWorkflow"]>>,
	rows: Row[],
): void {
	expect(run.invocations.map(({ order, name, primitiveType, status }) => ({
		invocationOrder: String(order),
		name,
		primitiveType,
		status,
	}))).toEqual(rows.map(({ invocationOrder, name, primitiveType, status }) => ({
		invocationOrder,
		name,
		primitiveType,
		status,
	})));
}

describeFeature(feature, ({ Rule }) => {
	Rule("Run known validation as code and return inspectable evidence", ({ RuleScenario }) => {
		RuleScenario("Stop before review when validation fails", ({ Given, When, Then, And }) => {
			let executor: WorkflowExecutor;
			let source: { path: string; revision: string };
			let run: Awaited<ReturnType<WorkflowExecutor["executeWorkflow"]>>;

			Given(workflowStep, (_ctx: unknown, workflowList: string) => {
				expect(workflowList).toContain("build-test-review");
				source = createRepository();
				executor = new WorkflowExecutor(createStarterWorkflowDefinitions(), {
				harness: () => undefined,
				ai: () => ({ value: "review output" }),
			});
			});
			And(sourceStep, (_ctx: unknown, path: string, revision: string, state: string) => {
				expect(path).toBe("/work/project");
				expect(revision).toBe("abc123");
				expect(state).toBe("Clean");
			});
			When(
				'I executeWorkflow(workflowId: "build-test-review", sourceRepository: "/work/project", expectedSourceRevision: "abc123")',
				async () => {
					run = await executor.executeWorkflow("build-test-review", {
						sourceRepository: source.path,
						expectedSourceRevision: source.revision,
					});
				},
			);
			Then(
				"I view WorkflowRun{status: {word}, failure: {word}} in Workflow Execution: Validation failure stops the workflow",
				(_ctx: unknown, status: string, failure: string) => expect(run).toMatchObject({ status, failure }),
			);
			And(
				"I view ValidationResult{status: {word}, evidence: Present} in Workflow Execution: Validation evidence is inspectable",
				(_ctx: unknown, status: string) => expect(run.validationResults[0]).toMatchObject({ status }),
			);
			And(
				"I !view InvocationResult{name: {string}} in Workflow Run: Review does not run on failed validation",
				(_ctx: unknown, name: string) => expect(run.invocations.some((invocation) => invocation.name === name)).toBe(false),
			);
		});
	});

	Rule("Correct a workflow without losing the active agent session", ({ RuleScenario }) => {
		RuleScenario("Send a review finding back to the builder", ({ Given, When, Then, And }) => {
			let executor: WorkflowExecutor;
			let source: { path: string; revision: string };
			let run: Awaited<ReturnType<WorkflowExecutor["executeWorkflow"]>>;
			Given(workflowStep, (_ctx: unknown, workflowList: string) => {
				expect(workflowList).toContain("build-review");
				source = createRepository();
				let firstReview = true;
				executor = new WorkflowExecutor(createStarterWorkflowDefinitions(), {
					harness: () => undefined,
					ai: ({ name }) => ({
						value: name === "Review change" && firstReview
							? (firstReview = false, { findings: ["Fix the issue"] })
							: { findings: [] },
					}),
				});
			});
			And(sourceStep, (_ctx: unknown, path: string, revision: string, state: string) => {
				expect(path).toBe("/work/project");
				expect(revision).toBe("abc123");
				expect(state).toBe("Clean");
			});
			When(
				'I executeWorkflow(workflowId: "build-review", sourceRepository: "/work/project", expectedSourceRevision: "abc123")',
				async () => {
					run = await executor.executeWorkflow("build-review", {
						sourceRepository: source.path,
						expectedSourceRevision: source.revision,
					});
				},
			);
			Then(
				"I view WorkflowRun{status: {word}} in Workflow Execution: Corrected work reaches human review",
				(_ctx: unknown, status: string, rows: Row[]) => {
					expect(run.status).toBe(status);
					expectInvocations(run, rows);
				},
			);
			And(
				"I view WorkflowSession{sameAgentContext: {word}} in Workflow Execution: Correction keeps the active agent context",
				(_ctx: unknown, sameAgentContext: string) => expect(run.session.sameAgentContext).toBe(sameAgentContext === "true"),
			);
		});
	});

	Rule("Carry typed workflow envelopes and artifacts between roles", ({ RuleScenario }) => {
		RuleScenario("Pass a plan envelope to the builder", ({ Given, When, Then, And }) => {
			let executor: WorkflowExecutor;
			let source: { path: string; revision: string };
			let run: Awaited<ReturnType<WorkflowExecutor["executeWorkflow"]>>;

			Given(workflowStep, (_ctx: unknown, workflowList: string) => {
				expect(workflowList).toContain("plan-build");
				source = createRepository();
				executor = new WorkflowExecutor(createStarterWorkflowDefinitions(), {
					ai: ({ name, input }) => ({
						value:
							name === "Plan request"
								? {
										producer: "planner",
										consumer: "builder",
										status: "Success",
										objective: input,
										risks: ["No known risks"],
										expectedFiles: ["README.md"],
										acceptanceCriteria: ["The requested change is implemented"],
										validationCommands: ["bun test"],
									}
								: "review output",
					}),
					harness: ({ inputArtifact }) => ({ value: inputArtifact?.value }),
				});
			});
			And(sourceStep, (_ctx: unknown, path: string, revision: string, state: string) => {
				expect(path).toBe("/work/project");
				expect(revision).toBe("abc123");
				expect(state).toBe("Clean");
			});
			When(
				'I executeWorkflow(workflowId: "plan-build", sourceRepository: "/work/project", expectedSourceRevision: "abc123")',
				async () => {
					run = await executor.executeWorkflow("plan-build", {
						sourceRepository: source.path,
						expectedSourceRevision: source.revision,
					});
				},
			);
			Then(
				"I view WorkflowEnvelope{producer: {string}, consumer: {string}, status: {word}, fields: {any}} in Workflow Execution: Planner output is handed to the builder",
				(_ctx: unknown, producer: string, consumer: string, status: string, fieldText: string) => {
					const envelope = run.context.envelopes.get("plan");
					const fields = fieldText.replace(/^\[/, "").replace(/\]$/, "").split(", ");
					expect(envelope).toMatchObject({ producer, consumer, status });
					expect(Object.keys(envelope ?? {})).toEqual(expect.arrayContaining(fields));
				},
			);
			And(
				"I view Artifact{id: {string}, producerInvocationId: {string}, consumerInvocationId: {string}} in Run Context: Plan artifact is consumed by the builder",
				(_ctx: unknown, id: string, producer: string, consumer: string) => {
					expect(run.context.artifacts.get(id)).toMatchObject({
						id,
						producerInvocationId: producer,
						consumerInvocationId: consumer,
					});
				},
			);
		});
	});
});
