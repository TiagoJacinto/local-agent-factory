import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

export type PrimitiveType = "AI" | "Harness" | "Gate";
export type InvocationStatus = "Succeeded" | "Failed";
export type ValidationStatus = "Succeeded" | "Failed";
export type PrimitiveResultType<T extends PrimitiveType> =
	`${T}InvocationResult`;
export type WorkflowFailure =
	| "DirtySource"
	| "UnexpectedSourceRevision"
	| "AdapterFailed"
	| "EnvelopeParseFailed"
	| "ValidationFailed"
	| "CorrectionBudgetExceeded";
export type WorkflowStatus = "Succeeded" | "Failed" | "AwaitingReview";
export type WorkflowEnvelopeStatus = "Success" | "Fail";

export interface WorkflowEnvelope {
	readonly producer: string;
	readonly consumer: string;
	readonly status: WorkflowEnvelopeStatus;
	readonly objective: string;
	readonly risks: readonly string[];
	readonly expectedFiles: readonly string[];
	readonly acceptanceCriteria: readonly string[];
	readonly validationCommands: readonly string[];
}

export interface EnvelopeTarget {
	readonly producer: string;
	readonly consumer: string;
}
export type WorkspaceIsolation = "IndependentClone";
export type SourceIntegrity = "Verified";
export type WorkspaceDisposition = "Retained";

export interface Artifact {
	readonly id: string;
	readonly producerInvocationId: string;
	consumerInvocationId?: string;
	readonly value: unknown;
}

export interface ValidationOperation {
	readonly name: string;
	readonly command: string;
}

export interface ValidationResult {
	readonly operation: string;
	readonly command: string;
	readonly status: ValidationStatus;
	readonly evidence: {
		readonly exitCode: number;
		readonly output: string;
	};
	readonly workspacePath?: string;
}

export interface WorkflowSession {
	readonly id: string;
	readonly sameAgentContext: true;
}

export interface RunContext {
	readonly artifacts: Map<string, Artifact>;
	readonly envelopes: Map<string, WorkflowEnvelope>;
	readonly validationResults: ValidationResult[];
	readonly session: WorkflowSession;
}

export interface PrimitiveCallOptions {
	readonly inputArtifact?: string;
	readonly outputArtifact?: string;
	readonly outputEnvelope?: EnvelopeTarget;
}

export interface InvocationResult<T extends PrimitiveType = PrimitiveType> {
	readonly order: number;
	readonly invocationId: string;
	readonly name: string;
	readonly primitiveType: T;
	readonly resultType: PrimitiveResultType<T>;
	readonly status: InvocationStatus;
	readonly input: string;
	readonly consumedArtifact?: string;
	readonly producedArtifact?: string;
	readonly workspacePath?: string;
}

export type AIInvocationResult = InvocationResult<"AI">;
export type HarnessInvocationResult = InvocationResult<"Harness">;
export type GateInvocationResult = InvocationResult<"Gate">;

export interface PrimitiveInvocationArguments {
	readonly invocationId: string;
	readonly name: string;
	readonly input: string;
	readonly options?: PrimitiveCallOptions;
}

export type PrimitiveFunction<T extends PrimitiveType> = (
	...args: [
		PrimitiveInvocationArguments["invocationId"],
		PrimitiveInvocationArguments["name"],
		PrimitiveInvocationArguments["input"],
		PrimitiveInvocationArguments["options"]?,
	]
) => Promise<InvocationResult<T>>;

export interface WorkflowPrimitives {
	readonly context: RunContext;
	readonly objective?: string;
	readonly ai: PrimitiveFunction<"AI">;
	readonly harness: PrimitiveFunction<"Harness">;
	readonly gate: PrimitiveFunction<"Gate">;
	readonly validate: () => Promise<ValidationResult>;
	readonly correctionBudget: number;
	readonly fail: (failure: WorkflowFailure, message: string, output?: unknown) => void;
}

export type WorkflowController = (
	primitives: WorkflowPrimitives,
) => Promise<void> | void;

export interface WorkflowDefinition {
	readonly id: string;
	readonly name: string;
	readonly controller: WorkflowController;
	readonly validationOperations?: readonly ValidationOperation[];
	readonly maxCorrectionAttempts?: number;
	readonly completesWithReview?: boolean;
}

