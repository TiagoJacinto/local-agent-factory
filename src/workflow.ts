import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

export type PrimitiveType = "AI" | "Harness" | "Gate";
export type InvocationStatus = "Succeeded" | "Failed";
export type PrimitiveResultType<T extends PrimitiveType> =
	`${T}InvocationResult`;
export type WorkflowFailure = "DirtySource" | "UnexpectedSourceRevision";
export type WorkspaceIsolation = "IndependentClone";
export type SourceIntegrity = "Verified";
export type WorkspaceDisposition = "Retained";

export interface Artifact {
	readonly id: string;
	readonly producerInvocationId: string;
	consumerInvocationId?: string;
	readonly value: unknown;
}

export interface RunContext {
	readonly artifacts: Map<string, Artifact>;
}

export interface PrimitiveCallOptions {
	readonly inputArtifact?: string;
	readonly outputArtifact?: string;
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
	readonly ai: PrimitiveFunction<"AI">;
	readonly harness: PrimitiveFunction<"Harness">;
	readonly gate: PrimitiveFunction<"Gate">;
}

export type WorkflowController = (
	primitives: WorkflowPrimitives,
) => Promise<void> | void;

export interface WorkflowDefinition {
	readonly id: string;
	readonly name: string;
	readonly controller: WorkflowController;
}

export interface WorkflowRun {
	readonly workflowId: string;
	readonly status: "Succeeded" | "Failed";
	readonly invocations: readonly InvocationResult[];
	readonly context: RunContext;
	readonly runIdentifier?: string;
	readonly sourceRevision?: string;
	readonly workspacePath?: string;
	readonly workspaceIsolation?: WorkspaceIsolation;
	readonly sourceIntegrity?: SourceIntegrity;
	readonly failure?: WorkflowFailure;
	readonly workspaceDisposition?: WorkspaceDisposition;
}

export interface WorkflowExecutionOptions {
	readonly sourceRepository?: string;
	readonly expectedSourceRevision?: string;
	readonly workspaceRoot?: string;
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
	inputArtifact?: Artifact;
	outputArtifact?: string;
	workspacePath?: string;
}) =>
	| Promise<PrimitiveAdapterOutput | undefined>
	| PrimitiveAdapterOutput
	| undefined;

interface ResolvedPrimitiveAdapters {
	readonly ai: PrimitiveAdapter;
	readonly harness: PrimitiveAdapter;
	readonly gate: PrimitiveAdapter;
}

export interface PrimitiveAdapters {
	readonly ai?: PrimitiveAdapter;
	readonly harness?: PrimitiveAdapter;
	readonly gate?: PrimitiveAdapter;
}

const deterministicAdapter: PrimitiveAdapter = () => undefined;

type SourceSnapshot = {
	path: string;
	revision: string;
	workingTree: "Clean" | "Dirty";
};

type SourceFacts =
	| { source: undefined; expectedSourceRevision?: string }
	| {
			source: SourceSnapshot;
			expectedSourceRevision?: string;
			runIdentifier: string;
	  };

type SourceDecision =
	| { kind: "NoSource" }
	| {
			kind: "Rejected";
			failure: WorkflowFailure;
			source: SourceSnapshot;
			runIdentifier: string;
	  }
	| { kind: "Verified"; source: SourceSnapshot; runIdentifier: string };

function readSourceFacts(options: WorkflowExecutionOptions): SourceFacts {
	let source: SourceSnapshot | undefined;
	if (options.sourceRepository) {
		source = inspectSource(options.sourceRepository);
	}
	if (!source) {
		return {
			source: undefined,
			expectedSourceRevision: options.expectedSourceRevision,
		};
	}
	return {
		source,
		expectedSourceRevision: options.expectedSourceRevision,
		runIdentifier: `local-run-${randomUUID()}`,
	};
}

function decideSource(facts: SourceFacts): SourceDecision {
	if (!facts.source) return { kind: "NoSource" };
	if (facts.source.workingTree !== "Clean") {
		return {
			kind: "Rejected",
			failure: "DirtySource",
			source: facts.source,
			runIdentifier: facts.runIdentifier,
		};
	}
	if (
		facts.expectedSourceRevision &&
		facts.source.revision !== facts.expectedSourceRevision
	) {
		return {
			kind: "Rejected",
			failure: "UnexpectedSourceRevision",
			source: facts.source,
			runIdentifier: facts.runIdentifier,
		};
	}
	return {
		kind: "Verified",
		source: facts.source,
		runIdentifier: facts.runIdentifier,
	};
}

