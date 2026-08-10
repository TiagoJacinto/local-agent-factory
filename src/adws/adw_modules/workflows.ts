// @ts-nocheck
import * as agents from "./agents";
import * as gates from "./gates";
import * as quality from "./quality";
import * as git from "./git_helper";
import * as changes from "./changes";
import * as session from "./session";
import { AgentCall } from "./data_types";
const req = (run: any, prompt: string) =>
  run.phase(
    {
      name: "request",
      kind: "engineer",
      owner: run.engineer,
      description: "Capture the incoming ask",
    },
    async (ph) => ph.log({ input: prompt }),
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
    (ph) => ph.call(new AgentCall("GenericOutput", x.prompt)),
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
    (ph) => ph.call(new AgentCall("ScoutOutput", x.prompt, undefined, [gates.artifactsExist])),
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
    (ph) =>
      ph.call(
        new AgentCall("PlanOutput", x.prompt, undefined, [
          gates.artifactsExist,
          gates.filesNonEmpty,
        ]),
      ),
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
    (ph) => ph.call(new AgentCall("BuildOutput", x.prompt, undefined, [gates.diffMatchesClaims])),
  );
  return run.awaitReview();
}
export async function planBuild(x: any) {
  const run = setup(x.config, x.adwId, ["planner", "builder"]);
  await req(run, x.prompt);
  let plan: any;
  await run.phase(
    {
      name: "plan",
      kind: "agent",
      owner: "planner",
      description: "Turn the request into an implementable plan",
    },
    async (ph) =>
      (plan = await ph.call(
        new AgentCall("PlanOutput", x.prompt, undefined, [
          gates.artifactsExist,
          gates.filesNonEmpty,
        ]),
      )),
  );
  let build: any;
  await run.phase(
    {
      name: "build",
      kind: "agent",
      owner: "builder",
      description: "Implement the plan exactly",
    },
    async (ph) =>
      (build = await ph.call(
        new AgentCall("BuildOutput", x.prompt, plan, [gates.diffMatchesClaims]),
      )),
  );
  await run.phase(
    {
      name: "commit",
      kind: "code",
      owner: "git",
      description: "Land the builder's changes, using the message it wrote",
    },
    (ph) =>
      ph.log({
        sha: git.commitAll(
          build.commit_message || `sssf(${run.adwId}): ${build.summary || "build"}`,
          run.repoRoot,
        ),
      }),
  );
  return run.awaitReview();
}
async function testLoop(run: any, prompt: string, previous: any) {
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
      async (ph) => {
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
      async (ph) =>
        (previous = await ph.call(
          new AgentCall("BuildOutput", prompt, quality.asEnvelope(test, "tests"), [
            gates.diffMatchesClaims,
          ]),
        )),
    );
  }
  return { test, previous };
}
export async function buildTest(x: any) {
  const run = setup(x.config, x.adwId, ["builder"]);
  await req(run, x.prompt);
  let b: any;
  await run.phase(
    {
      name: "build",
      kind: "agent",
      owner: "builder",
      description: "Implement the request",
    },
    async (ph) =>
      (b = await ph.call(
        new AgentCall("BuildOutput", x.prompt, undefined, [gates.diffMatchesClaims]),
      )),
  );
  const r = await testLoop(run, x.prompt, b);
  if (r.test.passed)
    await run.phase(
      {
        name: "commit",
        kind: "code",
        owner: "git",
        description: "Land the code only after the suite came back green",
      },
      (ph) =>
        ph.log({
          sha: git.commitAll(
            r.previous.commit_message || `sssf(${run.adwId}): ${r.previous.summary || "build"}`,
            run.repoRoot,
          ),
        }),
    );
  return r.test.passed
    ? run.awaitReview()
    : run.finish(false, `the suite still failed after 3 fix attempt(s)`);
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
    async (ph) =>
      (prev = await ph.call(
        new AgentCall("BuildOutput", x.prompt, undefined, [gates.diffMatchesClaims]),
      )),
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
      async (ph) =>
        (review = await ph.call(
          new AgentCall("ReviewOutput", x.prompt, prev, [
            gates.artifactsExist,
            gates.verdictConsistent,
          ]),
        )),
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
      async (ph) =>
        (prev = await ph.call(
          new AgentCall("BuildOutput", x.prompt, review, [gates.diffMatchesClaims]),
        )),
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
    (ph) =>
      ph.call(
        new AgentCall(
          "DocumentOutput",
          x.prompt,
          changes.asEnvelope(c, "Read diff_path in full before writing."),
          [gates.artifactsExist, gates.filesNonEmpty],
        ),
      ),
  );
  return run.awaitReview();
}
export async function planBuildTest(x: any) {
  const run = setup(x.config, x.adwId, ["planner", "builder"]);
  await req(run, x.prompt);
  let p: any, b: any;
  await run.phase(
    {
      name: "plan",
      kind: "agent",
      owner: "planner",
      description: "Turn the request into an implementable plan",
    },
    async (ph) =>
      (p = await ph.call(
        new AgentCall("PlanOutput", x.prompt, undefined, [
          gates.artifactsExist,
          gates.filesNonEmpty,
        ]),
      )),
  );
  await run.phase(
    {
      name: "build",
      kind: "agent",
      owner: "builder",
      description: "Implement the plan exactly",
    },
    async (ph) =>
      (b = await ph.call(new AgentCall("BuildOutput", x.prompt, p, [gates.diffMatchesClaims]))),
  );
  const r = await testLoop(run, x.prompt, b);
  if (r.test.passed)
    await run.phase(
      {
        name: "commit",
        kind: "code",
        owner: "git",
        description: "Land the code only after the suite came back green",
      },
      (ph) =>
        ph.log({
          sha: git.commitAll(
            r.previous.commit_message || `sssf(${run.adwId}): ${r.previous.summary || "build"}`,
            run.repoRoot,
          ),
        }),
    );
  return r.test.passed
    ? run.awaitReview()
    : run.finish(false, "the suite still failed after 3 fix attempt(s)");
}
export async function planBuildTestQuality(x: any) {
  const run = setup(x.config, x.adwId, ["planner", "builder"]);
  await req(run, x.prompt);
  let p: any, b: any;
  await run.phase(
    {
      name: "plan",
      kind: "agent",
      owner: "planner",
      description: "Turn the request into an implementable plan",
    },
    async (ph) =>
      (p = await ph.call(
        new AgentCall("PlanOutput", x.prompt, undefined, [
          gates.artifactsExist,
          gates.filesNonEmpty,
        ]),
      )),
  );
  await run.phase(
    {
      name: "build",
      kind: "agent",
      owner: "builder",
      description: "Implement the plan exactly",
    },
    async (ph) =>
      (b = await ph.call(new AgentCall("BuildOutput", x.prompt, p, [gates.diffMatchesClaims]))),
  );
  let q: any;
  for (let i = 1; i <= 3; i++) {
    await run.phase(
      {
        name: `verify_${i}`,
        kind: "code",
        owner: "quality",
        description: "Lint, typecheck, and build before testing",
      },
      async (ph) => {
        q = await quality.runQuality(run);
        ph.log({
          passed: q.passed,
          checks: `${q.checks.filter((c: any) => c.passed).length}/${q.checks.length}`,
          artifacts: q.artifacts.join(", "),
        });
      },
    );
    if (q.passed) break;
    await run.phase(
      {
        name: `fix_${i}`,
        kind: "agent",
        owner: "builder",
        retries: 1,
        description: "Resolve the reported verification failures",
      },
      async (ph) =>
        (b = await ph.call(
          new AgentCall("BuildOutput", x.prompt, quality.asEnvelope(q, "verification"), [
            gates.diffMatchesClaims,
          ]),
        )),
    );
  }
  if (q?.passed)
    await run.phase(
      {
        name: "commit",
        kind: "code",
        owner: "git",
        description: "Commit the tested and quality-verified working tree",
      },
      (ph) =>
        ph.log({
          sha: git.commitAll(
            b.commit_message || `sssf(${run.adwId}): ${b.summary || "build"}`,
            run.repoRoot,
          ),
        }),
    );
  return q?.passed
    ? run.awaitReview()
    : run.finish(false, "verify/test never came back clean after 3 fix attempt(s)");
}
export async function simpleSdlc(x: any) {
  const run = setup(x.config, x.adwId, ["planner", "builder", "reviewer", "documenter"]);
  const baseline = git.rev("HEAD", run.repoRoot);
  await req(run, x.prompt);
  let plan: any, build: any;
  await run.phase(
    {
      name: "plan",
      kind: "agent",
      owner: "planner",
      description: "Turn the request into an implementable plan",
    },
    async (ph) =>
      (plan = await ph.call(
        new AgentCall("PlanOutput", x.prompt, undefined, [
          gates.artifactsExist,
          gates.filesNonEmpty,
        ]),
      )),
  );
  await run.phase(
    {
      name: "commit_plan",
      kind: "code",
      owner: "git",
      description: "Put the spec on record before any code exists to blur it",
    },
    (ph) =>
      ph.log({
        sha: git.commitAll(
          plan.commit_message || `sssf(${run.adwId}): ${plan.summary || "plan"}`,
          run.repoRoot,
        ),
      }),
  );
  await run.phase(
    {
      name: "build",
      kind: "agent",
      owner: "builder",
      description: "Implement the plan exactly",
    },
    async (ph) =>
      (build = await ph.call(
        new AgentCall("BuildOutput", x.prompt, plan, [gates.diffMatchesClaims]),
      )),
  );
  const tested = await testLoop(run, x.prompt, build);
  build = tested.previous;
  let review: any;
  for (let i = 1; i <= 2; i++) {
    await run.phase(
      {
        name: `review_${i}`,
        kind: "agent",
        owner: "reviewer",
        description: "Confirm the build matches the plan",
      },
      async (ph) =>
        (review = await ph.call(
          new AgentCall("ReviewOutput", x.prompt, build, [
            gates.artifactsExist,
            gates.verdictConsistent,
          ]),
        )),
    );
    if (review.approved || i === 2) break;
    await run.phase(
      {
        name: `revise_${i}`,
        kind: "agent",
        owner: "builder",
        retries: 1,
        description: "Close the reviewer's blocking findings",
      },
      async (ph) =>
        (build = await ph.call(
          new AgentCall("BuildOutput", x.prompt, review, [gates.diffMatchesClaims]),
        )),
    );
  }
  let verified = !!tested.test?.passed && !!review?.approved;
  if (verified) {
    await run.phase(
      {
        name: "commit_build",
        kind: "code",
        owner: "git",
        description: "Land the code only after a green suite and approved review",
      },
      (ph) =>
        ph.log({
          sha: git.commitAll(
            build.commit_message || `sssf(${run.adwId}): ${build.summary || "build"}`,
            run.repoRoot,
          ),
        }),
    );
    let c: any;
    await run.phase(
      {
        name: "changes",
        kind: "code",
        owner: "git",
        description: "Capture the complete run change for documentation",
      },
      (ph) => {
        c = changes.capture(run, { base: baseline });
        ph.log({
          diff: c.diffPath,
          files: c.files.length + c.untracked.length,
        });
      },
    );
    let doc: any;
    await run.phase(
      {
        name: "document",
        kind: "agent",
        owner: "documenter",
        description: "Write up the completed change",
      },
      async (ph) =>
        (doc = await ph.call(
          new AgentCall(
            "DocumentOutput",
            x.prompt,
            changes.asEnvelope(c, "Read diff_path in full before writing."),
            [gates.artifactsExist, gates.filesNonEmpty],
          ),
        )),
    );
    await run.phase(
      {
        name: "commit_docs",
        kind: "code",
        owner: "git",
        description: "Ship the write-up beside the code it describes",
      },
      (ph) =>
        ph.log({
          sha: git.commitAll(
            doc.commit_message || `sssf(${run.adwId}): ${doc.summary || "docs"}`,
            run.repoRoot,
          ),
        }),
    );
  }
  return verified
    ? run.awaitReview()
    : run.finish(false, "the suite or review never came back clean");
}
