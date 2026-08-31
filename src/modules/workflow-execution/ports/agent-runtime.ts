import type { PrimitiveInvocationArguments } from "../domain/workflow";

export interface AgentRuntimePort {
  invoke(
    input: PrimitiveInvocationArguments & {
      readonly workspacePath?: string;
      readonly signal: AbortSignal;
    },
  ): unknown | Promise<unknown>;
}
