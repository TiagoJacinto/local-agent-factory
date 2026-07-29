export type PrimitiveType = "AI" | "Harness" | "Gate";
export type InvocationStatus = "Succeeded" | "Failed";

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

export interface InvocationResult {
	readonly order: number;
	readonly invocationId: string;
	readonly name: string;
	readonly primitiveType: PrimitiveType;
	readonly resultType: `${PrimitiveType}InvocationResult`;
	readonly status: InvocationStatus;
	readonly input: string;
	readonly consumedArtifact?: string;
	readonly producedArtifact?: string;
}

export interface AIInvocationResult extends InvocationResult {
	readonly primitiveType: "AI";
	readonly resultType: "AIInvocationResult";
}

export interface HarnessInvocationResult extends InvocationResult {
	readonly primitiveType: "Harness";
	readonly resultType: "HarnessInvocationResult";
}

export interface GateInvocationResult extends InvocationResult {
	readonly primitiveType: "Gate";
	readonly resultType: "GateInvocationResult";
}

export interface WorkflowPrimitives {
	readonly context: RunContext;
	readonly ai: (
		invocationId: string,
		name: string,
		input: string,
		options?: PrimitiveCallOptions,
	) => Promise<AIInvocationResult>;
	readonly harness: (
		invocationId: string,
		name: string,
		input: string,
		options?: PrimitiveCallOptions,
	) => Promise<HarnessInvocationResult>;
	readonly gate: (
		invocationId: string,
		name: string,
		input: string,
		options?: PrimitiveCallOptions,
	) => Promise<GateInvocationResult>;
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
}) => Promise<PrimitiveAdapterOutput | void> | PrimitiveAdapterOutput | void;

export interface PrimitiveAdapters {
	readonly ai?: PrimitiveAdapter;
	readonly harness?: PrimitiveAdapter;
	readonly gate?: PrimitiveAdapter;
}

const deterministicAdapter: PrimitiveAdapter = () => undefined;

export class WorkflowExecutor {
	private readonly workflows: ReadonlyMap<string, WorkflowDefinition>;
	private readonly adapters: Required<PrimitiveAdapters>;

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
		): Promise<Extract<InvocationResult, { primitiveType: T }>> => {
			const inputArtifact = options.inputArtifact
				? context.artifacts.get(options.inputArtifact)
				: undefined;
			if (options.inputArtifact && !inputArtifact) {
				throw new Error(`Artifact not found: ${options.inputArtifact}`);
			}

			const adapterOutput = await adapter({ invocationId, name, input, context, inputArtifact, outputArtifact: options.outputArtifact });

			if (inputArtifact) inputArtifact.consumerInvocationId = invocationId;
			if (options.outputArtifact) {
				context.artifacts.set(options.outputArtifact, {
					id: options.outputArtifact,
					producerInvocationId: invocationId,
					value: adapterOutput && "value" in adapterOutput ? adapterOutput.value : input,
				});
			}

			const result = {
				order: invocations.length + 1,
				invocationId,
				name,
				primitiveType,
				resultType: `${primitiveType}InvocationResult` as `${T}InvocationResult`,
				status: "Succeeded" as const,
				input,
				...(options.inputArtifact ? { consumedArtifact: options.inputArtifact } : {}),
				...(options.outputArtifact ? { producedArtifact: options.outputArtifact } : {}),
			} as unknown as Extract<InvocationResult, { primitiveType: T }>;
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
