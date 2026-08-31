import type { IntegrationDecision, WorkflowRun } from "../../domain/workflow";
import type { WorkflowExecutor } from "../execute-workflow";

export function decideIntegration(
  executor: WorkflowExecutor,
  runIdentifier: string,
  decision: Omit<IntegrationDecision, "decidedAt">,
): WorkflowRun {
  return executor.decide(runIdentifier, decision);
}
