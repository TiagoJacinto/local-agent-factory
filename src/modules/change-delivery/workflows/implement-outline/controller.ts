import type {
  CommandResult,
  WorkflowContext,
  WorkflowDefinition,
} from "../../../workflow-execution";
import { parseStructureOutline } from "./outline-parser";
import type { CommentDisposition, OutlinePhase, StackPullRequest } from "./request";

const MAX_VALIDATION_ATTEMPTS = 3;

function shell(command: string, cwd?: string) {
  return {
    command: "bash",
    args: ["-lc", command],
    ...(cwd ? { cwd } : {}),
    failurePolicy: "return-evidence" as const,
  };
}

function commandFailure(result: CommandResult): Error {
  return new Error(
    [
      `${result.command} ${result.args.join(" ")} exited ${result.exitCode ?? result.failure}`,
      result.stdout && `stdout:\n${result.stdout}`,
      result.stderr && `stderr:\n${result.stderr}`,
    ]
      .filter(Boolean)
      .join("\n"),
  );
}

async function runCommand(context: WorkflowContext, command: string): Promise<CommandResult> {
  const result = await context.command(shell(command, context.workspacePath));
  if (result.failure || result.exitCode !== 0) throw commandFailure(result);
  return result;
}

function slugFromPath(path: string): string {
  return (path.split("/").at(-1) ?? "outline")
    .replace(/\.[^.]+$/, "")
    .replace(/-structure-outline$/, "")
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

function outputValue(result: unknown): Record<string, unknown> | undefined {
  const value = (result as { output?: { value?: unknown } } | undefined)?.output?.value;
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function parseJson<T>(text: string, description: string): T {
  try {
    return JSON.parse(text) as T;
  } catch (error) {
    throw new Error(
      `${description} returned invalid JSON: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
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

async function validatePhase(
  context: WorkflowContext,
  phase: OutlinePhase,
  attempt: number,
): Promise<void> {
  await context.phase(
    {
      name: `phase_${phase.number}_verify_${attempt}`,
      kind: "code",
      owner: "quality",
      description: `Runs the declared validation commands for outline phase ${phase.number} before publication.`,
    },
    async () => {
      for (const command of phase.validationCommands) await runCommand(context, command);
    },
  );
}

async function capture(
  context: WorkflowContext,
  phase: OutlinePhase,
  position: "before" | "after",
): Promise<void> {
  const command = position === "before" ? phase.beforeCaptureCommand : phase.afterCaptureCommand;
  if (!phase.changesUi || !command) return;
  await runCommand(context, command);
  await runCommand(context, "npx skills add vercel-labs/before-and-after#main");
}

async function publishPhase(
  context: WorkflowContext,
  phase: OutlinePhase,
  slug: string,
  parentBranch: string,
): Promise<StackPullRequest> {
  const branch = `rpi/${slug}/phase-${phase.number}`;
  await runCommand(context, `git switch -c ${branch} ${parentBranch}`);
  await runCommand(
    context,
    `git add -A && git commit -m ${JSON.stringify(`rpi(${slug}): phase ${phase.number} ${phase.title}`)}`,
  );
  await runCommand(context, `git push -u origin ${branch}`);
  const title = `rpi(${slug}): phase ${phase.number} ${phase.title}`;
  const body = [
    `## Phase ${phase.number}: ${phase.title}`,
    "",
    phase.body,
    "",
    "### Verification",
    phase.validationCommands.length
      ? phase.validationCommands.map((command) => `- \`${command}\``).join("\n")
      : "- No validation commands were declared.",
  ].join("\n");
  await runCommand(
    context,
    `gh pr create --base ${parentBranch} --head ${branch} --title ${JSON.stringify(title)} --body ${JSON.stringify(body)}`,
  );
  const metadata = await runCommand(
    context,
    `gh pr view ${branch} --json number,url,headRefName,baseRefName`,
  );
  const parsed = parseJson<{
    number: number;
    url: string;
    headRefName: string;
    baseRefName: string;
  }>(metadata.stdout, "gh pr view");
  return {
    phase: phase.number,
    number: parsed.number,
    url: parsed.url,
    headBranch: parsed.headRefName,
    baseBranch: parsed.baseRefName,
  };
}

async function babysit(
  context: WorkflowContext,
  pullRequest: StackPullRequest,
  processed: Set<string>,
): Promise<void> {
  const result = await runCommand(
    context,
    `gh pr view ${pullRequest.number} --json comments,reviews`,
  );
  const payload = parseJson<{ comments?: Array<{ id: string; body: string }> }>(
    result.stdout,
    "gh pr view comments",
  );
  for (const comment of payload.comments ?? []) {
    if (processed.has(comment.id)) continue;
    processed.add(comment.id);
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
    }
  }
}

export const implementOutlineWorkflow: WorkflowDefinition = {
  id: "implement-outline",
  capability: "change-delivery",
  name: "Implement outline",
  changesSource: true,
  describe: () => ({
    name: "Implement outline",
    purpose:
      "Implements each outline phase, validates it, and publishes a reviewed stacked pull request.",
    changesSource: true,
  }),
  controller: async (context: WorkflowContext) => {
    const outlinePath = context.request?.trim();
    if (!outlinePath) throw new Error("outline path is required as the workflow request");
    const outlineResult = await runCommand(context, `cat ${JSON.stringify(outlinePath)}`);
    const phases = parseStructureOutline(outlineResult.stdout);
    const slug = slugFromPath(outlinePath);
    const branchResult = await runCommand(context, "git branch --show-current");
    let parentBranch = branchResult.stdout.trim();
    const processedComments = new Set<string>();

    for (const outlinePhase of phases) {
      await context.phase(
        {
          name: `phase_${outlinePhase.number}_implement`,
          kind: "agent",
          owner: "builder",
          description: `Implements only outline phase ${outlinePhase.number} before its stacked pull request is created.`,
        },
        async () => {
          await capture(context, outlinePhase, "before");
          await context.ai(
            `implement-outline-phase-${outlinePhase.number}`,
            `Implement outline phase ${outlinePhase.number}`,
            `Implement only Phase ${outlinePhase.number}: ${outlinePhase.title}\n\n${outlinePhase.body}`,
            {
              agentOwner: "builder",
              sessionPolicy: "fresh",
              outputArtifact: `phase-${outlinePhase.number}-implementation`,
            },
          );
        },
      );

      let verified = false;
      for (let attempt = 1; attempt <= MAX_VALIDATION_ATTEMPTS; attempt += 1) {
        try {
          await validatePhase(context, outlinePhase, attempt);
          verified = true;
          break;
        } catch (error) {
          if (attempt === MAX_VALIDATION_ATTEMPTS) throw error;
          await context.phase(
            {
              name: `phase_${outlinePhase.number}_repair_${attempt}`,
              kind: "agent",
              owner: "builder",
              description: `Repairs the exact validation failure from outline phase ${outlinePhase.number}.`,
            },
            async () => {
              await context.ai(
                `implement-outline-phase-${outlinePhase.number}-repair-${attempt}`,
                "Repair validation failure",
                `Repair this exact validation failure before retrying:\n${error instanceof Error ? error.message : String(error)}`,
                { agentOwner: "builder", sessionPolicy: "fresh" },
              );
            },
          );
        }
      }
      if (!verified) throw new Error(`phase ${outlinePhase.number} validation did not pass`);

      await context.phase(
        {
          name: `phase_${outlinePhase.number}_publish`,
          kind: "code",
          owner: "git",
          description: `Commits and publishes the verified outline phase as a pull request based on its predecessor.`,
        },
        async () => {
          await capture(context, outlinePhase, "after");
          const pullRequest = await publishPhase(context, outlinePhase, slug, parentBranch);
          await babysit(context, pullRequest, processedComments);
          await context.review();
          parentBranch = pullRequest.headBranch;
        },
      );
    }
  },
};
