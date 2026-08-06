import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	InMemoryWorkflowTraceStore,
	type WorkflowTrace,
	type WorkflowTraceEvent,
	type WorkflowTraceStore,
} from "./workflow-trace.js";

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
	| "CorrectionBudgetExceeded"
	| "PermissionViolation";
export type WorkflowStatus =
	| "Running"
	| "Succeeded"
	| "Failed"
	| "AwaitingReview";
export type WorkflowEnvelopeStatus = "Success" | "Fail";

export interface WorkflowEnvelope {
	readonly producer: string;
	readonly consumer: string;
	readonly status: WorkflowEnvelopeStatus;
	readonly summary?: string;
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
	readonly kind?: "ReviewableChange";
	readonly reference?: string;
}

export interface CommitReference {
	readonly product: "plan" | "build" | "documentation";
	readonly phase: string;
	readonly revision: string;
	readonly message: string;
}

export interface ReviewHandoff {
	readonly status: "AwaitingReview";
	readonly commits: readonly CommitReference[];
	readonly manualIntegrationGuidance: string;
}

export interface WorkflowPhase {
	readonly name: string;
	readonly owner: string;
}

export interface ValidationOperation {
	readonly name: string;
	readonly command: string;
}

export interface WorkflowPrimitives {
	readonly context: RunContext;
	readonly objective?: string;
	readonly ai: PrimitiveFunction<"AI">;
	readonly harness: PrimitiveFunction<"Harness">;
	readonly gate: PrimitiveFunction<"Gate">;
	readonly commit: (
		phase: string,
		product: CommitReference["product"],
		message: string,
	) => Promise<CommitReference>;
	readonly validate: () => Promise<ValidationResult>;
	readonly correctionBudget: number;
	readonly fail: (
		failure: WorkflowFailure,
		message: string,
		output?: unknown,
	) => void;
}

export interface WorkflowDefinition {
	readonly id: string;
	readonly name: string;
	readonly controller: WorkflowController;
	readonly phases?: readonly WorkflowPhase[];
	readonly validationOperations?: readonly ValidationOperation[];
	readonly maxCorrectionAttempts?: number;
	readonly completesWithReview?: boolean;
}

export interface WorkflowRun {
	readonly workflowId: string;
	readonly status: WorkflowStatus;
	readonly sourceRepositoryUnchanged?: true;
	readonly integration?: "Manual";
	readonly invocations: readonly InvocationResult[];
	readonly context: RunContext;
	readonly phaseOwners: readonly WorkflowPhase[];
	readonly reviewHandoff?: ReviewHandoff;
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
	readonly runIdentifier: string;
	readonly sameAgentContext: true;
	/** Pi session IDs, keyed by workflow role, for resumable invocations. */
	readonly agentSessions: Record<string, string>;
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


export type WorkflowController = (
	primitives: WorkflowPrimitives,
) => Promise<void> | void;


export interface WorkflowFailureEvidence {
	readonly invocationId?: string;
	readonly primitiveType?: PrimitiveType;
	readonly message: string;
	readonly output?: unknown;
}


export interface WorkflowExecutionOptions {
	readonly runIdentifier?: string;
	readonly objective?: string;
	readonly sourceRepository?: string;
	readonly expectedSourceRevision?: string;
	readonly workspaceRoot?: string;
}

export interface WorkflowExecutorOptions {
	readonly sessionStorePath?: string;
}

export interface AgentRoleConfiguration {
	readonly name: string;
	readonly model: string;
	readonly instructions: string;
	readonly tools: readonly string[];
	readonly allowedWrites: readonly string[];
	readonly harnessSupport?: boolean;
	readonly protectedPaths?: readonly string[];
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
	emit?: (event: { name: string; status: "Running"; data?: unknown }) => void;
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
	readonly traceStore?: WorkflowTraceStore;
}

const deterministicAdapter: PrimitiveAdapter = () => undefined;

interface PersistedWorkflowSession {
	readonly runIdentifier: string;
	readonly workflowId: string;
	readonly session: WorkflowSession;
	readonly context: {
		readonly artifacts: readonly [string, Artifact][];
		readonly envelopes: readonly [string, WorkflowEnvelope][];
		readonly validationResults: readonly ValidationResult[];
	};
	readonly invocations: readonly InvocationResult[];
	readonly status: WorkflowStatus;
	readonly sourceRepository?: string;
	readonly sourceRevision?: string;
	readonly workspacePath?: string;
}

export class WorkflowExecutor {
	private readonly workflows: ReadonlyMap<string, WorkflowDefinition>;
	private readonly adapters: ResolvedPrimitiveAdapters;
	private readonly sessionStorePath: string;
	private readonly traceStore: WorkflowTraceStore;

