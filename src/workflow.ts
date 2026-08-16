import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

export type PrimitiveType = "AI" | "Harness" | "Gate";
export type InvocationStatus = "Succeeded" | "Failed";
export type PrimitiveResultType<T extends PrimitiveType> = `${T}InvocationResult`;
export type WorkflowFailure = "DirtySource" | "UnexpectedSourceRevision" | "SourceChanged";
export type WorkspaceIsolation = "IndependentClone";
export type SourceIntegrity = "Verified" | "Changed";
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

export type Agent = (prompt: string) => Promise<unknown> | unknown;
export type AgentFix = (error: Error, attempt: number) => Promise<void> | void;

export interface ExecuteWithAgentFixOptions<T> {
  /** Maximum number of times to execute the operation, including the first attempt. */
  readonly maxAttempts?: number;
  /** Treat a returned value as a failure when it does not throw. */
  readonly isFailure?: (result: T) => boolean;
  /** Convert a returned failure into the error sent to the agent. */
  readonly formatFailure?: (result: T) => string;
  /** The default agent used when no custom repair callback is supplied. */
  readonly agent?: Agent;
}

/**
 * Execute an operation and ask the agent to repair each failure before retrying.
 *
 * A custom repair callback is optional. When it is omitted, `options.agent` receives
 * a standard repair prompt. The latest execution error is thrown when all attempts
 * are exhausted.
 */
export async function executeWithAgentFix<T>(
  execute: () => Promise<T> | T,
  agentFixOrOptions?: AgentFix | ExecuteWithAgentFixOptions<T>,
  options: ExecuteWithAgentFixOptions<T> = {},
): Promise<T> {
  const agentFix = typeof agentFixOrOptions === "function" ? agentFixOrOptions : undefined;
  const resolvedOptions =
    typeof agentFixOrOptions === "function" ? options : (agentFixOrOptions ?? options);
  const repair = agentFix
    ? agentFix
    : async (error: Error, attempt: number) => {
        if (!resolvedOptions.agent) {
          throw new Error("No agent configured for the default repair path");
        }
        await resolvedOptions.agent(`Fix attempt ${attempt}: ${error.message}`);
      };

  const maxAttempts = resolvedOptions.maxAttempts ?? 3;
  if (!Number.isInteger(maxAttempts) || maxAttempts < 1) {
    throw new Error("maxAttempts must be a positive integer");
  }

  let lastError: Error | undefined;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    lastError = undefined;
    let result!: T;
    try {
      result = await execute();
    } catch (error) {
      lastError = asError(error);
    }

    if (!lastError) {
      if (!resolvedOptions.isFailure || !resolvedOptions.isFailure(result)) return result;
      lastError = new Error(resolvedOptions.formatFailure?.(result) ?? "operation failed");
    }

    if (attempt === maxAttempts) throw lastError;
    await repair(lastError, attempt);
  }

  throw new Error("execution repair loop failed");
}

function asError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
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

  public async executeWorkflow(
    workflowId: string,
    options: WorkflowExecutionOptions = {},
  ): Promise<WorkflowRun> {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) throw new Error(`Workflow not found: ${workflowId}`);

    const context: RunContext = { artifacts: new Map() };
    const source = options.sourceRepository ? inspectSource(options.sourceRepository) : undefined;
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
        ...(options.inputArtifact ? { consumedArtifact: options.inputArtifact } : {}),
        ...(options.outputArtifact ? { producedArtifact: options.outputArtifact } : {}),
        ...(workspacePath ? { workspacePath } : {}),
      };
      invocations.push(result);
      return result;
    };

    await workflow.controller({
      context,
      ai: (id, name, input, options) => invoke("AI", this.adapters.ai, id, name, input, options),
      harness: (id, name, input, options) =>
        invoke("Harness", this.adapters.harness, id, name, input, options),
      gate: (id, name, input, options) =>
        invoke("Gate", this.adapters.gate, id, name, input, options),
    });

    if (source) {
      const finalSource = inspectSource(source.path);
      if (finalSource.revision !== source.revision || finalSource.workingTree !== "Clean") {
        return {
          workflowId,
          status: "Failed",
          invocations,
          context,
          runIdentifier,
          sourceRevision: finalSource.revision,
          workspacePath,
          workspaceIsolation: "IndependentClone",
          sourceIntegrity: "Changed",
          failure: "SourceChanged",
          workspaceDisposition: "Retained",
        };
      }
    }

    let status: WorkflowRun["status"] = "Succeeded";
    if (invocations.some((invocation) => invocation.status === "Failed")) {
      status = "Failed";
    }
    const workspaceDisposition = status === "Failed" ? ("Retained" as const) : undefined;
    return {
      workflowId,
      status,
      invocations,
      context,
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

function throwMissingRunIdentifier(): never {
  throw new Error("Source execution requires a run identifier");
}

function safeGitEnv() {
  const env: Record<string, string> = {};
  for (const key of [
    "HOME",
    "LANG",
    "LC_ALL",
    "LC_CTYPE",
    "PATH",
    "TEMP",
    "TERM",
    "TMP",
    "TMPDIR",
    "USER",
  ]) {
    const value = process.env[key];
    if (value !== undefined) env[key] = value;
  }
  return env;
}

function inspectSource(path: string): {
  path: string;
  revision: string;
  workingTree: "Clean" | "Dirty";
} {
  const revision = execFileSync("git", ["-C", path, "rev-parse", "HEAD"], {
    encoding: "utf8",
    timeout: 30_000,
    env: safeGitEnv(),
  }).trim();
  const workingTree = execFileSync("git", ["-C", path, "status", "--porcelain"], {
    encoding: "utf8",
    timeout: 30_000,
    env: safeGitEnv(),
  }).trim()
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
  execFileSync("git", ["clone", "--quiet", "--no-hardlinks", sourcePath, workspacePath], {
    timeout: 30_000,
    env: safeGitEnv(),
  });
  return workspacePath;
}
