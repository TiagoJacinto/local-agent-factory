import type {
  CommandResult,
  WorkflowContext,
  WorkflowDefinition,
} from "../../../workflow-execution";
import { followPullRequest } from "../pull-request-follow-up";
import { parseStructureOutline } from "./outline-parser";
import type { OutlinePhase, StackPullRequest } from "./request";

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
  let parsed: {
    number: number;
    url: string;
    headRefName: string;
    baseRefName: string;
  };
  try {
    parsed = JSON.parse(metadata.stdout) as typeof parsed;
  } catch (error) {
    throw new Error(
      `gh pr view returned invalid JSON: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  return {
    phase: phase.number,
    number: parsed.number,
    url: parsed.url,
    headBranch: parsed.headRefName,
    baseBranch: parsed.baseRefName,
  };
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
          await followPullRequest(context, pullRequest, processedComments);
          await context.review();
          parentBranch = pullRequest.headBranch;
        },
      );
    }
  },
};