	public constructor(
		workflows: readonly WorkflowDefinition[],
		adapters: PrimitiveAdapters = {},
		options: WorkflowExecutorOptions = {},
	) {
		const workflowsById = new Map(
			workflows.map((workflow) => [workflow.id, workflow]),
		);
		for (const [alias, id] of Object.entries({
			"plan-build-test-review": "plan-build-test-quality",
			review: "quality",
		})) {
			const workflow = workflowsById.get(id);
			if (workflow && !workflowsById.has(alias)) {
				workflowsById.set(alias, workflow);
			}
		}
		this.workflows = workflowsById;
		this.adapters = {
			ai: adapters.ai ?? deterministicAdapter,
			harness: adapters.harness ?? deterministicAdapter,
			gate: adapters.gate ?? deterministicAdapter,
			roles: new Map((adapters.roles ?? []).map((role) => [role.name, role])),
		};
		this.sessionStorePath =
			options.sessionStorePath ??
			join(tmpdir(), "local-agent-factory-sessions");
		this.traceStore = adapters.traceStore ?? new InMemoryWorkflowTraceStore();
	}

	public async resumeWorkflow(
		runIdentifier: string,
		correction: string,
	): Promise<WorkflowRun> {
		const persisted = this.readSession(runIdentifier);
		if (!persisted)
			throw new Error(`Workflow session not found: ${runIdentifier}`);
		return this.executeWorkflow(persisted.workflowId, {
			objective: correction,
			runIdentifier,
			sourceRepository: persisted.sourceRepository,
			expectedSourceRevision: persisted.sourceRevision,
		});
	}

	public inspectWorkflowRun(runIdentifier: string): WorkflowTrace | undefined {
		const trace = this.traceStore.get(runIdentifier);
		if (trace instanceof Promise) {
			throw new Error(
				"The configured workflow trace store must provide synchronous inspection",
			);
		}
		return trace;
	}

