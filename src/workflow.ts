export type PrimitiveType = "AI" | "Harness" | "Gate";
export type InvocationStatus = "Succeeded" | "Failed";
export type PrimitiveResultType<T extends PrimitiveType> = `${T}InvocationResult`; 

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

export type WorkflowController = (primitives: WorkflowPrimitives) => Promise<void> | void;

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
}

export interface PrimitiveAdapterOutput {
	readonly value?: unknown;
}

export type PrimitiveAdapter = (input: {
	invocationId: string;
	name: string;
	input: string;
	context: RunContext;
	inputArtifact?: Artifact;
	outputArtifact?: string;
}) => Promise<PrimitiveAdapterOutput | undefined> | PrimitiveAdapterOutput | undefined;

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

export class WorkflowExecutor {
	private readonly workflows: ReadonlyMap<string, WorkflowDefinition>;
	private readonly adapters: ResolvedPrimitiveAdapters;

	public constructor(workflows: readonly WorkflowDefinition[], adapters: PrimitiveAdapters = {}) {
		this.workflows = new Map(workflows.map((workflow) => [workflow.id, workflow]));
		this.adapters = {
			ai: adapters.ai ?? deterministicAdapter,
			harness: adapters.harness ?? deterministicAdapter,
			gate: adapters.gate ?? deterministicAdapter,
		};
	}

	public async executeWorkflow(workflowId: string): Promise<WorkflowRun> {
		const workflow = this.workflows.get(workflowId);
		if (!workflow) throw new Error(`Workflow not found: ${workflowId}`);

		const context: RunContext = { artifacts: new Map() };
		const invocations: InvocationResult[] = [];
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

			const adapterOutput = await adapter({
				invocationId,
				name,
				input,
				context,
				inputArtifact,
				outputArtifact: options.outputArtifact,
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
				status: "Succeeded" as const,
				input,
				...(options.inputArtifact ? { consumedArtifact: options.inputArtifact } : {}),
				...(options.outputArtifact ? { producedArtifact: options.outputArtifact } : {}),
			};
			invocations.push(result);
			return result;
		};

		await workflow.controller({
			context,
			ai: (id, name, input, options) => invoke("AI", this.adapters.ai, id, name, input, options),
			harness: (id, name, input, options) => invoke("Harness", this.adapters.harness, id, name, input, options),
			gate: (id, name, input, options) => invoke("Gate", this.adapters.gate, id, name, input, options),
		});

		return { workflowId, status: "Succeeded", invocations, context };
	}
}
