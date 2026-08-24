import { compileWorkflowSkill } from "./project_skills";
import * as agents from "./agents";
import * as gates from "./gates";
import * as quality from "./quality";
import * as changes from "./changes";
import * as session from "./session";
import { AgentCall, EnvelopeBase } from "./data_types";
import { PhaseHandle } from "./runner";

interface WorkflowInput {
  config: string;
  adwId?: string;
  prompt: string;
  agent?: string;
  base?: string;
}
const req = (run: any, prompt: string) =>
  run.phase(
    {
      name: "request",
      kind: "engineer",
      owner: run.engineer,
      description: "Capture the incoming ask",
    },
    async (ph: PhaseHandle) => {
      ph.log({ input: prompt });
    },
  );
function setup(config: string, id: string | undefined, names: string[]) {
  const cfg = agents.loadConfig(config);
  agents.validate(cfg, names);
  return session.ensure(cfg, id);
}

export async function prompt(x: any) {
  const run = setup(x.config, x.adwId, [x.agent]);
  await req(run, x.prompt);
  await run.phase(
    {
      name: "prompt",
      kind: "agent",
      owner: x.agent,
      description: `Send the request straight to ${x.agent} and parse its envelope`,
    },
    async (ph: PhaseHandle) => {
      await ph.call(new AgentCall("GenericOutput", x.prompt));
    },
  );
  return run.finish();
}
export async function scout(x: any) {
  const run = setup(x.config, x.adwId, ["scout"]);
  await req(run, x.prompt);
  await run.phase(
    {
      name: "scout",
      kind: "agent",
      owner: "scout",
      description: "Find and report where things live — change nothing",
    },
    async (ph: PhaseHandle) => {
      await ph.call(new AgentCall("ScoutOutput", x.prompt, undefined, [gates.artifactsExist]));
    },
  );
  return run.finish();
}
export async function plan(x: any) {
  const run = setup(x.config, x.adwId, ["planner"]);
  await req(run, x.prompt);
  await run.phase(
    {
      name: "plan",
      kind: "agent",
      owner: "planner",
      description: "Turn the request into an implementable plan",
    },
    async (ph: PhaseHandle) => {
      await ph.call(
        new AgentCall("PlanOutput", x.prompt, undefined, [
          gates.artifactsExist,
          gates.filesNonEmpty,
        ]),
      );
    },
  );
  return run.finish();
}
export async function build(x: any) {
  const run = setup(x.config, x.adwId, ["builder"]);
  await req(run, x.prompt);
  await run.phase(
    {
      name: "build",
      kind: "agent",
      owner: "builder",
      retries: 1,
      description: "Implement the request",
    },
    async (ph: PhaseHandle) => {
      await ph.call(new AgentCall("BuildOutput", x.prompt, undefined, [gates.diffMatchesClaims]));
    },
  );
  return run.awaitReview();
}
export async function testLoop(run: any, prompt: string, previous: any) {
  let test: any;
  for (let i = 1; i <= 3; i++) {
    await run.phase(
      {
        name: `test_${i}`,
        kind: "code",
        owner: "quality",
        description:
          "Run the suite — a known command, so code runs it and no agent has to rediscover it",
      },
      async (ph: PhaseHandle) => {
        test = await quality.runTests(run);
        ph.log({
          passed: test.passed,
          checks: `${test.checks.filter((c: any) => c.passed).length}/${test.checks.length}`,
          artifacts: test.artifacts.join(", "),
        });
      },
    );
    if (test.passed) break;
    await run.phase(
      {
        name: `fix_${i}`,
        kind: "agent",
        owner: "builder",
        retries: 1,
        description: "Repair what the suite reported, from its verbatim output",
      },
      async (ph: PhaseHandle) => {
        previous = await ph.call(
          new AgentCall("BuildOutput", prompt, quality.asEnvelope(test, "tests"), [
            gates.diffMatchesClaims,
          ]),
        );
      },
    );
  }
  return { test, previous };
}
export async function buildReview(x: any) {
  const run = setup(x.config, x.adwId, ["builder", "reviewer"]);
  await req(run, x.prompt);
  let prev: any;
  await run.phase(
    {
      name: "build",
      kind: "agent",
      owner: "builder",
      description: "Implement the request",
    },
    async (ph: PhaseHandle) => {
      prev = await ph.call(
        new AgentCall("BuildOutput", x.prompt, undefined, [gates.diffMatchesClaims]),
      );
    },
  );
  let review: any;
  for (let i = 1; i <= 3; i++) {
    await run.phase(
      {
        name: `review_${i}`,
        kind: "agent",
        owner: "reviewer",
        description: "Rule on every requirement in the spec, against the code on disk",
      },
      async (ph: PhaseHandle) => {
        review = await ph.call(
          new AgentCall("ReviewOutput", x.prompt, prev, [
            gates.artifactsExist,
            gates.verdictConsistent,
          ]),
        );
      },
    );
    if (review.approved || i === 3) break;
    await run.phase(
      {
        name: `revise_${i}`,
        kind: "agent",
        owner: "builder",
        retries: 1,
        description: "Close every blocking finding the reviewer named",
      },
      async (ph: PhaseHandle) => {
        prev = await ph.call(
          new AgentCall("BuildOutput", x.prompt, review, [gates.diffMatchesClaims]),
        );
      },
    );
  }
  return review?.approved
    ? run.awaitReview()
    : run.finish(false, `the reviewer never approved after 3 revision(s)`);
}
export async function qualityRun(x: any) {
  const run = setup(x.config, x.adwId, []);
  await req(run, x.prompt);
  await run.phase(
    {
      name: "quality",
      kind: "code",
      owner: "quality",
      description: "Run the deterministic quality blocks",
    },
    async (ph) => {
      const r = await quality.runQuality(run);
      ph.log({
        passed: r.passed,
        checks: `${r.checks.filter((c) => c.passed).length}/${r.checks.length}`,
        artifacts: r.artifacts.join(", "),
      });
      if (!r.passed) throw new Error(`quality failed: ${r.failures.join("; ")}`);
    },
  );
  return run.finish();
}
export async function document(x: any) {
  const run = setup(x.config, x.adwId, ["documenter"]);
  await req(run, x.prompt);
  let c: any;
  await run.phase(
    {
      name: "changes",
      kind: "code",
      owner: "git",
      description: `Diff the working tree against ${x.base} — the change to be written up`,
    },
    (ph) => {
      c = changes.capture(run, { base: x.base });
      ph.log({ files: c.files.length + c.untracked.length, diff: c.diffPath });
      if (!c.files.length && !c.untracked.length) throw new Error("nothing changed to document");
    },
  );
  await run.phase(
    {
      name: "document",
      kind: "agent",
      owner: "documenter",
      retries: 1,
      description: "Turn the captured diff into a write-up an engineer can read",
    },
    async (ph: PhaseHandle) => {
      await ph.call(
        new AgentCall(
          "DocumentOutput",
          x.prompt,
          changes.asEnvelope(c, "Read diff_path in full before writing."),
          [gates.artifactsExist, gates.filesNonEmpty],
        ),
      );
    },
  );
  return run.awaitReview();
}