	public async executeWorkflow(
		workflowId: string,
		options: WorkflowExecutionOptions = {},
	): Promise<WorkflowRun> {
		const workflow =
			this.workflows.get(workflowId) ??
			this.workflows.get(
				{
					"plan-build-test-review": "plan-build-test-quality",
					review: "quality",
					document: "document",
				}[workflowId] ?? workflowId,
			);
		if (!workflow) throw new Error(`Workflow not found: ${workflowId}`);

		const runIdentifier = options.runIdentifier ?? `local-run-${randomUUID()}`;
		const persisted = this.readSession(runIdentifier);
		const session: WorkflowSession = persisted
			? {
					...persisted.session,
					agentSessions: persisted.session.agentSessions ?? {},
				}
			: {
					id: `session-${randomUUID()}`,
					runIdentifier,
					sameAgentContext: true,
					agentSessions: {},
				};
		const context: RunContext = persisted
			? restoreContext(persisted.context, session)
			: {
					artifacts: new Map(),
					envelopes: new Map(),
					validationResults: [],
					session,
				};
		const source = options.sourceRepository
			? inspectSource(options.sourceRepository)
			: undefined;
		const traceEvents: WorkflowTraceEvent[] = [
			{ sequence: 1, kind: "process", name: workflow.id, status: "Running" },
			{ sequence: 2, kind: "phase", name: workflow.name, status: "Running" },
		];
		const trace: WorkflowTrace = {
			runIdentifier,
			workflowId,
			status: "Running",
			events: traceEvents,
			validationResults: [],
			envelopes: [],
			artifacts: [],
		};
		await this.traceStore.start(trace);
		if (source && source.workingTree !== "Clean") {
			trace.status = "Failed";
			trace.failure = "DirtySource";
			await this.traceStore.save(trace);
			return {
				workflowId,
				status: "Failed",
				invocations: [],
				context,
				phaseOwners: workflow.phases ?? [],
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
			trace.status = "Failed";
			trace.failure = "UnexpectedSourceRevision";
			await this.traceStore.save(trace);
			return {
				workflowId,
				status: "Failed",
				invocations: [],
				context,
				phaseOwners: workflow.phases ?? [],
				runIdentifier,
				sourceRevision: source.revision,
				sourceIntegrity: "Verified",
				failure: "UnexpectedSourceRevision",
				validationResults: context.validationResults,
				session,
			};
		}
		const workspacePath =
			persisted?.workspacePath ??
			(source
				? createWorkspace(source.path, runIdentifier, options.workspaceRoot)
				: undefined);
		const invocations: InvocationResult[] = persisted
			? [...persisted.invocations]
			: [];
		const roleBaselines = new Map<string, readonly string[]>();
		const commitReferences: CommitReference[] = [];
		const commit = async (
			phase: string,
			product: CommitReference["product"],
			message: string,
		): Promise<CommitReference> => {
			if (!workspacePath)
				throw new Error("Commit phases require a source repository workspace");
			execFileSync("git", ["-C", workspacePath, "add", "--all"]);
			execFileSync("git", [
				"-C", workspacePath,
				"-c", "user.name=Local Agent Factory",
				"-c", "user.email=local-agent-factory@example.invalid",
				"commit", "--quiet", "--allow-empty", "-m", message,
			]);
			const revision = execFileSync(
			"git", ["-C", workspacePath, "rev-parse", "HEAD"], { encoding: "utf8" },
			).trim();
			const reference = { product, phase, revision, message };
			commitReferences.push(reference);
			await recordTraceEvent({
				kind: "phase", name: phase, status: "Succeeded",
				data: { owner: "git", product, revision, message },
			});
			return reference;
		};
		let failure: WorkflowFailure | undefined;
		let failureEvidence: WorkflowFailureEvidence | undefined;
		const recordTraceEvent = (event: Omit<WorkflowTraceEvent, "sequence">) => {
			traceEvents.push({ ...event, sequence: traceEvents.length + 1 });
			return this.traceStore.save({ ...trace, events: traceEvents });
		};
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
			await recordTraceEvent({
				kind: "primitive",
				name,
				status: "Running",
				data: { invocationId, primitiveType },
			});
			if (primitiveType === "Harness") {
				await recordTraceEvent({
					kind: "tool_call",
					name,
					status: "Running",
					data: {
						invocationId,
						arguments: input,
					},
				});
			}
			const role = workspacePath
				? resolveRole(this.adapters.roles, invocationId)
				: undefined;
			if (role && workspacePath && !roleBaselines.has(role.name)) {
				roleBaselines.set(role.name, inspectWorkspaceChanges(workspacePath));
			}
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
					emit: (event) => {
						recordTraceEvent({ kind: "process", ...event });
					},
				});
				invocationStatus = adapterOutput?.status ?? "Succeeded";
				if (workspacePath && role) {
					const baseline = roleBaselines.get(role.name) ?? [];
					const changedPaths = inspectWorkspaceChanges(workspacePath).filter(
						(path) => !baseline.includes(path),
					);
					const unauthorizedPath = changedPaths.find(
						(path) => !isAllowedWrite(path, role),
					);
					if (unauthorizedPath) {
						failure = "PermissionViolation";
						failureEvidence = {
							invocationId,
							message: "repository change outside role boundary",
							output: { path: unauthorizedPath, role: role.name },
						};
						context.envelopes.set("permission-failure", {
							producer: role.name,
							consumer: "operator",
							status: "Fail",
							summary: "repository change outside role boundary",
							objective: "",
							risks: [],
							expectedFiles: [],
							acceptanceCriteria: [],
							validationCommands: [],
						});
						invocationStatus = "Failed";
					}
				}
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
					if (options.outputEnvelope) {
						context.envelopes.set(options.outputArtifact ?? invocationId, {
							producer: options.outputEnvelope.producer,
							consumer: options.outputEnvelope.consumer,
							status: "Fail",
							summary: "Primitive output is not a valid workflow envelope",
							objective: input,
							risks: [],
							expectedFiles: [],
							acceptanceCriteria: [],
							validationCommands: [],
						});
					}
				} else if (failure === "EnvelopeParseFailed") {
					failure = undefined;
					failureEvidence = undefined;
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
			recordTraceEvent({
				kind: "primitive",
				name,
				status: invocationStatus,
				data: {
					invocationId,
					primitiveType,
					result: adapterOutput?.value,
				},
			});
			if (primitiveType === "Harness") {
				recordTraceEvent({
					kind: "tool_call",
					name,
					status: invocationStatus,
					data: {
						invocationId,
						arguments: input,
						result: adapterOutput?.value,
					},
				});
			}
			await this.traceStore.save({ ...trace, events: traceEvents });
			return result;
		};

