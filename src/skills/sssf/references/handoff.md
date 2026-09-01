# Workflow handoffs

An AI primitive receives the request plus an optional prior artifact. Controllers declare the handoff with `inputArtifact` and `outputArtifact` names:

```ts
await context.ai("plan", "Create a plan", context.request ?? "", {
  outputArtifact: "plan",
  agentOwner: "planner",
});
await context.gate("plan-required", "Requires a non-empty plan artifact.", "plan", {
  inputArtifact: "plan",
});
```

The Factory records producer invocation, consumer invocation, artifact value, and evidence-manifest entries. Agent results use a generic envelope with `status: "success" | "fail"`; malformed responses are corrected in the same configured session. Human review is represented by `context.review()` and persisted as an integration decision.
