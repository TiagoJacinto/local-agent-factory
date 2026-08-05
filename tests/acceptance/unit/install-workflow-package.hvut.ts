import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describeFeature, loadFeature } from "@amiceli/vitest-cucumber";
import { expect } from "vitest";
import {
	WorkflowPackageInstaller,
	type FactorySetup,
} from "../../../src/workflow-package.ts";

const feature = await loadFeature(
	"docs/guess-points/2-solution/1-features/install-workflow-package.feature",
);
const repositoryStep = "TargetRepository\\{path: {string}\\}";
const installStep = "I installWorkflowPackage\\(repository: {string}\\)";

describeFeature(feature, ({ Rule }) => {
	Rule("Install the factory package and starter registry", ({ RuleScenario }) => {
		RuleScenario(
			"Install a reusable workflow package",
			({ Given, When, Then, And }) => {
				let repository: string;
				let setup: FactorySetup;
				Given(repositoryStep, (_ctx: unknown, _path: string) => {
					repository = mkdtempSync(join(tmpdir(), "workflow-package-"));
				});
				When(installStep, async (_ctx: unknown, _path: string) => {
					setup = await new WorkflowPackageInstaller().installWorkflowPackage(
						repository,
					);
				});
				Then(
					"I view WorkflowPackage{installed: true, repository: {string}} in Factory Setup: The factory package is installed",
					() =>
						expect(setup.workflowPackage).toEqual({
							installed: true,
							repository,
						}),
				);
				And(
					"I view WorkflowRegistry{registeredWorkflows: 12} in Factory Setup: Starter workflows are available",
					() => expect(setup.workflowRegistry.registeredWorkflows).toHaveLength(12),
				);
				And(
					"I view AgentRole{configuredRoles: [\"planner\", \"builder\", \"scout\", \"reviewer\", \"documenter\"]} in Factory Setup: Starter roles are available",
					() =>
						expect(setup.agentRoles.map((role: FactorySetup["agentRoles"][number]) => role.name)).toEqual([
							"planner",
							"builder",
							"scout",
							"reviewer",
							"documenter",
						]),
				);
			},
		);
	});

	Rule("Configure the installed roles and workflows", ({ RuleScenario }) => {
		RuleScenario(
			"Set role capabilities and workflow configuration",
			({ Given, When, Then, And }) => {
				let repository: string;
				let setup: FactorySetup;
				Given(
					"WorkflowPackage{installed: true, repository: {string}}",
					(_ctx: unknown, _path: string) => {
						repository = mkdtempSync(join(tmpdir(), "workflow-package-"));
						new WorkflowPackageInstaller().installWorkflowPackage(repository);
					},
				);
				When(
					"I configureWorkflowPackage\\(repository: {string}\\)",
					async () => {
						setup = await new WorkflowPackageInstaller().configureWorkflowPackage(
							repository,
						);
					},
				);
				Then(
					"I view AgentRole{model: Present, instructions: Present, tools: Present, allowedWrites: Present} in Factory Setup: Role configuration is explicit",
					() => {
						expect(setup.agentRoles).toHaveLength(5);
						for (const role of setup.agentRoles) {
							 expect(role.model).toBeTruthy();
							 expect(role.instructions).toBeTruthy();
							 expect(role.tools.length).toBeGreaterThan(0);
							 expect(Array.isArray(role.allowedWrites)).toBe(true);
						}
					},
				);
				And(
					"I view WorkflowRegistry{registeredWorkflows: Present} in Factory Setup: Workflow configuration is available",
					() => expect(setup.workflowRegistry.registeredWorkflows).toHaveLength(12),
				);
			},
		);
	});

	Rule("Make installation repeatable", ({ RuleScenario }) => {
		RuleScenario(
			"Reinstall without overwriting local configuration",
			({ Given, When, Then, And }) => {
				let repository: string;
				let setup: FactorySetup;
				Given(
					"WorkflowPackage{installed: true, repository: {string}, localConfiguration: Present}",
					(_ctx: unknown, _path: string) => {
						repository = mkdtempSync(join(tmpdir(), "workflow-package-"));
						const installer = new WorkflowPackageInstaller();
						installer.installWorkflowPackage(repository);
						const packagePath = join(
							repository,
							".local-agent-factory",
							"package.json",
						);
						const local = JSON.parse(readFileSync(packagePath, "utf8")) as {
							agentRoles: Array<Record<string, unknown>>;
						};
						local.agentRoles[0].model = "local-model";
						writeFileSync(packagePath, JSON.stringify(local));
					},
				);
				When(installStep, async () => {
					setup = await new WorkflowPackageInstaller().installWorkflowPackage(
						repository,
					);
				});
				Then(
					"I view WorkflowPackage{installed: true, localConfiguration: Preserved} in Factory Setup: Existing configuration is preserved",
					() => expect(setup.agentRoles[0].model).toBe("local-model"),
				);
				And(
					"I view WorkflowRegistry{registeredWorkflows: Present} in Factory Setup: The registry remains usable",
					() => expect(setup.workflowRegistry.registeredWorkflows).toHaveLength(12),
				);
			},
		);
	});
});