		const fail = (
			reason: WorkflowFailure,
			message: string,
			output?: unknown,
		): void => {
			failure = reason;
			failureEvidence = {
				message,
				...(output !== undefined ? { output } : {}),
			};
		};

		const validate = async (): Promise<ValidationResult> => {
			const operations = workflow.validationOperations ?? [];
			let lastResult: ValidationResult = {
				operation: "none",
				command: "none",
				status: "Succeeded",
				evidence: {
					exitCode: 0,
					output: "No validation operations configured",
				},
				...(workspacePath ? { workspacePath } : {}),
			};
			if (operations.length === 0) {
				context.validationResults.push(lastResult);
				traceEvents.push({
					sequence: traceEvents.length + 1,
					kind: "validation",
					name: lastResult.operation,
					status: lastResult.status,
					data: lastResult.evidence,
				});
				await this.traceStore.save({
					...trace,
					events: traceEvents,
					validationResults: [...context.validationResults],
				});
			}
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
				traceEvents.push({
					sequence: traceEvents.length + 1,
					kind: "validation",
					name: lastResult.operation,
					status: lastResult.status,
					data: lastResult.evidence,
				});
				await this.traceStore.save({
					...trace,
					events: traceEvents,
					validationResults: [...context.validationResults],
				});
				if (lastResult.status === "Failed") {
					failure = "ValidationFailed";
					failureEvidence = {
						message: `Validation failed: ${lastResult.operation}`,
						output: lastResult.evidence,
					};
					break;
				}
			}
			if (lastResult.status === "Succeeded" && failure === "ValidationFailed") {
				failure = undefined;
				failureEvidence = undefined;
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
			commit,
			gate: (id, name, input, options) =>
				invoke("Gate", this.adapters.gate, id, name, input, options),
		});

		let status: WorkflowRun["status"] = persisted ? "Running" : "Succeeded";
		const latestInvocationStatus = new Map<string, InvocationStatus>();
		for (const invocation of invocations) {
			latestInvocationStatus.set(invocation.invocationId, invocation.status);
		}
		if (
			failure ||
			[...latestInvocationStatus.values()].some(
				(invocationStatus) => invocationStatus === "Failed",
			)
		) {
			status = "Failed";
		} else if (
			!persisted &&
			workflow.completesWithReview &&
			invocations.some((invocation) => invocation.primitiveType === "Gate")
		) {
			status = "AwaitingReview";
		}
		const reviewHandoff =
			status === "AwaitingReview"
				? {
						status: "AwaitingReview" as const,
						commits: [...commitReferences],
						manualIntegrationGuidance:
							"Review each accepted product commit before manual integration.",
					}
				: undefined;
		if (reviewHandoff) {
			context.artifacts.set("review-handoff", {
				id: "review-handoff",
				producerInvocationId: "workflow",
				value: reviewHandoff,
			});
		}
		const workspaceDisposition =
			status === "Failed" ? ("Retained" as const) : undefined;
		if (source && workspacePath) {
			context.artifacts.set("reviewable-change", {
				id: "reviewable-change",
				producerInvocationId: invocations.at(-1)?.invocationId ?? "workflow",
				kind: "ReviewableChange",
				reference: workspacePath,
				value: {
					workspacePath,
					changedPaths: inspectWorkspaceChanges(workspacePath),
				},
			});
		}
		trace.status = status;
		trace.events = [
			...traceEvents,
			{
				sequence: traceEvents.length + 1,
				kind: "phase",
				name: workflow.name,
				status,
			},
			{
				sequence: traceEvents.length + 2,
				kind: "process",
				name: workflow.id,
				status,
			},
		];
		trace.phaseOwners = workflow.phases;
		trace.reviewHandoff = reviewHandoff;

		trace.validationResults = [...context.validationResults];
		trace.envelopes = [...context.envelopes.values()];
		trace.artifacts = [...context.artifacts.values()];
		if (workspacePath) trace.workspacePath = workspacePath;
		if (workspaceDisposition) trace.workspaceDisposition = workspaceDisposition;
		if (failure) trace.failure = failure;
		if (failureEvidence) trace.failureEvidence = failureEvidence;
		await this.traceStore.save(trace);
		const run: WorkflowRun = {
			workflowId,
			status,
			runIdentifier,
			invocations,
			context,
			phaseOwners: workflow.phases ?? [],
			...(reviewHandoff ? { reviewHandoff } : {}),
			...(failure
				? { failure, ...(failureEvidence ? { failureEvidence } : {}) }
				: {}),
			validationResults: context.validationResults,
			session,
			...(source || persisted?.sourceRevision
				? {
						sourceRepositoryUnchanged: true,
						integration: "Manual" as const,
						runIdentifier,
						sourceRevision: source?.revision ?? persisted?.sourceRevision,
						workspacePath,
						workspaceIsolation: "IndependentClone" as const,
						sourceIntegrity: "Verified" as const,
						...(workspaceDisposition ? { workspaceDisposition } : {}),
					}
				: {}),
		};
		this.writeSession({
			runIdentifier,
			workflowId,
			session,
			context: {
				artifacts: [...context.artifacts.entries()],
				envelopes: [...context.envelopes.entries()],
				validationResults: context.validationResults,
			},
			invocations,
			status,
			sourceRepository: options.sourceRepository ?? persisted?.sourceRepository,
			sourceRevision: source?.revision ?? persisted?.sourceRevision,
			workspacePath,
		});
		return run;
	}

	private readSession(
		runIdentifier: string,
	): PersistedWorkflowSession | undefined {
		try {
			return JSON.parse(
				readFileSync(
					join(this.sessionStorePath, `${runIdentifier}.json`),
					"utf8",
				),
			) as PersistedWorkflowSession;
		} catch (error) {
			if (isMissingFile(error)) return undefined;
			throw error;
		}
	}

	private writeSession(session: PersistedWorkflowSession): void {
		mkdirSync(this.sessionStorePath, { recursive: true });
		writeFileSync(
			join(this.sessionStorePath, `${session.runIdentifier}.json`),
			`${JSON.stringify(session, null, 2)}\n`,
		);
	}
}