function rejectedSourceRun(
	workflowId: string,
	context: RunContext,
	decision: Extract<SourceDecision, { kind: "Rejected" }>,
): WorkflowRun {
	return {
		workflowId,
		status: "Failed",
		invocations: [],
		context,
		runIdentifier: decision.runIdentifier,
		sourceRevision: decision.source.revision,
		sourceIntegrity: "Verified",
		failure: decision.failure,
	};
}

function createSourceMetadata(
	decision: SourceDecision,
	workspacePath: string | undefined,
): Pick<
	WorkflowRun,
	| "runIdentifier"
	| "sourceRevision"
	| "workspacePath"
	| "workspaceIsolation"
	| "sourceIntegrity"
> {
	if (decision.kind !== "Verified") return {};
	return {
		runIdentifier: decision.runIdentifier,
		sourceRevision: decision.source.revision,
		workspacePath,
		workspaceIsolation: "IndependentClone",
		sourceIntegrity: "Verified",
	};
}

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
		};
	}

	public async executeWorkflow(
		workflowId: string,
		options: WorkflowExecutionOptions = {},
	): Promise<WorkflowRun> {
		const workflow = this.workflows.get(workflowId);
		if (!workflow) throw new Error(`Workflow not found: ${workflowId}`);

		const context: RunContext = { artifacts: new Map() };
		const sourceDecision = decideSource(readSourceFacts(options));
		if (sourceDecision.kind === "Rejected") {
			return rejectedSourceRun(workflowId, context, sourceDecision);
		}
		let workspacePath: string | undefined;
		if (sourceDecision.kind === "Verified") {
			workspacePath = createWorkspace(
				sourceDecision.source.path,
				sourceDecision.runIdentifier,
				options.workspaceRoot,
			);
		}
		const invocations: InvocationResult[] = [];
		const invoke = async <T extends PrimitiveType>(
			primitiveType: T,
			adapter: PrimitiveAdapter,
			invocationId: string,
			name: string,
			input: string,
			options: PrimitiveCallOptions = {},
		): Promise<InvocationResult<T>> => {
			let inputArtifact: Artifact | undefined;
			if (options.inputArtifact) {
				inputArtifact = context.artifacts.get(options.inputArtifact);
			}
			if (options.inputArtifact && !inputArtifact) {
				throw new Error(`Artifact not found: ${options.inputArtifact}`);
			}

			const adapterOutput = await adapter({
				invocationId,
				name,
				input,
				context,
				inputArtifact,
				outputArtifact: options.outputArtifact,
				workspacePath,
			});

			if (inputArtifact) inputArtifact.consumerInvocationId = invocationId;
			if (options.outputArtifact) {
				context.artifacts.set(options.outputArtifact, {
					id: options.outputArtifact,
					producerInvocationId: invocationId,
					value: adapterOutput?.value ?? input,
				});
			}

			const result: InvocationResult<T> = {
				order: invocations.length + 1,
				invocationId,
				name,
				primitiveType,
				resultType: `${primitiveType}InvocationResult`,
				status: adapterOutput?.status ?? "Succeeded",
				input,
				...(options.inputArtifact
					? { consumedArtifact: options.inputArtifact }
					: {}),
				...(options.outputArtifact
					? { producedArtifact: options.outputArtifact }
					: {}),
				...(workspacePath ? { workspacePath } : {}),
			};
			invocations.push(result);
			return result;
		};

		await workflow.controller({
			context,
			ai: (id, name, input, options) =>
				invoke("AI", this.adapters.ai, id, name, input, options),
			harness: (id, name, input, options) =>
				invoke("Harness", this.adapters.harness, id, name, input, options),
			gate: (id, name, input, options) =>
				invoke("Gate", this.adapters.gate, id, name, input, options),
		});

		const status =
			invocations.find((invocation) => invocation.status === "Failed")
				?.status ?? "Succeeded";
		const baseRun = { workflowId, status, invocations, context };
		const sourceMetadata = createSourceMetadata(sourceDecision, workspacePath);
		if (status === "Failed") {
			return {
				...baseRun,
				...sourceMetadata,
				workspaceDisposition: "Retained",
			};
		}
		return { ...baseRun, ...sourceMetadata };
	}
}

function inspectSource(path: string): SourceSnapshot {
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
