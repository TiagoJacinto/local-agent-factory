import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { isAbsolute, join } from "node:path";
import {
	WorkflowExecutor,
	type AgentRoleConfiguration,
	type PrimitiveAdapters,
	type RunContext,
	type WorkflowDefinition,
} from "./workflow.js";
import { createPiAdapters } from "./pi-adapter.js";

const packageDirectory = ".local-agent-factory";
const packageFile = "package.json";
const starterWorkflowIds = [
	"prompt",
	"scout",
	"plan",
	"build",
	"quality",
	"plan-build",
	"build-test",
	"build-review",
	"plan-build-test",
	"plan-build-test-quality",
	"document",
	"simple-sdlc",
] as const;
const starterRoleNames = [
	"planner",
	"builder",
	"scout",
	"reviewer",
	"documenter",
] as const;

export interface WorkflowPackage {
	readonly installed: true;
	readonly repository: string;
}

export interface WorkflowPhase {
	readonly name: string;
	readonly role: string;
}

export interface WorkflowAcceptance {
	readonly criteria: readonly string[];
	readonly validationCommands?: readonly string[];
}

export interface WorkflowDefinitionRecord {
	readonly id: string;
	readonly name: string;
	readonly phases: readonly WorkflowPhase[];
	readonly acceptance: WorkflowAcceptance;
}

export interface WorkflowRegistry {
	readonly registeredWorkflows: readonly string[];
	readonly workflowDefinitions?: readonly WorkflowDefinitionRecord[];
}