function restoreContext(
	persisted: PersistedWorkflowSession["context"],
	session: WorkflowSession,
): RunContext {
	return {
		artifacts: new Map(persisted.artifacts),
		envelopes: new Map(persisted.envelopes),
		validationResults: [...persisted.validationResults],
		session,
	};
}

function isMissingFile(error: unknown): error is NodeJS.ErrnoException {
	return error instanceof Error && "code" in error && error.code === "ENOENT";
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

function inspectWorkspaceChanges(workspacePath: string): readonly string[] {
	const output = execFileSync(
		"git",
		["-C", workspacePath, "status", "--porcelain", "--untracked-files=all"],
		{ encoding: "utf8" },
	);
	return output
		.split("\n")
		.filter(Boolean)
		.map((line) => line.slice(3).trim());
}

function resolveRole(
	roles: ReadonlyMap<string, AgentRoleConfiguration>,
	invocationId: string,
): AgentRoleConfiguration | undefined {
	const roleAliases: Record<string, string> = {
		plan: "planner",
		build: "builder",
		review: "reviewer",
		document: "documenter",
	};
	return roles.get(invocationId) ?? roles.get(roleAliases[invocationId] ?? "");
}

function isAllowedWrite(path: string, role: AgentRoleConfiguration): boolean {
	if (
		role.protectedPaths?.some(
			(protectedPath) =>
				path === protectedPath || path.startsWith(`${protectedPath}/`),
		)
	) {
		return false;
	}
	return role.allowedWrites.some(
		(allowedPath) =>
			allowedPath === "*" ||
			allowedPath === path ||
			path.startsWith(`${allowedPath}/`),
	);
}
