import type {
  CommandResult,
  InvocationResult,
  WorkflowContext,
  WorkflowDefinition,
} from "../../../workflow-execution";
import { isTestPath } from "../../double-tdd-state";
import { followPullRequest } from "../pull-request-follow-up";
import type { ImplementationPullRequest, TestSeam, TddSeamProposal, TddSlice } from "./request";

const MAX_TDD_CYCLES = 20;

function shell(command: string, cwd?: string) {
  return {
    command: "bash",
    args: ["-lc", command],
    ...(cwd ? { cwd } : {}),
    failurePolicy: "return-evidence" as const,
  };
}

async function observeCommand(context: WorkflowContext, command: string): Promise<CommandResult> {
  return context.command(shell(command, context.workspacePath));
}

async function runCommand(context: WorkflowContext, command: string): Promise<string> {
  const result = await observeCommand(context, command);
  if (result.failure || result.exitCode !== 0)
    throw new Error(
      `${result.command} ${result.args.join(" ")} exited ${result.exitCode ?? result.failure}`,
    );
  return result.stdout;
}

function valueOf(invocation: InvocationResult): Record<string, unknown> {
  const value = (invocation.output as { value?: unknown } | undefined)?.value;
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error(`${invocation.invocationId} must return an object value`);
  return value as Record<string, unknown>;
}