export function createStarterWorkflowDefinitions(): readonly WorkflowDefinition[] {
	const workflows: WorkflowDefinition[] = [
		{
			id: "prompt",
			name: "Prompt",
			controller: async ({ ai, objective }) => {
				await ai(
					"planner",
					"Prompt request",
					objective ?? "Clarify the request",
				);
			},
		},
		{
			id: "scout",
			name: "Scout",
			controller: async ({ harness, objective }) => {
				await harness(
					"scout",
					"Scout request",
					objective ?? "Scout the repository",
				);
			},
		},
		{
			id: "plan",
			name: "Plan",
			controller: async ({ ai, objective }) => {
				await ai(
					"planner",
					"Plan request",
					objective ?? "Plan the requested change",
				);
			},
		},
		{
			id: "build",
			name: "Build",
			controller: async ({ harness, objective }) => {
				await harness(
					"builder",
					"Build request",
					objective ?? "Build the requested change",
				);
			},
		},
		{
			id: "quality",
			name: "Quality",
			controller: async ({ ai, objective }) => {
				await ai(
					"reviewer",
					"Quality review",
					objective ?? "Review the change",
				);
			},
		},
		{
			id: "document",
			name: "Document",
			controller: async ({ harness, objective }) => {
				await harness(
					"documenter",
					"Document change",
					objective ?? "Document the completed change",
				);
			},
		},
		{
			id: "simple-sdlc",
			name: "Simple software development lifecycle",
			completesWithReview: true,
			validationOperations: [{ name: "test", command: "true" }],
			controller: async ({ harness, ai, gate, validate, objective }) => {
				const build = await harness(
					"builder",
					"Build request",
					objective ?? "Build the requested change",
				);
				if (build.status === "Failed" || (await validate()).status === "Failed")
					return;
				await ai("reviewer", "Review change", "Review the completed change");
				await harness(
					"documenter",
					"Document change",
					"Document the completed change",
					{
						outputArtifact: "documentation",
					},
				);
				await gate(
					"review-gate",
					"Await human review",
					"Review the proposed change",
				);
			},
		},
		{
			id: "plan-build",
			name: "Plan and build",
			controller: async ({ ai, harness, objective }) => {
				const plan = await ai(
					"planner",
					"Plan request",
					objective ?? "Plan the requested change",
					{
						outputArtifact: "plan",
						outputEnvelope: { producer: "planner", consumer: "builder" },
					},
				);
				if (plan.status === "Failed") return;
				await harness(
					"builder",
					"Build request",
					objective ?? "Build the requested change",
					{
						inputArtifact: "plan",
					},
				);
			},
		},
		{
			id: "build-test",
			name: "Build, test, and review",
			completesWithReview: true,
			validationOperations: [
				{ name: "test", command: "test -f validation.pass" },
			],
			controller: async ({ harness, ai, gate, objective, validate }) => {
				const build = await harness(
					"builder",
					"Build request",
					objective ?? "Build the requested change",
				);
				if (build.status === "Failed") return;
				const validation = await validate();
				if (validation.status === "Failed") return;
				await ai("review", "Review change", "Review the validated change");
				await gate(
					"review-gate",
					"Await human review",
					"Review the proposed change",
				);
			},
		},
		{
			id: "plan-build-test",
			name: "Plan, build, and test",
			controller: async ({ ai, harness, objective }) => {
				const plan = await ai(
					"planner",
					"Plan request",
					objective ?? "Plan the requested change",
					{
						outputArtifact: "plan",
					},
				);
				if (plan.status === "Failed") return;
				await harness(
					"builder",
					"Build request",
					objective ?? "Build the requested change",
					{
						inputArtifact: "plan",
					},
				);
			},
		},
		{
			id: "build-review",
			name: "Build and review with correction",
			completesWithReview: true,
			validationOperations: [{ name: "test", command: "true" }],
			maxCorrectionAttempts: 1,
			controller: async ({
				harness,
				ai,
				gate,
				objective,
				validate,
				context,
				correctionBudget,
				fail,
			}) => {
				const build = await harness(
					"builder",
					"Build request",
					objective ?? "Build the requested change",
					{ outputArtifact: "build" },
				);
				if (build.status === "Failed") return;
				let review = await ai("review", "Review change", "Review the change", {
					outputArtifact: "review",
				});
				let findings =
					review.status === "Succeeded"
						? reviewFindings(context.artifacts.get("review")?.value)
						: [];
				let correctionAttempts = 0;
				recordReviewFindings(context, objective, findings);

				while (findings.length > 0) {
					if (correctionAttempts >= correctionBudget) {
						fail(
							"CorrectionBudgetExceeded",
							"Correction budget exhausted",
							findings,
						);
						return;
					}
					await harness("builder", "Correct build", findings.join("\\n"), {
						inputArtifact: "review",
					});
					correctionAttempts += 1;
					const validation = await validate();
					if (validation.status === "Failed") return;
					review = await ai(
						"review",
						"Review corrected work",
						"Review the corrected change",
						{ outputArtifact: "review" },
					);
					findings =
						review.status === "Succeeded"
							? reviewFindings(context.artifacts.get("review")?.value)
							: [];
					recordReviewFindings(context, objective, findings);
				}
				await gate(
					"review-gate",
					"Await human review",
					"Review the proposed change",
				);
			},
		},
		{
			id: "plan-build-test-quality",
			name: "Plan, build, test, and review",
			completesWithReview: true,
			controller: async ({ ai, harness, gate, objective }) => {
				const plan = await ai(
					"planner",
					"Plan request",
					objective ?? "Plan the requested change",
					{
						outputArtifact: "plan",
						outputEnvelope: { producer: "planner", consumer: "builder" },
					},
				);
				if (plan.status === "Failed") return;
				await harness(
					"builder",
					"Build request",
					objective ?? "Build the requested change",
					{
						inputArtifact: "plan",
					},
				);
				await ai(
					"review",
					"Review change",
					"Review the change against the plan",
				);
				await gate(
					"review-gate",
					"Await human review",
					"Review the proposed change",
				);
			},
		},
	];
	return workflows;
}

export interface AgentRole extends AgentRoleConfiguration {}

export type AgentRoleChanges = Partial<Omit<AgentRole, "name">>;

export interface FactorySetup {
	readonly workflowPackage: WorkflowPackage;
	readonly workflowRegistry: WorkflowRegistry;
	readonly agentRoles: readonly AgentRole[];
}

interface StoredSetup {
	workflowPackage: WorkflowPackage;
	workflowRegistry: {
		registeredWorkflows: string[];
		workflowDefinitions?: WorkflowDefinitionRecord[];
	};
	agentRoles: AgentRole[];
}

