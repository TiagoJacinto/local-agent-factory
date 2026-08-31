import type { WorkflowRun } from "../../domain/workflow";
import type { WorkflowExecutor } from "../execute-workflow";

export function inspectRun(
  executor: WorkflowExecutor,
  runIdentifier: string,
): WorkflowRun | undefined {
  return executor.inspect(runIdentifier);
}
