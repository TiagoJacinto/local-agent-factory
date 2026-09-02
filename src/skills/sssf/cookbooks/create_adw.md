# Create a workflow

Create a workflow module under `src/modules/change-delivery/workflows/<id>/` (or use the installed factory script for a local generated definition). Keep the workflow definition local and typed:

```ts
import type { WorkflowDefinition } from "../../workflow-execution";

export const reviewWorkflow: WorkflowDefinition = {
  id: "review",
  capability: "change-delivery",
  controller: async (context) => {
    await context.phase(
      {
        name: "request",
        kind: "engineer",
        owner: "engineer",
        description: "Records the operator request before review.",
      },
      () => undefined,
    );
    await context.phase(
      {
        name: "review",
        kind: "agent",
        owner: "reviewer",
        description: "Checks the requested change and records review evidence.",
      },
      async () => {
        await context.ai("review-agent", context.request ?? "", context.request ?? "", {
          outputArtifact: "review",
          agentOwner: "reviewer",
        });
        await context.gate(
          "review-artifact",
          "Rejects a missing or empty review artifact.",
          context.request ?? "",
          { inputArtifact: "review" },
        );
      },
    );
    await context.review();
  },
};
```

Use `WorkflowContext.phase`, `ai`, `gate`, `command`, and `review`. Agent owners select configured providers; controllers never invoke providers directly. Register the definition in the change-delivery registry and colocate request/result types, README, and characterization tests.

The installed `run.ts` is the canonical `runWorkflowCli` entrypoint; workflow definitions are distributed under `factory/modules/change-delivery/workflows/`. Source-changing workflows receive clean Git admission, revision verification, and a disposable workspace. Runs persist an evidence manifest and SQLite trace.