export interface FactorySetupFailure {
	readonly status: "Failed";
	readonly failure: "InvalidWorkflowConfiguration";
}

type WorkflowSetupResult = FactorySetup | FactorySetupFailure;

export class WorkflowPackageInstaller {
	installWorkflowPackage(repository: string): FactorySetup {
		const existing = this.readSetup(repository);
		const setup: StoredSetup = {
			workflowPackage: { installed: true, repository },
			workflowRegistry: {
				registeredWorkflows: existing?.workflowRegistry.registeredWorkflows
					.length
					? [...existing.workflowRegistry.registeredWorkflows]
					: [...starterWorkflowIds],
				workflowDefinitions: existing?.workflowRegistry.workflowDefinitions
					? [...existing.workflowRegistry.workflowDefinitions]
					: [],
			},
			agentRoles: starterRoleNames.map(
				(name) =>
					existing?.agentRoles.find((role) => role.name === name) ??
					starterRole(name),
			),
		};

		this.writeSetup(repository, setup);
		return this.validate(setup);
	}

	configureWorkflowPackage(repository: string): FactorySetup {
		const setup = this.readSetup(repository);
		if (!setup) {
			throw new Error(`Workflow package is not installed in ${repository}`);
		}
		return this.validate(setup);
	}

	configureAgentRole(
		role: string,
		repository: string,
		changes: AgentRoleChanges,
	): FactorySetup;
	configureAgentRole(
		repository: string,
		role: string,
		changes: AgentRoleChanges,
	): FactorySetup;
	configureAgentRole(
		first: string,
		second: string,
		changes: AgentRoleChanges,
	): FactorySetup {
		const repository = first.startsWith("/") ? first : second;
		const roleName = first.startsWith("/") ? second : first;
		const setup = this.readSetup(repository);
		if (!setup)
			throw new Error(`Workflow package is not installed in ${repository}`);
		const role = setup.agentRoles.find(
			(candidate) => candidate.name === roleName,
		);
		if (!role) throw new Error(`Unknown agent role: ${roleName}`);
		Object.assign(role, changes);
		this.writeSetup(repository, setup);
		return this.validate(setup);
	}

	selectWorkflow(workflowId: string, repository: string): WorkflowDefinition;
	selectWorkflow(repository: string, workflowId: string): WorkflowDefinition;
	selectWorkflow(first: string, second: string): WorkflowDefinition {
		const repository = first.startsWith("/") ? first : second;
		const workflowId = first.startsWith("/") ? second : first;
		const setup = this.configureWorkflowPackage(repository);
		if (!setup.workflowRegistry.registeredWorkflows.includes(workflowId)) {
			throw new Error(`Workflow not registered: ${workflowId}`);
		}
		const workflow =
			createStarterWorkflowDefinitions().find(({ id }) => id === workflowId) ??
			setup.workflowRegistry.workflowDefinitions
				?.map((definition) => this.toWorkflowDefinition(definition))
				.find(({ id }) => id === workflowId);
		if (!workflow) throw new Error(`Workflow not found: ${workflowId}`);
		return workflow;
	}

	/** Create an executor from the workflows registered in the installed package. */
	createExecutor(
		repository: string,
		adapters: PrimitiveAdapters = {},
	): WorkflowExecutor {
		const setup = this.configureWorkflowPackage(repository);
		const registered = new Set(setup.workflowRegistry.registeredWorkflows);
		const workflows = [
			...createStarterWorkflowDefinitions(),
			...(setup.workflowRegistry.workflowDefinitions ?? []).map((definition) =>
				this.toWorkflowDefinition(definition),
			),
		].filter((workflow) => registered.has(workflow.id));
		const piAdapters = createPiAdapters();
		return new WorkflowExecutor(workflows, {
			ai: adapters.ai ?? piAdapters.ai,
			harness: adapters.harness ?? piAdapters.harness,
			gate: adapters.gate ?? piAdapters.gate,
			traceStore: adapters.traceStore,
			roles: setup.agentRoles,
		});
	}

