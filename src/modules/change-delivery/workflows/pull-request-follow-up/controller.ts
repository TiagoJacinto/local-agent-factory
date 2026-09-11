import type { WorkflowContext } from "../../../workflow-execution";
import type { CommentDisposition, PullRequestReference } from "./request";

function shell(command: string, cwd?: string) {
  return {
    command: "bash",
    args: ["-lc", command],
    ...(cwd ? { cwd } : {}),
    failurePolicy: "return-evidence" as const,
  };
}

function outputValue(result: unknown): Record<string, unknown> | undefined {
  const value = (result as { output?: { value?: unknown } } | undefined)?.output?.value;
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function disposition(value: unknown, commentId: string): CommentDisposition {
  if (!value || typeof value !== "object")
    return {
      commentId,
      action: "no_change",
      rationale: "The feedback agent returned no actionable disposition.",
      changedFiles: [],
      reply: "Reviewed; no change is required.",
    };
  const candidate = value as Partial<CommentDisposition>;
  const action = candidate.action;
  return {
    commentId,
    action: action === "fix" || action === "reply_only" ? action : "no_change",
    rationale: candidate.rationale ?? "Reviewed against the current pull request diff.",
    changedFiles: candidate.changedFiles ?? [],
    reply: candidate.reply ?? "Reviewed; no change is required.",
  };
}

async function runCommand(context: WorkflowContext, command: string): Promise<void> {
  const result = await context.command(shell(command, context.workspacePath));
  if (result.failure || result.exitCode !== 0)
    throw new Error(
      `${result.command} ${result.args.join(" ")} exited ${result.exitCode ?? result.failure}`,
    );
}

/** Watches required checks and processes newly reported feedback for one pull request. */
export async function followPullRequest(
  context: WorkflowContext,
  pullRequest: PullRequestReference,
  processedComments: Set<string>,
): Promise<void> {
  await runCommand(context, `gh pr checks ${pullRequest.number} --required --watch --interval 10`);
  const commentsResult = await context.command(
    shell(`gh pr view ${pullRequest.number} --json comments,reviews`, context.workspacePath),
  );
  if (commentsResult.failure || commentsResult.exitCode !== 0)
    throw new Error(
      `${commentsResult.command} ${commentsResult.args.join(" ")} exited ${commentsResult.exitCode ?? commentsResult.failure}`,
    );
  let payload: { comments?: Array<{ id: string; body: string }> };
  try {
    payload = JSON.parse(commentsResult.stdout) as {
      comments?: Array<{ id: string; body: string }>;
    };
  } catch (error) {
    throw new Error(
      `gh pr view returned invalid JSON: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  for (const comment of payload.comments ?? []) {
    if (processedComments.has(comment.id)) continue;
    processedComments.add(comment.id);
    const inspection = await context.ai(
      `pr-comment-${comment.id}`,
      "Inspect pull request feedback",
      `Pull request #${pullRequest.number} received comment ${comment.id}:\n${comment.body}\nReturn a JSON disposition with action, rationale, changedFiles, and reply.`,
      { agentOwner: "reviewer", sessionPolicy: "fresh", outputArtifact: `comment-${comment.id}` },
    );
    const result = disposition(outputValue(inspection), comment.id);
    await runCommand(
      context,
      `gh pr comment ${pullRequest.number} --body ${JSON.stringify(result.reply)}`,
    );
    if (result.action === "fix") {
      await context.ai(
        `pr-comment-fix-${comment.id}`,
        "Apply pull request feedback",
        `Apply the requested correction for comment ${comment.id}: ${comment.body}`,
        { agentOwner: "builder", sessionPolicy: "fresh" },
      );
      await runCommand(context, "git add -A && git commit -m 'fix: address pull request feedback'");
      await runCommand(context, "git push");
      await runCommand(
        context,
        `gh pr checks ${pullRequest.number} --required --watch --interval 10`,
      );
    }
  }
}
