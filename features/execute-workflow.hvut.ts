import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describeFeature, loadFeature } from "@amiceli/vitest-cucumber";
import { expect } from "vitest";
import { WorkflowExecutor, type WorkflowDefinition } from "../src/workflow";

const feature = await loadFeature("features/execute-workflow.feature");
type Row = Record<string, string>;
const workflowStep = "Workflow{id: {string}, name: {string}}";
const executeStep = "I executeWorkflow\\(workflowId: {string}\\)";

function invocationSummary(run: Awaited<ReturnType<WorkflowExecutor["executeWorkflow"]>>) {
	return run.invocations.map(({ input: _input, ...invocation }) => invocation);
}

function expectRun(run: Awaited<ReturnType<WorkflowExecutor["executeWorkflow"]>>, id: string, status: string, rows: Row[]) {
	expect(run).toMatchObject({ workflowId: id, status });
	const expected = rows.map((row) => ({
		order: Number(row.invocationOrder),
		invocationId: row.invocationId,
		...(row.name ? { name: row.name } : {}),
		primitiveType: row.primitiveType,
		resultType: row.resultType,
		...(row.status ? { status: row.status } : {}),
		...(row.consumedArtifact && row.consumedArtifact !== "none" ? { consumedArtifact: row.consumedArtifact } : {}),
		...(row.producedArtifact && row.producedArtifact !== "none" ? { producedArtifact: row.producedArtifact } : {}),
	}));
	expect(invocationSummary(run).map((invocation, index) => Object.fromEntries(Object.keys(expected[index]).map((key) => [key, invocation[key as keyof typeof invocation]])))).toEqual(expected);
}