export interface WorkflowFailureEvidence {
	readonly invocationId?: string;
	readonly primitiveType?: PrimitiveType;
	readonly message: string;
	readonly output?: unknown;
}

export interface WorkflowRun {
	readonly workflowId: string;
	readonly status: WorkflowStatus;
	readonly invocations: readonly InvocationResult[];
	readonly context: RunContext;
	readonly runIdentifier?: string;
	readonly sourceRevision?: string;
	readonly workspacePath?: string;
	readonly workspaceIsolation?: WorkspaceIsolation;
	readonly sourceIntegrity?: SourceIntegrity;
	readonly failure?: WorkflowFailure;
	readonly failureEvidence?: WorkflowFailureEvidence;
	readonly workspaceDisposition?: WorkspaceDisposition;
	readonly validationResults: readonly ValidationResult[];
	readonly session: WorkflowSession;
}

export interface WorkflowExecutionOptions {
	readonly objective?: string;
	readonly sourceRepository?: string;
	readonly expectedSourceRevision?: string;
	readonly workspaceRoot?: string;
}

export interface AgentRoleConfiguration {
	readonly name: string;
	readonly model: string;
	readonly instructions: string;
	readonly tools: readonly string[];
	readonly allowedWrites: readonly string[];
}

export interface PrimitiveAdapterOutput {
	readonly value?: unknown;
	readonly status?: InvocationStatus;
}

export type PrimitiveAdapter = (input: {
	invocationId: string;
	name: string;
	input: string;
	context: RunContext;
	role?: AgentRoleConfiguration;
	inputArtifact?: Artifact;
	outputArtifact?: string;
	workspacePath?: string;
	session?: WorkflowSession;
}) =>
	| Promise<PrimitiveAdapterOutput | undefined>
	| PrimitiveAdapterOutput
	| undefined;

interface ResolvedPrimitiveAdapters {
	readonly ai: PrimitiveAdapter;
	readonly harness: PrimitiveAdapter;
	readonly gate: PrimitiveAdapter;
	readonly roles: ReadonlyMap<string, AgentRoleConfiguration>;
}

export interface PrimitiveAdapters {
	readonly ai?: PrimitiveAdapter;
	readonly harness?: PrimitiveAdapter;
	readonly gate?: PrimitiveAdapter;
	readonly roles?: readonly AgentRoleConfiguration[];
}

const deterministicAdapter: PrimitiveAdapter = () => undefined;

export class WorkflowExecutor {
	private readonly workflows: ReadonlyMap<string, WorkflowDefinition>;
	private readonly adapters: ResolvedPrimitiveAdapters;

	public constructor(
		workflows: readonly WorkflowDefinition[],
		adapters: PrimitiveAdapters = {},
	) {
		this.workflows = new Map(
			workflows.map((workflow) => [workflow.id, workflow]),
		);
		this.adapters = {
			ai: adapters.ai ?? deterministicAdapter,
			harness: adapters.harness ?? deterministicAdapter,
			gate: adapters.gate ?? deterministicAdapter,
			roles: new Map((adapters.roles ?? []).map((role) => [role.name, role])),
		};
	}