	createWorkflow(
		workflowId: string,
		repository: string,
		phases: readonly (string | WorkflowPhase)[],
		acceptance: WorkflowAcceptance,
	): FactorySetup;
	createWorkflow(
		repository: string,
		workflowId: string,
		phases: readonly (string | WorkflowPhase)[],
		acceptance: WorkflowAcceptance,
	): FactorySetup;
	createWorkflow(
		first: string,
		second: string,
		phases: readonly (string | WorkflowPhase)[],
		acceptance: WorkflowAcceptance,
	): FactorySetup {
		const [repository, workflowId] = this.resolveArguments(first, second);
		const setup = this.requireSetup(repository);
		const definition = this.buildDefinition(workflowId, phases, acceptance);
		const definitions = setup.workflowRegistry.workflowDefinitions ?? [];
		if (setup.workflowRegistry.registeredWorkflows.includes(workflowId)) {
			throw new Error(`Workflow already registered: ${workflowId}`);
		}
		setup.workflowRegistry.registeredWorkflows.push(workflowId);
		definitions.push(definition);
		setup.workflowRegistry.workflowDefinitions = definitions;
		this.writeSetup(repository, setup);
		return this.validate(setup);
	}

	updateWorkflow(
		workflowId: string,
		repository: string,
		phases: readonly (string | WorkflowPhase)[],
		acceptance: WorkflowAcceptance,
	): FactorySetup;
	updateWorkflow(
		repository: string,
		workflowId: string,
		phases: readonly (string | WorkflowPhase)[],
		acceptance: WorkflowAcceptance,
	): FactorySetup;
	updateWorkflow(
		first: string,
		second: string,
		phases: readonly (string | WorkflowPhase)[],
		acceptance: WorkflowAcceptance,
	): FactorySetup {
		const [repository, workflowId] = this.resolveArguments(first, second);
		const setup = this.requireSetup(repository);
		const definition = this.buildDefinition(workflowId, phases, acceptance);
		const definitions = setup.workflowRegistry.workflowDefinitions ?? [];
		const index = definitions.findIndex(
			(candidate) => candidate.id === workflowId,
		);
		if (index < 0) throw new Error(`Workflow not registered: ${workflowId}`);
		definitions[index] = definition;
		setup.workflowRegistry.workflowDefinitions = definitions;
		this.writeSetup(repository, setup);
		return this.validate(setup);
	}

	verifyFactory(repository: string): WorkflowSetupResult {
		try {
			return this.validate(this.requireSetup(repository));
		} catch {
			return { status: "Failed", failure: "InvalidWorkflowConfiguration" };
		}
	}

	private readSetup(repository: string): StoredSetup | undefined {
		try {
			return JSON.parse(
				readFileSync(join(repository, packageDirectory, packageFile), "utf8"),
			) as StoredSetup;
		} catch (error) {
			if (isMissingFile(error)) return undefined;
			throw error;
		}
	}

	private writeSetup(repository: string, setup: StoredSetup): void {
		const directory = join(repository, packageDirectory);
		mkdirSync(directory, { recursive: true });
		writeFileSync(
			join(directory, packageFile),
			`${JSON.stringify(setup, null, 2)}\n`,
		);
	}

	private validate(setup: StoredSetup): FactorySetup {
		const workflows = setup.workflowRegistry?.registeredWorkflows;
		const definitions = setup.workflowRegistry?.workflowDefinitions ?? [];
		const roles = setup.agentRoles;
		const hasExpectedWorkflows =
			Array.isArray(workflows) &&
			new Set(workflows).size === workflows.length &&
			starterWorkflowIds.every((id) => workflows.includes(id));
		const customWorkflowIds =
			Array.isArray(workflows) &&
			workflows.filter(
				(id) => !(starterWorkflowIds as readonly string[]).includes(id),
			);
		const hasValidDefinitions =
			Array.isArray(definitions) &&
			Array.isArray(customWorkflowIds) &&
			customWorkflowIds.every((id) =>
				definitions.some((definition) => definition.id === id),
			) &&
			definitions.every(
				(definition) =>
					workflows?.includes(definition.id) &&
					this.isValidWorkflowDefinition(definition),
			);
		const hasExpectedRoles =
			Array.isArray(roles) &&
			starterRoleNames.every((name) =>
				roles.some((role) => role.name === name),
			);
		const rolesAreComplete =
			Array.isArray(roles) &&
			roles.every(
				(role) =>
					typeof role.model === "string" &&
					role.model.length > 0 &&
					typeof role.instructions === "string" &&
					role.instructions.length > 0 &&
					Array.isArray(role.tools) &&
					role.tools.length > 0 &&
					Array.isArray(role.allowedWrites),
			);
		if (
			!hasExpectedWorkflows ||
			!hasValidDefinitions ||
			!hasExpectedRoles ||
			!rolesAreComplete
		) {
			throw new Error("Installed workflow package is invalid");
		}
		return setup;
	}

