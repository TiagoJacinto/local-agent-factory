import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { expect, test } from "vitest";
import { compileWorkflowSkill } from "./project_skills";
import { compileSkill } from "./skill_compiler";

const canonicalSkill = `# Research

<!-- @if target=project -->
Find the questions artifact.
<!-- @endif -->

<!-- @if target=workflow -->
Read {{researchQuestionsArtifact}}.
<!-- @endif -->
`;

test("compiles project and workflow skill variants", () => {
  expect(compileSkill(canonicalSkill, { target: "project" })).toContain("Find the questions artifact.");
  expect(compileSkill(canonicalSkill, { target: "project" })).not.toContain("Read {{");
  expect(
    compileSkill(canonicalSkill, {
      target: "workflow",
      variables: { researchQuestionsArtifact: ".rpi/problems/auth/01-questions.md" },
    }),
  ).toContain("Read .rpi/problems/auth/01-questions.md.");
});

test("loads and compiles a workflow skill with runtime values", () => {
  const root = mkdtempSync(join(tmpdir(), "sssf-skill-"));
  try {
    const skill = join(root, "adws/adw_data/workflow_skills/rpi-create-research/SKILL.md");
    mkdirSync(dirname(skill), { recursive: true });
    writeFileSync(skill, canonicalSkill);

    expect(
      compileWorkflowSkill(
        "rpi-create-research",
        { researchQuestionsArtifact: ".rpi/problems/auth/01-questions.md" },
        root,
      ),
    ).toContain("Read .rpi/problems/auth/01-questions.md.");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