function requireString(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${field} must be a string`);
  return value;
}

function parseSeamProposal(invocation: InvocationResult): TddSeamProposal {
  const value = valueOf(invocation);
  if (value.status !== "success") throw new Error('seam proposal status must be "success"');
  if (!Array.isArray(value.behaviors) || value.behaviors.length === 0)
    throw new Error("seam proposal must contain required behaviors");
  if (value.behaviors.length > MAX_TDD_CYCLES)
    throw new Error(`TDD cycle limit exceeded: ${value.behaviors.length}/${MAX_TDD_CYCLES}`);
  return {
    status: "success",
    baselineCommand: requireString(value.baselineCommand, "baselineCommand"),
    behaviors: value.behaviors.map((candidate, index) => {
      if (!candidate || typeof candidate !== "object" || Array.isArray(candidate))
        throw new Error(`behavior ${index + 1} must be an object`);
      const behavior = candidate as Record<string, unknown>;
      return {
        id: requireString(behavior.id, `behavior ${index + 1} id`),
        description: requireString(behavior.description, `behavior ${index + 1} description`),
      };
    }),
  };
}

function parseSlice(invocation: InvocationResult, expectedBehavior: string): TddSlice {
  const value = valueOf(invocation);
  if (value.status !== "slice") throw new Error('TDD red phase status must be "slice"');
  const behavior = requireString(value.behavior, "behavior");
  if (behavior !== expectedBehavior)
    throw new Error(
      `TDD slice changed behavior: expected ${expectedBehavior}, received ${behavior}`,
    );
  if (!Array.isArray(value.changedFiles) || value.changedFiles.length === 0)
    throw new Error("TDD red phase must report at least one changed test file");
  const changedFiles = value.changedFiles.map((path, index) =>
    requireString(path, `changedFiles[${index}]`),
  );
  if (changedFiles.some((path) => !isTestPath(path)))
    throw new Error("TDD red phase may change only test or feature files");
  return {
    status: "slice",
    behavior,
    testCommand: requireString(value.testCommand, "testCommand"),
    activeSuiteCommand: requireString(value.activeSuiteCommand, "activeSuiteCommand"),
    expectedFailure: requireString(value.expectedFailure, "expectedFailure"),
    changedFiles,
    additionalSeams: readAdditionalSeams(value.additionalSeams),
  };
}

function requireExpectedRed(result: CommandResult, expectedFailure: string): void {
  if (result.failure) throw new Error(`RED command could not run: ${result.failure}`);
  if (result.exitCode === 0) throw new Error("RED command unexpectedly passed");
  if (!`${result.stdout}\n${result.stderr}`.includes(expectedFailure))
    throw new Error(`RED command did not fail for the expected reason: ${expectedFailure}`);
}

function requireOnlyTestsChanged(status: string): void {
  const changed = status
    .split("\n")
    .map((line) => line.slice(3).trim())
    .filter(Boolean);
  const paths = changed;
  if (!paths.length) throw new Error("RED phase did not record a changed test file");
  if (paths.some((path) => !isTestPath(path)))
    throw new Error("RED phase changed production files before GREEN");
}

function readAdditionalSeams(value: unknown): TestSeam[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new Error("additionalSeams must be an array");
  return value.map((candidate, index) => {
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate))
      throw new Error(`additionalSeams[${index}] must be an object`);
    const seam = candidate as Record<string, unknown>;
    if (!Array.isArray(seam.testPaths) || seam.testPaths.some((path) => typeof path !== "string"))
      throw new Error(`additionalSeams[${index}].testPaths must be an array of paths`);
    return {
      module: requireString(seam.module, `additionalSeams[${index}].module`),
      publicInterface: requireString(
        seam.publicInterface,
        `additionalSeams[${index}].publicInterface`,
      ),
      rationale: requireString(seam.rationale, `additionalSeams[${index}].rationale`),
      testPaths: seam.testPaths as string[],
    };
  });
}

function slugFromPath(path: string): string {
  return (path.split("/").at(-1) ?? "implementation")
    .replace(/\.[^.]+$/, "")
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

function parsePullRequest(text: string): ImplementationPullRequest {
  try {
    return JSON.parse(text) as ImplementationPullRequest;
  } catch (error) {
    throw new Error(
      `gh pr view returned invalid JSON: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/** Implements a specification with ordinary TDD and publishes one reviewed pull request. */
export const implementWorkflow: WorkflowDefinition = {
  id: "implement",
  capability: "change-delivery",
  name: "Implement with TDD",
  changesSource: true,
  describe: () => ({
    name: "Implement with TDD",
    purpose:
      "Implements a specification through focused red-green cycles and a reviewed pull request.",
    changesSource: true,
  }),
  controller: async (context: WorkflowContext) => {
    const specificationPath = context.request?.trim();
    if (!specificationPath)
      throw new Error("specification path is required as the workflow request");
    const slug = slugFromPath(specificationPath);
    const branch = `implement/${slug}`;
    const processedComments = new Set<string>();
    let startingRevision = "";
    let seamProposal: TddSeamProposal | undefined;
    const additionalSeams: TestSeam[] = [];

    await context.phase(
      {
        name: "request",
        kind: "engineer",
        owner: "engineer",
        description: "Captures the specification before the isolated TDD implementation begins.",
      },
      () => undefined,
    );
    await context.phase(
      {
        name: "branch",
        kind: "code",
        owner: "git",
        description:
          "Creates the feature branch in the disposable worktree before agent implementation.",
      },
      async () => {
        await runCommand(context, `git switch -c ${JSON.stringify(branch)}`);
        startingRevision = (await runCommand(context, "git rev-parse HEAD")).trim();
      },
    );
    await context.phase(
      {
        name: "seams",
        kind: "agent",
        owner: "builder",
        description:
          "Identifies behavioral public interfaces and focused test seams without changing files.",
      },
      async () => {
        const invocation = await context.ai(
          "implement-seams",
          "Identify test seams",
          `Read and understand ${specificationPath}. Inspect the relevant repository code, but do not change files. Return JSON with status "success", baselineCommand, behaviors as ordered {id, description} entries, and the public test seams.`,
          { agentOwner: "builder", outputArtifact: "implement-seams" },
        );
        seamProposal = parseSeamProposal(invocation);
      },
    );
    await context.phase(
      {
        name: "baseline",
        kind: "code",
        owner: "quality",
        description: "Requires the approved-seam test suite to be green before the first change.",
      },
      async () => {
        await runCommand(context, seamProposal!.baselineCommand);
      },
    );
    if (!seamProposal) throw new Error("seam proposal was not produced");
    const proposal = seamProposal;
    for (const [index, requiredBehavior] of proposal.behaviors.entries()) {
      const cycle = index + 1;
      let slice: TddSlice | undefined;
      let redResult: CommandResult | undefined;
      await context.phase(
        {
          name: `red_${cycle}`,
          kind: "agent",
          owner: "builder",
          description: `Writes one behavioral test for TDD cycle ${cycle} and proves its expected failure.`,
        },
        async () => {
          const invocation = await context.ai(
            `implement-red-${cycle}`,
            `Write failing test ${cycle}`,
            `For required behavior ${JSON.stringify(requiredBehavior.description)}, write exactly one behavioral test through an approved public seam. Change no production files. Return JSON with status "slice", behavior, testCommand, activeSuiteCommand, expectedFailure, changedFiles, and additionalSeams.`,
            {
              agentOwner: "builder",
              inputArtifact: "implement-seams",
              outputArtifact: `red-${cycle}`,
            },
          );
          slice = parseSlice(invocation, requiredBehavior.description);
          additionalSeams.push(...slice.additionalSeams);
          const status = await runCommand(context, "git status --porcelain");
          requireOnlyTestsChanged(status);
          redResult = await observeCommand(context, slice.testCommand);
          requireExpectedRed(redResult, slice.expectedFailure);
        },
      );
      await context.phase(
        {
          name: `green_${cycle}`,
          kind: "agent",
          owner: "builder",
          description: `Implements only the behavior proven red in TDD cycle ${cycle} and requires the active suite to pass.`,
        },
        async () => {
          await context.ai(
            `implement-green-${cycle}`,
            `Make test ${cycle} pass`,
            `Implement only enough production behavior to make this test pass: ${slice!.behavior}. The RED command was ${slice!.testCommand} and failed as expected:\n${redResult!.stdout}\n${redResult!.stderr}\nDo not add another behavior or refactor.`,
            {
              agentOwner: "builder",
              inputArtifact: `red-${cycle}`,
              outputArtifact: "implement-tdd",
            },
          );
          await runCommand(context, slice!.testCommand);
          await runCommand(context, slice!.activeSuiteCommand);
          await runCommand(
            context,
            `git add -A && git commit -m ${JSON.stringify(`tdd(${requiredBehavior.id}): ${requiredBehavior.description}`)}`,
          );
        },
      );
    }
    await context.phase(
      {
        name: "review_checkpoint",
        kind: "code",
        owner: "git",
        description: "Commits the completed red-green implementation as the fixed review point.",
      },
      async () => {
        const status = await runCommand(context, "git status --porcelain");
        if (status.trim()) throw new Error("review checkpoint must have a clean worktree");
      },
    );
    await context.phase(
      {
        name: "review",
        kind: "agent",
        owner: "reviewer",
        description:
          "Reviews the committed diff against the specification and repository standards on two independent axes.",
      },
      async () => {
        await Promise.all([
          context.ai(
            "implement-spec-review",
            "Review implementation against specification",
            `Review git diff ${startingRevision}...HEAD for the implementation of ${specificationPath} against the specification. Report missing or partial requirements, incorrect behavior, and scope creep. Do not change files.`,
            {
              agentOwner: "reviewer",
              inputArtifact: "implement-tdd",
              outputArtifact: "implement-spec-review",
            },
          ),
          context.ai(
            "implement-standards-review",
            "Review implementation against standards",
            `Review git diff ${startingRevision}...HEAD against repository standards and the Fowler smell baseline. Report concrete standards violations and refactoring findings. Do not change files.`,
            {
              agentOwner: "reviewer",
              inputArtifact: "implement-tdd",
              outputArtifact: "implement-standards-review",
            },
          ),
        ]);
      },
    );
    await context.phase(
      {
        name: "validation",
        kind: "code",
        owner: "quality",
        description: "Runs the fast repository test suite after review and before publication.",
      },
      async () => {
        await runCommand(context, "bun test");
      },
    );
    await context.phase(
      {
        name: "publish",
        kind: "code",
        owner: "git",
        description: "Pushes the reviewed and validated implementation as a pull request.",
      },
      async () => {
        const seamSection = additionalSeams.length
          ? additionalSeams
              .map(
                (seam) =>
                  `- ${seam.module} — ${seam.publicInterface}: ${seam.rationale} (tests: ${seam.testPaths.join(", ")})`,
              )
              .join("\n")
          : "- None introduced beyond the initially proposed seams.";
        const body = [
          `Implements ${specificationPath} through ordinary TDD.`,
          "",
          "## Additional test seams",
          seamSection,
        ].join("\n");
        await runCommand(context, `git push -u origin ${JSON.stringify(branch)}`);
        await runCommand(
          context,
          `gh pr create --head ${JSON.stringify(branch)} --title ${JSON.stringify(`Implement ${slug}`)} --body ${JSON.stringify(body)}`,
        );
      },
    );
    const metadata = parsePullRequest(
      await runCommand(
        context,
        `gh pr view ${JSON.stringify(branch)} --json number,url,headRefName,baseRefName`,
      ),
    );
    await context.phase(
      {
        name: "follow_up",
        kind: "code",
        owner: "github",
        description:
          "Watches GitHub Actions and pull request feedback until integration review is ready.",
      },
      async () => {
        await followPullRequest(context, metadata, processedComments);
      },
    );
    await context.phase(
      {
        name: "integration_review",
        kind: "gate",
        owner: "human",
        description:
          "Waits for an explicit human integration decision without merging the pull request.",
      },
      async () => {
        await context.review();
      },
    );
  },
};