	public async executeWorkflow(
		workflowId: string,
		options: WorkflowExecutionOptions = {},
	): Promise<WorkflowRun> {
		const workflow = this.workflows.get(workflowId);
		if (!workflow) throw new Error(`Workflow not found: ${workflowId}`);

		const session: WorkflowSession = {
			id: `session-${randomUUID()}`,
			sameAgentContext: true,
		};
		const context: RunContext = {
			artifacts: new Map(),
			envelopes: new Map(),
			validationResults: [],
			session,
		};
		const source = options.sourceRepository
			? inspectSource(options.sourceRepository)
			: undefined;
		const runIdentifier = source ? `local-run-${randomUUID()}` : undefined;
		if (source && source.workingTree !== "Clean") {
			return {
				workflowId,
				status: "Failed",
				invocations: [],
				context,
				runIdentifier,
				sourceRevision: source.revision,
				sourceIntegrity: "Verified",
				failure: "DirtySource",
				validationResults: context.validationResults,
				session,
			};
		}
		if (
			source &&
			options.expectedSourceRevision &&
			source.revision !== options.expectedSourceRevision
		) {
			return {
				workflowId,
				status: "Failed",
				invocations: [],
				context,
				runIdentifier,
				sourceRevision: source.revision,
				sourceIntegrity: "Verified",
				failure: "UnexpectedSourceRevision",
				validationResults: context.validationResults,
				session,
			};
		}
		const workspacePath = source
			? createWorkspace(
					source.path,
					runIdentifier ?? throwMissingRunIdentifier(),
					options.workspaceRoot,
				)
			: undefined;
		const invocations: InvocationResult[] = [];
		let failure: WorkflowFailure | undefined;
		let failureEvidence: WorkflowFailureEvidence | undefined;
		const invoke = async <T extends PrimitiveType>(
			primitiveType: T,
			adapter: PrimitiveAdapter,
			invocationId: string,
			name: string,
			input: string,
			options: PrimitiveCallOptions = {},
		): Promise<InvocationResult<T>> => {
			const inputArtifact = options.inputArtifact
				? context.artifacts.get(options.inputArtifact)
				: undefined;
			if (options.inputArtifact && !inputArtifact) {
				throw new Error(`Artifact not found: ${options.inputArtifact}`);
			}

			let adapterOutput: PrimitiveAdapterOutput | undefined;
			let invocationStatus: InvocationStatus = "Succeeded";
			try {
				adapterOutput = await adapter({
					invocationId,
					name,
					input,
					context,
					role: this.adapters.roles.get(invocationId),
					inputArtifact,
					outputArtifact: options.outputArtifact,
					workspacePath,
					session,
				});
				invocationStatus = adapterOutput?.status ?? "Succeeded";
			} catch (error) {
				failure = "AdapterFailed";
				failureEvidence = {
					invocationId,
					primitiveType,
					message: error instanceof Error ? error.message : String(error),
				};
				invocationStatus = "Failed";
			}

			let envelope: WorkflowEnvelope | undefined;
			if (invocationStatus === "Succeeded" && options.outputEnvelope) {
				envelope = parseWorkflowEnvelope(
					adapterOutput?.value,
					options.outputEnvelope,
				);
				if (!envelope) {
					failure = "EnvelopeParseFailed";
					invocationStatus = "Failed";
					failureEvidence = {
						invocationId,
						primitiveType,
						message: "Primitive output is not a valid workflow envelope",
						output: adapterOutput?.value,
					};
				}
			}

			if (inputArtifact) inputArtifact.consumerInvocationId = invocationId;
			if (options.outputArtifact && invocationStatus === "Succeeded") {
				context.artifacts.set(options.outputArtifact, {
					id: options.outputArtifact,
					producerInvocationId: invocationId,
					value: envelope ?? adapterOutput?.value ?? input,
				});
			}
			if (envelope && options.outputArtifact) {
				context.envelopes.set(options.outputArtifact, envelope);
			}

			const result: InvocationResult<T> = {
				order: invocations.length + 1,
				invocationId,
				name,
				primitiveType,
				resultType: `${primitiveType}InvocationResult`,
				status: invocationStatus,
				input,
				...(options.inputArtifact
					? { consumedArtifact: options.inputArtifact }
					: {}),
				...(options.outputArtifact && invocationStatus === "Succeeded"
					? { producedArtifact: options.outputArtifact }
					: {}),
				...(workspacePath ? { workspacePath } : {}),
			};
			invocations.push(result);
			return result;
		};

		const fail = (reason: WorkflowFailure, message: string, output?: unknown): void => {
			failure = reason;
			failureEvidence = { message, ...(output !== undefined ? { output } : {}) };
		};

		const validate = async (): Promise<ValidationResult> => {
			const operations = workflow.validationOperations ?? [];
			let lastResult: ValidationResult = {
				operation: "none",
				command: "none",
				status: "Succeeded",
				evidence: { exitCode: 0, output: "No validation operations configured" },
				...(workspacePath ? { workspacePath } : {}),
			};
			for (const operation of operations) {
				try {
					const output = execFileSync("sh", ["-c", operation.command], {
						cwd: workspacePath,
						encoding: "utf8",
						stdio: ["ignore", "pipe", "pipe"],
					});
					lastResult = {
						operation: operation.name,
						command: operation.command,
						status: "Succeeded",
						evidence: { exitCode: 0, output },
						...(workspacePath ? { workspacePath } : {}),
					};
				} catch (error) {
					const commandError = error as NodeJS.ErrnoException & {
						status?: number;
						stdout?: Buffer;
						stderr?: Buffer;
					};
					lastResult = {
						operation: operation.name,
						command: operation.command,
						status: "Failed",
						evidence: {
							exitCode: commandError.status ?? 1,
							output: `${commandError.stdout?.toString() ?? ""}${commandError.stderr?.toString() ?? commandError.message}`,
						},
						...(workspacePath ? { workspacePath } : {}),
					};
				}
				context.validationResults.push(lastResult);
				if (lastResult.status === "Failed") {
					failure = "ValidationFailed";
					failureEvidence = {
						message: `Validation failed: ${lastResult.operation}`,
						output: lastResult.evidence,
					};
					break;
				}
			}
			return lastResult;
		};

		await workflow.controller({
			context,
			objective: options.objective,
			correctionBudget: workflow.maxCorrectionAttempts ?? 0,
			fail,
			validate,
			ai: (id, name, input, options) =>
				invoke("AI", this.adapters.ai, id, name, input, options),
			harness: (id, name, input, options) =>
				invoke("Harness", this.adapters.harness, id, name, input, options),
			gate: (id, name, input, options) =>
				invoke("Gate", this.adapters.gate, id, name, input, options),
		});

		let status: WorkflowRun["status"] = "Succeeded";
		if (failure || invocations.some((invocation) => invocation.status === "Failed")) {
			status = "Failed";
		} else if (
			workflow.completesWithReview &&
			invocations.some((invocation) => invocation.primitiveType === "Gate")
		) {
			status = "AwaitingReview";
		}
		const workspaceDisposition =
			status === "Failed" ? ("Retained" as const) : undefined;
		return {
			workflowId,
			status,
			invocations,
			context,
			...(failure
				? { failure, ...(failureEvidence ? { failureEvidence } : {}) }
				: {}),
			validationResults: context.validationResults,
			session,
			...(source
				? {
						runIdentifier,
						sourceRevision: source.revision,
						workspacePath,
						workspaceIsolation: "IndependentClone" as const,
						sourceIntegrity: "Verified" as const,
						...(workspaceDisposition ? { workspaceDisposition } : {}),
					}
				: {}),
		};
	}
}

