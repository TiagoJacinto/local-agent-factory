import { z } from "zod";
export type DoubleTddStateName =
  | "S0_SCOPE"
  | "S1_SELECT_OUTER"
  | "S2_WRITE_OUTER"
  | "S3_FOCUSED_OUTER"
  | "S4_SELECT_INNER"
  | "S5_INNER_RED"
  | "S6_INNER_GREEN"
  | "S7_UNIT_SUITE"
  | "S9_FULL_ACCEPTANCE"
  | "S10_COVERAGE"
  | "DONE";
export interface DoubleTddInventoryEntry {
  example: string;
  criterion: string;
  high_value_test?: string;
  status: "handled" | "unhandled" | "gap";
}
export interface DoubleTddState {
  STATE: DoubleTddStateName;
  ACCEPTANCE_FULL_COMMAND: string[] | null;
  UNIT_FULL_COMMAND: string[] | null;
  FOCUSED_OUTER_COMMAND: string[] | null;
  FOCUSED_INNER_COMMAND: string[] | null;
  INVENTORY: DoubleTddInventoryEntry[];
  SELECTED_EXAMPLE: string | null;
  OUTER_RED_PROOF: unknown;
  INNER_RESPONSIBILITY: string | null;
  INNER_TEST: string | null;
  INNER_RED_PROOF: unknown;
  LATEST_RESULTS: Record<string, unknown>;
}
export interface DoubleTddOutput {
  status: "success";
  state?: DoubleTddStateName;
  acceptance_full_command?: string[];
  unit_full_command?: string[];
  focused_outer_command?: string[];
  focused_inner_command?: string[];
  inventory?: DoubleTddInventoryEntry[];
  selected_example?: string;
  criterion?: string;
  oracle?: string;
  high_value_test?: string;
  inner_responsibility?: string;
  inner_test?: string;
  red_proof?: string;
  failure_kind?: "plumbing" | "missing_behavior";
  handled?: boolean;
  acceptance_gap?: boolean;
  [key: string]: unknown;
}

const argvSchema = z.array(z.string().trim().min(1)).min(1);
const inventoryEntrySchema = z.object({
  path: z.string().trim().min(1),
  kind: z.string().trim().min(1),
});
const stateNameSchema = z.enum([
  "S0_SCOPE",
  "S1_SELECT_OUTER",
  "S2_WRITE_OUTER",
  "S3_FOCUSED_OUTER",
  "S4_SELECT_INNER",
  "S5_INNER_RED",
  "S6_INNER_GREEN",
  "S7_UNIT_SUITE",
  "S9_FULL_ACCEPTANCE",
  "S10_COVERAGE",
]);
const outputSchema = z.object({ status: z.literal("success") }).passthrough();

/** Classifies paths that represent tests or acceptance specifications. */
export function isTestPath(path: string): boolean {
  return /(^|\/)(features?|tests?)(\/|\.)/.test(path) || /\.(test|spec)\.[^/]+$/.test(path);
}

/** Validates the state-machine envelope required before each transition. */
export function validateOutputForState(
  state: DoubleTddStateName,
  output: unknown,
): DoubleTddOutput {
  const validState = stateNameSchema.parse(state);
  const parsed = outputSchema.parse(output) as DoubleTddOutput & Record<string, unknown>;
  const required = (field: string, schema: z.ZodType) => {
    const value = parsed[field];
    if (value === undefined) throw new Error(`${field} is required`);
    schema.parse(value);
  };
  if (validState === "S0_SCOPE") {
    for (const field of [
      "acceptance_full_command",
      "unit_full_command",
      "focused_outer_command",
      "focused_inner_command",
    ])
      required(field, argvSchema);
    required("inventory", z.array(inventoryEntrySchema));
  }
  if (validState === "S1_SELECT_OUTER") {
    for (const field of ["selected_example", "criterion", "oracle"])
      required(field, z.string().trim().min(1));
    if (parsed.acceptance_gap === true) required("artifacts", z.array(z.string()).min(1));
  }
  if (validState === "S2_WRITE_OUTER") {
    required("high_value_test", z.string().trim().min(1));
    required("focused_outer_command", argvSchema);
  }
  if (validState === "S4_SELECT_INNER") required("inner_responsibility", z.string().trim().min(1));
  if (validState === "S5_INNER_RED") {
    required("inner_test", z.string().trim().min(1));
    required("focused_inner_command", argvSchema);
  }
  if (validState === "S10_COVERAGE") required("handled", z.boolean());
  return parsed;
}
