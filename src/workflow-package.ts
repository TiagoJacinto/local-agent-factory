import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
	WorkflowExecutor,
	type AgentRoleConfiguration,
	type PrimitiveAdapters,
	type WorkflowDefinition,
} from "./workflow.ts";

const packageDirectory = ".local-agent-factory";
const packageFile = "package.json";
const starterWorkflowIds = [
	"plan",
	"build",
	"test",
	"review",
	"document",
	"plan-build",
	"build-test",
	"build-review",
	"plan-build-test",
	"plan-build-review",
	"plan-build-test-review",
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

export interface WorkflowRegistry {
	readonly registeredWorkflows: readonly string[];
}

export function createStarterWorkflowDefinitions(): readonly WorkflowDefinition[] {
	return [
		{
			id: "review",
			name: "Review",
			completesWithReview: true,
			controller: async ({ ai, gate }) => {
				const review = await ai("reviewer", "Review change", "Review the change");
				if (review.status === "Failed") return;
				await gate("review-gate", "Await human review", "Review the proposed change");
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
				await harness("builder", "Build request", objective ?? "Build the requested change");
				if ((await validate()).status === "Failed") return;
				await ai("reviewer", "Review change", "Review the completed change");
				await harness("documenter", "Document change", "Document the completed change", {
					outputArtifact: "documentation",
				});
				await gate("review-gate", "Await human review", "Review the proposed change");
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
			id: "build-test-review",
			name: "Build, test, and review",
			completesWithReview: true,
			validationOperations: [{ name: "test", command: "test -f validation.pass" }],
			controller: async ({ harness, ai, gate, objective, validate }) => {
				await harness(
					"builder",
					"Build request",
					objective ?? "Build the requested change",
				);
				const validation = await validate();
				if (validation.status === "Failed") return;
				await ai("review", "Review change", "Review the validated change");
				await gate("review-gate", "Await human review", "Review the proposed change");
			},
		},
		{
			id: "build-review",
			name: "Build and review with correction",
			completesWithReview: true,
			validationOperations: [{ name: "test", command: "true" }],
			maxCorrectionAttempts: 1,
			controller: async ({ harness, ai, gate, objective, validate, context, correctionBudget, fail }) => {
				await harness(
					"builder",
					"Build request",
					objective ?? "Build the requested change",
					{ outputArtifact: "build" },
				);
				let review = await ai(
					"review",
					"Review change",
					"Review the change",
					{ outputArtifact: "review" },
				);
				let findings = review.status === "Succeeded"
					? reviewFindings(context.artifacts.get("review")?.value)
					: [];
				let correctionAttempts = 0;
				while (findings.length > 0) {
					if (correctionAttempts >= correctionBudget) {
						fail("CorrectionBudgetExceeded", "Correction budget exhausted", findings);
						return;
					}
					await harness(
						"builder",
						"Correct build",
						findings.join("\\n"),
						{ inputArtifact: "review" },
					);
					correctionAttempts += 1;
					const validation = await validate();
					if (validation.status === "Failed") return;
					review = await ai(
						"review",
						"Review corrected work",
						"Review the corrected change",
						{ outputArtifact: "review" },
					);
					findings = review.status === "Succeeded"
						? reviewFindings(context.artifacts.get("review")?.value)
						: [];
				}
				await gate("review-gate", "Await human review", "Review the proposed change");
			},
		},
		{
			id: "plan-build-test-review",
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
}

export interface AgentRole extends AgentRoleConfiguration {}

export interface FactorySetup {
	readonly workflowPackage: WorkflowPackage;
	readonly workflowRegistry: WorkflowRegistry;
	readonly agentRoles: readonly AgentRole[];
}

interface StoredSetup {
	workflowPackage: WorkflowPackage;
	workflowRegistry: WorkflowRegistry;
	agentRoles: AgentRole[];
}

export class WorkflowPackageInstaller {
	installWorkflowPackage(repository: string): FactorySetup {
		const existing = this.readSetup(repository);
		const setup: StoredSetup = {
			workflowPackage: { installed: true, repository },
			workflowRegistry: {
				registeredWorkflows: existing?.workflowRegistry.registeredWorkflows
					.length
					? existing.workflowRegistry.registeredWorkflows
					: [...starterWorkflowIds],
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

	/** Create an executor from the workflows registered in the installed package. */
	createExecutor(
		repository: string,
		adapters: PrimitiveAdapters = {},
	): WorkflowExecutor {
		const setup = this.configureWorkflowPackage(repository);
		const registered = new Set(setup.workflowRegistry.registeredWorkflows);
		const workflows = createStarterWorkflowDefinitions().filter((workflow) =>
			registered.has(workflow.id),
		);
		return new WorkflowExecutor(workflows, {
			...adapters,
			roles: setup.agentRoles,
		});
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
		if (
			setup.workflowRegistry.registeredWorkflows.length !==
				starterWorkflowIds.length ||
			!starterRoleNames.every((name) =>
				setup.agentRoles.some((role) => role.name === name),
			) ||
			setup.agentRoles.some(
				(role) =>
					!role.model ||
					!role.instructions ||
					role.tools.length === 0 ||
					!Array.isArray(role.allowedWrites),
			)
		) {
			throw new Error("Installed workflow package is invalid");
		}
		return setup;
	}
}

function reviewFindings(value: unknown): readonly string[] {
	if (!value || typeof value !== "object") return [];
	const findings = (value as { findings?: unknown }).findings;
	return Array.isArray(findings)
		? findings.filter((finding): finding is string => typeof finding === "string")
		: [];
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