function parseWorkflowEnvelope(
	value: unknown,
	target: EnvelopeTarget,
): WorkflowEnvelope | undefined {
	if (!value || typeof value !== "object") return undefined;
	const candidate = value as Record<string, unknown>;
	if (
		candidate.producer !== target.producer ||
		candidate.consumer !== target.consumer ||
		(candidate.status !== "Success" && candidate.status !== "Fail") ||
		typeof candidate.objective !== "string" ||
		!isStringArray(candidate.risks) ||
		!isStringArray(candidate.expectedFiles) ||
		!isStringArray(candidate.acceptanceCriteria) ||
		!isStringArray(candidate.validationCommands)
	) {
		return undefined;
	}
	return candidate as unknown as WorkflowEnvelope;
}

function isStringArray(value: unknown): value is readonly string[] {
	return (
		Array.isArray(value) && value.every((item) => typeof item === "string")
	);
}

function throwMissingRunIdentifier(): never {
	throw new Error("Source execution requires a run identifier");
}

function inspectSource(path: string): {
	path: string;
	revision: string;
	workingTree: "Clean" | "Dirty";
} {
	const revision = execFileSync("git", ["-C", path, "rev-parse", "HEAD"], {
		encoding: "utf8",
	}).trim();
	const workingTree = execFileSync(
		"git",
		["-C", path, "status", "--porcelain"],
		{
			encoding: "utf8",
		},
	).trim()
		? "Dirty"
		: "Clean";
	return { path, revision, workingTree };
}

function createWorkspace(
	sourcePath: string,
	runIdentifier: string,
	workspaceRoot = "/tmp",
): string {
	const workspacePath = join(workspaceRoot, runIdentifier);
	mkdirSync(workspaceRoot, { recursive: true });
	execFileSync("git", ["clone", "--quiet", sourcePath, workspacePath]);
	return workspacePath;
}
