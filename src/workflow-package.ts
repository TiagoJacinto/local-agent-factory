import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { WorkflowDefinition } from "./workflow.ts";

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
			id: "plan-build",
			name: "Plan and build",
			controller: async ({ ai, harness, objective }) => {
				const plan = await ai("planner", "Plan request", objective ?? "Plan the requested change", {
					outputArtifact: "plan",
					outputEnvelope: { producer: "planner", consumer: "builder" },
				});
				if (plan.status === "Failed") return;
				await harness("builder", "Build request", objective ?? "Build the requested change", {
					inputArtifact: "plan",
				});
			},
		},
		{
			id: "plan-build-test-review",
			name: "Plan, build, test, and review",
			completesWithReview: true,
			controller: async ({ ai, harness, gate, objective }) => {
				const plan = await ai("planner", "Plan request", objective ?? "Plan the requested change", {
					outputArtifact: "plan",
					outputEnvelope: { producer: "planner", consumer: "builder" },
				});
				if (plan.status === "Failed") return;
				await harness("builder", "Build request", objective ?? "Build the requested change", {
					inputArtifact: "plan",
				});
				await ai("review", "Review change", "Review the change against the plan");
				await gate("review-gate", "Await human review", "Review the proposed change");
			},
		},
	];
}

export interface AgentRole {
	readonly name: string;
	readonly model: string;
	readonly instructions: string;
	readonly tools: readonly string[];
	readonly allowedWrites: readonly string[];
}

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
				registeredWorkflows: existing?.workflowRegistry.registeredWorkflows.length
					? existing.workflowRegistry.registeredWorkflows
					: [...starterWorkflowIds],
			},
			agentRoles: starterRoleNames.map((name) =>
				existing?.agentRoles.find((role) => role.name === name) ?? starterRole(name),
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
		writeFileSync(join(directory, packageFile), `${JSON.stringify(setup, null, 2)}\n`);
	}

	private validate(setup: StoredSetup): FactorySetup {
		if (
			setup.workflowRegistry.registeredWorkflows.length !== starterWorkflowIds.length ||
			!starterRoleNames.every((name) => setup.agentRoles.some((role) => role.name === name)) ||
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
