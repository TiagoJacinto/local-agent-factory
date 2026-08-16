// @ts-nocheck
import { mkdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import * as agents from "./agents";
import * as permissions from "./permissions";
import * as quality from "./quality";
import { AgentCall, type DoubleTddStateName } from "./data_types";

const INITIAL = {
  STATE: "S0_SCOPE" as DoubleTddStateName,
  ACCEPTANCE_FULL_COMMAND: null,
  UNIT_FULL_COMMAND: null,
  FOCUSED_OUTER_COMMAND: null,
  FOCUSED_INNER_COMMAND: null,
  INVENTORY: [],
  SELECTED_EXAMPLE: null,
  OUTER_RED_PROOF: null,
  INNER_RESPONSIBILITY: null,
  INNER_TEST: null,
  INNER_RED_PROOF: null,
  LATEST_RESULTS: {},
};

const TEST_WRITES = [
  "features/",
  "feature/",
  "tests/",
  "test/",
  "specs/",
  "**/*.feature",
  "**/*.test.*",
  "**/*.spec.*",
];
const PLUMBING_WRITES = [
  ...TEST_WRITES,
  "package.json",
  "**/vitest.config.*",
  "**/playwright.config.*",
];
const TEST_PATH = /(^|\/)(features?|tests?|specs?)(\/|$)|\.(feature|test|spec)\.[^/]+$/i;
const PLUMBING_PATH = /(^|\/)(package\.json|.*vitest\.config\.[^/]+|.*playwright\.config\.[^/]+)$/i;

export function isTestPath(path: string) {
  return TEST_PATH.test(path);
}
function isPlumbingPath(path: string) {
  return isTestPath(path) || PLUMBING_PATH.test(path);
}

function statePath(run: any) {
  const dir = resolve(run.contextHandoffDir, "double_tdd");
  mkdirSync(dir, { recursive: true });
  return resolve(dir, "state.json");
}
function cloneInitial() {
  return { ...INITIAL, INVENTORY: [], LATEST_RESULTS: {} };
}
function loadState(run: any) {
  try {
    const saved = JSON.parse(readFileSync(statePath(run), "utf8"));
    return { ...cloneInitial(), ...saved };
  } catch {
    return cloneInitial();
  }
}
function saveState(run: any, state: any) {
  run.writeEvidence("double_tdd_state.json", state);
  Bun.write(statePath(run), JSON.stringify(state, null, 2));
}

function requireString(value: unknown, label: string) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} is required`);
  return value;
}
function requireCommand(value: unknown, label: string) {
  if (
    !Array.isArray(value) ||
    value.length === 0 ||
    value.some((part) => typeof part !== "string" || !part.trim())
  )
    throw new Error(`${label} must be a non-empty argv array`);
  return value;
}
function previous(state: any) {
  return { status: "success", summary: `Double-TDD state ${state.STATE}`, ...state };
}

export function assertOnlyPermittedPaths(
  run: any,
  before: Record<string, string>,
  permitted: (path: string) => boolean,
  label: string,
) {
  const changed = permissions.changedPaths(before, permissions.snapshot(run));
  const bad = changed.filter((path) => !permitted(path));
  if (bad.length) throw new Error(`${label} changed unauthorized paths: ${bad.join(", ")}`);
  return changed;
}
export function assertProductionOnly(run: any, before: Record<string, string>) {
  return assertOnlyPermittedPaths(run, before, (path) => !isPlumbingPath(path), "S6_INNER_GREEN");
}

async function callAgent(
  run: any,
  phaseName: string,
  instruction: string,
  state: any,
  allowedWrites: string[] | undefined,
  permitted: ((path: string) => boolean) | undefined,
) {
  const before = permissions.snapshot(run);
  let output: any;
  await run.phase(
    {
      name: phaseName,
      kind: "agent",
      owner: "double_tdd",
      retries: 1,
      description: instruction,
      allowed_writes: allowedWrites,
    },
    async (ph) => {
      output = await ph.call(new AgentCall("DoubleTddOutput", instruction, previous(state)));
    },
  );
  if (permitted) assertOnlyPermittedPaths(run, before, permitted, phaseName);
  return output;
}

async function runCommand(run: any, state: any, phaseName: string, argv: string[]) {
  let result: any;
  await run.phase(
    {
      name: phaseName,
      kind: "code",
      owner: "quality",
      description: `Run ${phaseName} and record its evidence before the next state transition`,
    },
    async (ph) => {
      result = await quality.runCommand(run, phaseName, argv);
      state.LATEST_RESULTS[phaseName] = result;
      saveState(run, state);
      ph.log({
        passed: result.passed,
        command: result.checks[0]?.command,
        artifacts: result.artifacts,
      });
    },
  );
  return result;
}

async function classifyFailure(run: any, state: any, phaseName: string, failure: any) {
  state.LATEST_RESULTS[`${phaseName}_failure`] = failure;
  const output = await callAgent(
    run,
    `${phaseName}_classify`,
    "Classify the latest test failure as plumbing or missing_behavior. Use the command output and the intended observation, not production code guesses. Do not edit files.",
    state,
    [],
    () => false,
  );
  if (!["plumbing", "missing_behavior"].includes(output.failure_kind))
    throw new Error(`${phaseName} classification must set failure_kind`);
  return output;
}
async function repairPlumbing(run: any, state: any, phaseName: string, failure: any) {
  state.LATEST_RESULTS[`${phaseName}_failure`] = failure;
  return callAgent(
    run,
    `${phaseName}_repair_plumbing`,
    "Repair only the test plumbing, fixtures, bindings, configuration, or environment issue shown by the latest failure. Do not change production behavior. Return the same DoubleTddOutput JSON.",
    state,
    PLUMBING_WRITES,
    isPlumbingPath,
  );
}

export function validateOutputForState(state: DoubleTddStateName, output: any) {
  if (!output || output.status !== "success") throw new Error(`${state} requires a success output`);
  if (state === "S0_SCOPE") {
    requireCommand(output.acceptance_full_command, "acceptance_full_command");
    requireCommand(output.unit_full_command, "unit_full_command");
    requireCommand(output.focused_outer_command, "focused_outer_command");
    requireCommand(output.focused_inner_command, "focused_inner_command");
    if (!Array.isArray(output.inventory)) throw new Error("inventory is required");
  }
  if (state === "S1_SELECT_OUTER") {
    requireString(output.selected_example, "selected_example");
    requireString(output.criterion, "criterion");
    requireString(output.oracle, "oracle");
    if (output.acceptance_gap === true && !Array.isArray(output.artifacts))
      throw new Error("an acceptance gap must name its written artifact");
  }
  if (state === "S2_WRITE_OUTER") {
    requireString(output.high_value_test, "high_value_test");
    requireCommand(output.focused_outer_command, "focused_outer_command");
  }
  if (state === "S4_SELECT_INNER")
    requireString(output.inner_responsibility, "inner_responsibility");
  if (state === "S5_INNER_RED") {
    requireString(output.inner_test, "inner_test");
    requireCommand(output.focused_inner_command, "focused_inner_command");
  }
  if (state === "S10_COVERAGE" && typeof output.handled !== "boolean")
    throw new Error("handled is required");
  return output;
}

export async function run(x: any) {
  const cfg = agents.loadConfig(x.config);
  agents.validate(cfg, ["double_tdd"]);
  const { ensure } = await import("./session");
  const run = ensure(cfg, x.adwId);
  let state = loadState(run);
  let transitions = 0;
  await run.phase(
    {
      name: "request",
      kind: "engineer",
      owner: run.engineer,
      description: "Capture the double-TDD request and its acceptance target",
    },
    (ph) => ph.log({ input: x.prompt }),
  );

  while (state.STATE !== "DONE") {
    if (++transitions > 100) return run.finish(false, "double-TDD exceeded 100 state transitions");
    saveState(run, state);
    if (state.STATE === "S0_SCOPE") {
      const scoped = validateOutputForState(
        state.STATE,
        await callAgent(
          run,
          `s0_scope_${transitions}`,
          "Apply custom-testing. Read the request, domain definitions, context maps, ADRs, acceptance specs, nearby tests, and runner configuration. Identify exact full and focused argv commands for both runners, inventory every concrete acceptance example, map criteria to examples or explicit gaps, and report baseline requirements. Do not edit repository files.",
          state,
          [],
          () => false,
        ),
      );
      Object.assign(state, scoped, {
        ACCEPTANCE_FULL_COMMAND: scoped.acceptance_full_command,
        UNIT_FULL_COMMAND: scoped.unit_full_command,
        FOCUSED_OUTER_COMMAND: scoped.focused_outer_command,
        FOCUSED_INNER_COMMAND: scoped.focused_inner_command,
        INVENTORY: scoped.inventory,
        STATE: "S0_SCOPE",
      });
      state.LATEST_RESULTS.baseline_acceptance = await runCommand(
        run,
        state,
        `baseline_acceptance_${transitions}`,
        state.ACCEPTANCE_FULL_COMMAND,
      );
      state.LATEST_RESULTS.baseline_unit = await runCommand(
        run,
        state,
        `baseline_unit_${transitions}`,
        state.UNIT_FULL_COMMAND,
      );
      state.STATE = "S1_SELECT_OUTER";
      continue;
    }
    if (state.STATE === "S1_SELECT_OUTER") {
      const selected = validateOutputForState(
        state.STATE,
        await callAgent(
          run,
          `s1_select_outer_${transitions}`,
          "Select exactly one existing unhandled acceptance example. If all existing examples are handled, define one necessary example for the next uncovered success, failure, or meaningful edge case. Apply custom-gherkin and derive every expected outcome from an independent oracle. If you add an example, change only that acceptance artifact.",
          state,
          TEST_WRITES,
          isTestPath,
        ),
      );
      Object.assign(state, selected, { SELECTED_EXAMPLE: selected.selected_example });
      state.STATE = "S2_WRITE_OUTER";
      continue;
    }
    if (state.STATE === "S2_WRITE_OUTER") {
      const written = validateOutputForState(
        state.STATE,
        await callAgent(
          run,
          `s2_write_outer_${transitions}`,
          "Write exactly one discoverable high-value unit test for SELECTED_EXAMPLE. Invoke the application-level public API, bind every example value faithfully, choose result, state, or communication verification, and do not change production code or unrelated tests.",
          state,
          TEST_WRITES,
          isTestPath,
        ),
      );
      Object.assign(state, written, {
        FOCUSED_OUTER_COMMAND: written.focused_outer_command,
        STATE: "S3_FOCUSED_OUTER",
      });
      continue;
    }
    if (state.STATE === "S3_FOCUSED_OUTER") {
      const result = await runCommand(
        run,
        state,
        `s3_focused_outer_${transitions}`,
        requireCommand(state.FOCUSED_OUTER_COMMAND, "focused_outer_command"),
      );
      state.LATEST_RESULTS.focused_outer = result;
      if (result.passed) {
        state.OUTER_RED_PROOF = null;
        state.STATE = "S9_FULL_ACCEPTANCE";
        continue;
      }
      state.OUTER_RED_PROOF = result.failures;
      const diagnosis = await classifyFailure(run, state, `s3_${transitions}`, result);
      if (diagnosis.failure_kind === "plumbing") {
        await repairPlumbing(run, state, `s3_${transitions}`, result);
        continue;
      }
      state.STATE = "S4_SELECT_INNER";
      continue;
    }
    if (state.STATE === "S4_SELECT_INNER") {
      const selected = validateOutputForState(
        state.STATE,
        await callAgent(
          run,
          `s4_select_inner_${transitions}`,
          "From the current outer failure, choose the smallest missing Level 1 or Level 2 responsibility and name its public API. Keep application-level decisions and coordination in the Controller. Do not edit repository files.",
          state,
          [],
          () => false,
        ),
      );
      Object.assign(state, selected, { INNER_RESPONSIBILITY: selected.inner_responsibility });
      state.STATE = "S5_INNER_RED";
      continue;
    }
    if (state.STATE === "S5_INNER_RED") {
      const written = validateOutputForState(
        state.STATE,
        await callAgent(
          run,
          `s5_inner_red_${transitions}`,
          "Write exactly one typical Level 1 or Level 2 unit test for INNER_RESPONSIBILITY. Use result verification for Level 1 or state verification for Level 2. Do not change production code. Return the focused unit command.",
          state,
          TEST_WRITES,
          isTestPath,
        ),
      );
      Object.assign(state, written, {
        INNER_TEST: written.inner_test,
        FOCUSED_INNER_COMMAND: written.focused_inner_command,
      });
      const result = await runCommand(
        run,
        state,
        `s5_focused_inner_${transitions}`,
        state.FOCUSED_INNER_COMMAND,
      );
      state.LATEST_RESULTS.focused_inner = result;
      if (result.passed) {
        state.INNER_RESPONSIBILITY = null;
        state.INNER_TEST = null;
        state.INNER_RED_PROOF = null;
        state.STATE = "S4_SELECT_INNER";
        continue;
      }
      const diagnosis = await classifyFailure(run, state, `s5_${transitions}`, result);
      if (diagnosis.failure_kind === "plumbing") {
        await repairPlumbing(run, state, `s5_${transitions}`, result);
        continue;
      }
      state.INNER_RED_PROOF = result.failures;
      state.STATE = "S6_INNER_GREEN";
      continue;
    }
    if (state.STATE === "S6_INNER_GREEN") {
      const before = permissions.snapshot(run);
      await callAgent(
        run,
        `s6_inner_green_${transitions}`,
        "Implement the smallest behavior that satisfies INNER_TEST. Connect it through the use case Controller. Change production behavior only; do not edit tests, acceptance examples, or configuration.",
        state,
        undefined,
        undefined,
      );
      assertProductionOnly(run, before);
      const result = await runCommand(
        run,
        state,
        `s6_focused_inner_${transitions}`,
        requireCommand(state.FOCUSED_INNER_COMMAND, "focused_inner_command"),
      );
      state.LATEST_RESULTS.focused_inner = result;
      if (result.passed) state.STATE = "S7_UNIT_SUITE";
      continue;
    }
    if (state.STATE === "S7_UNIT_SUITE") {
      const result = await runCommand(
        run,
        state,
        `s7_unit_suite_${transitions}`,
        requireCommand(state.UNIT_FULL_COMMAND, "unit_full_command"),
      );
      state.LATEST_RESULTS.full_unit = result;
      if (result.passed) {
        state.INNER_RESPONSIBILITY = null;
        state.INNER_TEST = null;
        state.INNER_RED_PROOF = null;
        state.STATE = "S3_FOCUSED_OUTER";
      } else state.STATE = "S6_INNER_GREEN";
      continue;
    }
    if (state.STATE === "S9_FULL_ACCEPTANCE") {
      const result = await runCommand(
        run,
        state,
        `s9_full_acceptance_${transitions}`,
        requireCommand(state.ACCEPTANCE_FULL_COMMAND, "acceptance_full_command"),
      );
      state.LATEST_RESULTS.full_acceptance = result;
      if (result.passed) {
        state.STATE = "S10_COVERAGE";
        continue;
      }
      const diagnosis = await classifyFailure(run, state, `s9_${transitions}`, result);
      if (diagnosis.failure_kind === "plumbing") {
        await repairPlumbing(run, state, `s9_${transitions}`, result);
        continue;
      }
      state.OUTER_RED_PROOF = result.failures;
      if (diagnosis.selected_example) state.SELECTED_EXAMPLE = diagnosis.selected_example;
      state.STATE = "S4_SELECT_INNER";
      continue;
    }
    if (state.STATE === "S10_COVERAGE") {
      const checked = validateOutputForState(
        state.STATE,
        await callAgent(
          run,
          `s10_coverage_${transitions}`,
          "Reconcile the inventory against every requested success, failure, meaningful edge case, relied-upon Level 1 or Level 2 responsibility, Controller design, domain definition, and latest full-suite evidence. Do not rerun either suite. Return handled=true only when every completion condition is proven. Do not edit repository files.",
          state,
          [],
          () => false,
        ),
      );
      Object.assign(state, checked);
      state.STATE = checked.handled ? "DONE" : "S1_SELECT_OUTER";
      continue;
    }
    return run.finish(false, `unknown double-TDD state: ${state.STATE}`);
  }
  saveState(run, state);
  return run.finish(true);
}