describeFeature(feature, ({ Rule }) => {
	Rule("Record primitive invocations in controller order", ({ RuleScenario }) => {
		RuleScenario("Execute AI, Harness, and Gate primitives", ({ Given, When, Then }) => {
			let executor: WorkflowExecutor;
			let workflowRun: Awaited<ReturnType<WorkflowExecutor["executeWorkflow"]>>;
			Given(workflowStep, (_ctx: unknown, id: string, name: string, rows: Row[]) => {
				const repo = mkdtempSync(join(tmpdir(), "workflow-executor-"));
				execFileSync("git", ["init", "--quiet", repo]);
				const workflow: WorkflowDefinition = {
					id,
					name,
					controller: async ({ ai, harness, gate }) => {
						for (const row of rows) {
							const primitive = { AI: ai, Harness: harness, Gate: gate }[row.function as "AI" | "Harness" | "Gate"];
							await primitive(row.invocationId, row.name, row.input);
						}
					},
				};
				executor = new WorkflowExecutor([workflow], {
					harness: ({ input }) => {
						writeFileSync(`${repo}/README.md`, `${input}\n`);
						return Promise.resolve(undefined);
					},
				});
			});
			When(executeStep, async (_ctx: unknown, id: string) => { workflowRun = await executor.executeWorkflow(id); });
			Then(
				"I view WorkflowRun{workflowId: {string}, status: {word}} in Workflow Execution: Primitive invocations follow controller order",
				(_ctx: unknown, id: string, status: string, rows: Row[]) => expectRun(workflowRun, id, status, rows),
			);
		});
	});

	Rule("Carry artifacts between primitive invocations", ({ RuleScenario }) => {
		RuleScenario("Harness receives an artifact produced by AI", ({ Given, When, Then, And }) => {
			let executor: WorkflowExecutor;
			let run: Awaited<ReturnType<WorkflowExecutor["executeWorkflow"]>>;
			let consumedArtifactValue: unknown;
			let expectedArtifactValue: string;
			Given(workflowStep, (_ctx: unknown, id: string, name: string, rows: Row[]) => {
				expectedArtifactValue = rows[0].input;
				const workflow: WorkflowDefinition = {
					id, name,
					controller: async ({ ai, harness }) => {
						for (const row of rows) {
							const primitive = row.function === "AI" ? ai : harness;
							await primitive(row.invocationId, row.name, row.input, {
								inputArtifact: row.inputArtifact === "none" ? undefined : row.inputArtifact,
								outputArtifact: row.outputArtifact === "none" ? undefined : row.outputArtifact,
							});
						}
					},
				};
				executor = new WorkflowExecutor([workflow], {
					ai: ({ input }) => ({ value: input }),
					harness: ({ inputArtifact }) => {
						consumedArtifactValue = inputArtifact?.value;
						return { value: "repository change" };
					},
				});
			});
			When(executeStep, async (_ctx: unknown, id: string) => { run = await executor.executeWorkflow(id); });
			Then(
				"I view WorkflowRun{workflowId: {string}, status: {word}} in Workflow Execution: Artifact workflow succeeds",
				(_ctx: unknown, id: string, status: string, rows: Row[]) => expectRun(run, id, status, rows),
			);
			And(
				"I view Artifact{id: {string}, producerInvocationId: {string}, consumerInvocationId: {string}} in Run Context: AI artifact is available to Harness",
				(_ctx: unknown, id: string, producer: string, consumer: string) => {
					expect(run.context.artifacts.get(id)).toMatchObject({ id, producerInvocationId: producer, consumerInvocationId: consumer });
					expect(consumedArtifactValue).toBe(expectedArtifactValue);
				},
			);
		});
	});

	Rule("Compose ordinary code with workflow primitives", ({ RuleScenario }) => {
		RuleScenario("Pure computation supplies input without creating an invocation", ({ Given, When, Then, And, But }) => {
			let executor: WorkflowExecutor;
			let run: Awaited<ReturnType<WorkflowExecutor["executeWorkflow"]>>;
			Given(workflowStep, (_ctx: unknown, id: string, name: string, rows: Row[]) => {
				const pure = rows[0];
				const primitive = rows[1];
				const workflow: WorkflowDefinition = { id, name, controller: async ({ ai }) => {
					const prompt = `Draft an update to ${pure.input}`;
					await ai(primitive.invocationId, primitive.name, prompt, { outputArtifact: primitive.output });
				} };
				executor = new WorkflowExecutor([workflow]);
			});
			When(executeStep, async (_ctx: unknown, id: string) => { run = await executor.executeWorkflow(id); });
			Then("I view WorkflowRun{workflowId: {string}, status: {word}} in Workflow Execution: Only the primitive call creates an invocation result", (_ctx: unknown, id: string, status: string, rows: Row[]) => expectRun(run, id, status, rows));
			And("I view AIInvocationResult{invocationId: {string}, prompt: {string}} in Workflow Execution: Pure computation output reaches AI", (_ctx: unknown, id: string, prompt: string) => expect(run.invocations[0]).toMatchObject({ invocationId: id, input: prompt }));
			But("I view InvocationResult{function: {string}} not in Workflow Run: Pure computation is not recorded as a primitive invocation", (_ctx: unknown, functionName: string) => expect(run.invocations.some((invocation) => invocation.name === functionName)).toBe(false));
		});

		RuleScenario("A composite function calls a primitive without becoming an invocation", ({ Given, When, Then, And, But }) => {
			let executor: WorkflowExecutor;
			let run: Awaited<ReturnType<WorkflowExecutor["executeWorkflow"]>>;
			Given(workflowStep, (_ctx: unknown, id: string, name: string, rows: Row[]) => {
				const row = rows[0];
				const verifyThatREADMEFollowsRepoRules = async (invoke: (id: string, name: string, input: string) => Promise<unknown>) => invoke(row.invocationId, row.invocationName, "Verify repository rules");
				const workflow: WorkflowDefinition = { id, name, controller: async ({ harness }) => { await verifyThatREADMEFollowsRepoRules(harness); } };
				executor = new WorkflowExecutor([workflow]);
			});
			When(executeStep, async (_ctx: unknown, id: string) => { run = await executor.executeWorkflow(id); });
			Then("I view WorkflowRun{workflowId: {string}, status: {word}} in Workflow Execution: Called primitive creates the invocation result", (_ctx: unknown, id: string, status: string, rows: Row[]) => expectRun(run, id, status, rows));
			And("I view HarnessInvocationResult{invocationId: {string}, status: {word}} in Workflow Execution: Composite function delegates to Harness", (_ctx: unknown, id: string, status: string) => expect(run.invocations[0]).toMatchObject({ invocationId: id, status }));
			But("I view InvocationResult{function: {string}} not in Workflow Run: Composite function itself is not recorded", (_ctx: unknown, functionName: string) => expect(run.invocations.some((invocation) => invocation.name === functionName)).toBe(false));
		});
	});
});