export async function research(x: WorkflowInput) {
  const run = setup(x.config, x.adwId, ["research_questions", "research"]);
  const researchQuestionsSkill = compileWorkflowSkill(
    "rpi-create-research-questions",
    {},
    run.repoRoot,
  );
  await req(run, x.prompt);
  let questions: EnvelopeBase | undefined;
  await run.phase(
    {
      name: "research_questions",
      kind: "agent",
      owner: "research_questions",
      description: "Turn the request into evidence-backed questions that scope the research",
    },
    async (ph: PhaseHandle) => {
      questions = await ph.call(
        new AgentCall(
          "GenericOutput",
          x.prompt,
          undefined,
          [gates.artifactsExist],
          researchQuestionsSkill,
        ),
      );
    },
  );

  const researchQuestionsArtifact = questions?.artifacts?.[0];
  if (!researchQuestionsArtifact) throw new Error("research questions agent did not declare an artifact");
  const researchSkill = compileWorkflowSkill(
    "rpi-create-research",
    { researchQuestionsArtifact },
    run.repoRoot,
  );

  await run.phase(
    {
      name: "research",
      kind: "agent",
      owner: "research",
      description: "Answer the generated questions with a read-only codebase research document",
    },
    async (ph: PhaseHandle) => {
      await ph.call(
        new AgentCall(
          "GenericOutput",
          x.prompt,
          questions,
          [gates.artifactsExist],
          researchSkill,
        ),
      );
    },
  );
  return run.finish();
}

export async function prdOrientedDesign(x: WorkflowInput) {
  const run = setup(x.config, x.adwId, ["prd", "tdd"]);
  const prdSkill = compileWorkflowSkill("rpi-create-prd", {}, run.repoRoot);
  await req(run, x.prompt);

  let prd: EnvelopeBase | undefined;
  await run.phase(
    {
      name: "prd",
      kind: "agent",
      owner: "prd",
      description: "Turn the request into a product requirements document before technical design",
    },
    async (ph: PhaseHandle) => {
      prd = await ph.call(
        new AgentCall("GenericOutput", x.prompt, undefined, [gates.artifactsExist], prdSkill),
      );
    },
  );

  const tddSkill = compileWorkflowSkill("rpi-create-tdd", {}, run.repoRoot);
  await run.phase(
    {
      name: "tdd",
      kind: "agent",
      owner: "tdd",
      description: "Turn the product requirements into a technical design document",
    },
    async (ph: PhaseHandle) => {
      await ph.call(
        new AgentCall("GenericOutput", x.prompt, prd, [gates.artifactsExist], tddSkill),
      );
    },
  );
  return run.finish();
}