	private requireSetup(repository: string): StoredSetup {
		const setup = this.readSetup(repository);
		if (!setup) {
			throw new Error(`Workflow package is not installed in ${repository}`);
		}
		return setup;
	}

	private resolveArguments(first: string, second: string): [string, string] {
		return isAbsolute(first) ? [first, second] : [second, first];
	}

	private buildDefinition(
		workflowId: string,
		phases: readonly (string | WorkflowPhase)[],
		acceptance: WorkflowAcceptance,
	): WorkflowDefinitionRecord {
		const normalizedPhases = phases.map((phase) =>
			typeof phase === "string" ? { name: phase, role: phase } : { ...phase },
		);
		const definition = {
			id: workflowId,
			name: workflowId,
			phases: normalizedPhases,
			acceptance: {
				criteria: [...(acceptance?.criteria ?? [])],
				validationCommands: [...(acceptance?.validationCommands ?? [])],
			},
		};
		if (!this.isValidWorkflowDefinition(definition)) {
			throw new Error("Invalid workflow configuration");
		}
		return definition;
	}

	private isValidWorkflowDefinition(
		definition: WorkflowDefinitionRecord,
	): boolean {
		return (
			/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(definition.id) &&
			definition.id.length > 0 &&
			definition.phases.length > 0 &&
			new Set(definition.phases.map((phase) => phase.name)).size ===
				definition.phases.length &&
			definition.phases.every(
				(phase) => phase.name.length > 0 && phase.role.length > 0,
			) &&
			definition.acceptance.criteria.length > 0 &&
			(definition.acceptance.validationCommands ?? []).every(
				(command) => command.length > 0,
			)
		);
	}

	private toWorkflowDefinition(
		definition: WorkflowDefinitionRecord,
	): WorkflowDefinition {
		return {
			id: definition.id,
			name: definition.name,
			validationOperations: (
				definition.acceptance.validationCommands ?? []
			).map((command, index) => ({ name: `validation-${index + 1}`, command })),
			controller: async ({ ai, harness, objective }) => {
				for (const phase of definition.phases) {
					const input = objective ?? definition.acceptance.criteria.join("; ");
					if (["planner", "reviewer", "security"].includes(phase.role)) {
						await ai(phase.role, phase.name, input);
					} else {
						await harness(phase.role, phase.name, input);
					}
				}
			},
		};
	}
}

function reviewFindings(value: unknown): readonly string[] {
	if (!value || typeof value !== "object") return [];
	const findings = (value as { findings?: unknown }).findings;
	return Array.isArray(findings)
		? findings.filter(
				(finding): finding is string => typeof finding === "string",
			)
		: [];
}

function recordReviewFindings(
	context: RunContext,
	objective: string | undefined,
	findings: readonly string[],
): void {
	if (findings.length === 0) return;
	context.envelopes.set("review", {
		producer: "reviewer",
		consumer: "builder",
		status: "Fail",
		summary: findings.join("\n"),
		objective: objective ?? "Review the change",
		risks: findings,
		expectedFiles: [],
		acceptanceCriteria: [],
		validationCommands: [],
	});
}

function starterRole(name: string): AgentRole {
	return {
		name,
		model: "default",
		instructions: `${name} role instructions`,
		tools: ["read"],
		allowedWrites: [],
	};
}

function isMissingFile(error: unknown): error is NodeJS.ErrnoException {
	return error instanceof Error && "code" in error && error.code === "ENOENT";
}
