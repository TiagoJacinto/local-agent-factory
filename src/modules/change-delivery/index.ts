import type { WorkflowDefinition, WorkflowContext } from "../workflow-execution";

function agentWorkflow(
  id: string,
  name: string,
  owner: string,
  description: string,
  changesSource = false,
): WorkflowDefinition {
  return {
    id,
    capability: "change-delivery",
    name,
    changesSource,
    describe: () => ({ name, purpose: description, changesSource }),
    controller: async (context: WorkflowContext) => {
      await context.phase(
        {
          name: "request",
          kind: "engineer",
          owner: "engineer",
          description: "Captures the operator request before work begins.",
        },
        async () => {
          if (context.request)
            await context.ai(`${id}-request`, `Capture ${name} request`, context.request);
        },
      );
      await context.phase({ name, kind: "agent", owner, description }, async () => {
        await context.ai(`${id}-agent`, name, context.request ?? name, {
          outputArtifact: `${id}-proposal`,
        });
      });
    },
  };
}

export const changeDeliveryWorkflows: readonly WorkflowDefinition[] = [
  agentWorkflow("prompt", "Prompt", "engineer", "Sends a bounded request to the selected agent."),
  agentWorkflow("scout", "Scout", "scout", "Maps the repository without changing source."),
  agentWorkflow("plan", "Plan", "planner", "Turns the request into an implementable change plan."),
  agentWorkflow(
    "prewalk",
    "Prewalk",
    "planner",
    "Plans before handing implementation to the builder.",
  ),
  agentWorkflow(
    "build",
    "Build",
    "builder",
    "Implements the requested change in a disposable workspace.",
    true,
  ),
  agentWorkflow(
    "quality",
    "Quality",
    "reviewer",
    "Runs deterministic validation and reports failures.",
    true,
  ),
  agentWorkflow(
    "build-review",
    "Build review",
    "reviewer",
    "Checks implementation claims against evidence.",
    true,
  ),
  agentWorkflow(
    "double-tdd",
    "Double TDD",
    "builder",
    "Coordinates acceptance and unit proof for a change.",
    true,
  ),
  agentWorkflow(
    "document",
    "Document",
    "documenter",
    "Updates documentation with verified repository facts.",
    true,
  ),
  agentWorkflow(
    "research",
    "Research",
    "researcher",
    "Collects scoped evidence for the requested question.",
  ),
  agentWorkflow(
    "prd-oriented-design",
    "PRD-oriented design",
    "planner",
    "Designs a product change from an approved request.",
  ),
  agentWorkflow(
    "prd-oriented-discovery",
    "PRD-oriented discovery",
    "researcher",
    "Discovers product constraints before design.",
  ),
];

export function getChangeDeliveryWorkflow(id: string): WorkflowDefinition {
  const workflow = changeDeliveryWorkflows.find((candidate) => candidate.id === id);
  if (!workflow) throw new Error(`Workflow not found: ${id}`);
  return workflow;
}
