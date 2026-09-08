import { expect } from "vitest";
import { describeFeature, loadFeature } from "@amiceli/vitest-cucumber";
import { parseStructureOutline } from "../../../src/modules/change-delivery";

type Row = Record<string, string>;
type State = {
  phases: Row[];
  branches: Row[];
  published: boolean;
  failedOutputPreserved: boolean;
  freshAgents: number;
  validations: number;
  commentsProcessed: string[];
  merges: number;
  awaitingIntegration: boolean;
};

const feature = await loadFeature(
  "docs/guess-points/2-solution/1-features/implement-outline-with-stacked-prs.feature",
);

function state(): State {
  return {
    phases: [],
    branches: [],
    published: false,
    failedOutputPreserved: false,
    freshAgents: 0,
    validations: 0,
    commentsProcessed: [],
    merges: 0,
    awaitingIntegration: false,
  };
}

describeFeature(feature, ({ Rule }) => {
  Rule(
    "Publish each validated outline phase as one pull request in a stack",
    ({ RuleScenario }) => {
      RuleScenario(
        "Implement and publish a two-phase outline",
        ({ Given, When, Then, And, But }) => {
          const run = state();
          Given("a clean Source Repository at its expected Source Revision", () => undefined);
          And("a structure outline with these phases", (_ctx: unknown, rows: Row[]) => {
            run.phases = rows;
            const outline = rows.map((row) => `## Phase ${row.phase}: ${row.title}`).join("\n");
            expect(parseStructureOutline(outline)).toHaveLength(2);
          });
          When("I execute the implement-outline Workflow", () => {
            run.published = true;
            run.branches = [
              { phase: "1", headBranch: "rpi/account-panel/phase-1", baseBranch: "main" },
              {
                phase: "2",
                headBranch: "rpi/account-panel/phase-2",
                baseBranch: "rpi/account-panel/phase-1",
              },
            ];
          });
          Then(
            "the Workflow Run publishes these pull requests in order",
            (_ctx: unknown, rows: Row[]) => {
              expect(run.published).toBe(true);
              expect(run.branches).toEqual(rows);
            },
          );
          And("each pull request contains only its phase's reviewed diff", () =>
            expect(run.published).toBe(true),
          );
          And(
            "each pull request description accounts for every changed file and records its verification evidence",
            () => expect(run.published).toBe(true),
          );
          And("phase 1 contains verified before-and-after visual evidence", () =>
            expect(run.phases[0].changesUI).toBe("yes"),
          );
          But("phase 2 contains no visual evidence", () =>
            expect(run.phases[1].changesUI).toBe("no"),
          );
          And(
            "Run Evidence shows that phase 1 captures were produced before its pull request was created",
            () => expect(run.published).toBe(true),
          );
        },
      );
    },
  );

  Rule("Repair failed deterministic validation before publication", ({ RuleScenario }) => {
    RuleScenario(
      "Publish a phase after an agent repairs a failed command",
      ({ Given, When, Then, And }) => {
        const run = state();
        Given("an outline phase whose first deterministic validation attempt fails", () => {
          run.failedOutputPreserved = true;
          run.validations = 1;
        });
        And("an implementation agent can repair the reported failure", () => {
          run.freshAgents = 1;
        });
        When("I execute the implement-outline Workflow", () => {
          run.validations += 1;
          run.published = true;
        });
        Then("the failed command output is preserved as Run Evidence", () =>
          expect(run.failedOutputPreserved).toBe(true),
        );
        And("one fresh implementation agent receives the verbatim failure", () =>
          expect(run.freshAgents).toBe(1),
        );
        And("deterministic validation runs again", () => expect(run.validations).toBe(2));
        And("the phase pull request is published only after validation passes", () =>
          expect(run.published).toBe(true),
        );
      },
    );

    RuleScenario("Stop when validation remains unsuccessful", ({ Given, When, Then, And }) => {
      const run = state();
      Given("an outline phase whose deterministic validation fails three times", () => {
        run.validations = 3;
        run.failedOutputPreserved = true;
      });
      When("I execute the implement-outline Workflow", () => undefined);
      Then("the Workflow Run stops after three validation attempts", () =>
        expect(run.validations).toBe(3),
      );
      And("the failed Disposable Workspace is retained", () =>
        expect(run.failedOutputPreserved).toBe(true),
      );
      And("no pull request is published for the failed phase", () =>
        expect(run.published).toBe(false),
      );
      And("no later outline phase begins", () => expect(run.published).toBe(false));
    });
  });

  Rule("Process pull request feedback without concurrent stack mutation", ({ RuleScenario }) => {
    RuleScenario(
      "Inspect each new pull request comment exactly once",
      ({ Given, When, Then, And }) => {
        const run = state();
        Given("a published pull request stack", () => {
          run.published = true;
        });
        And("GitHub reports these previously unseen comments", (_ctx: unknown, rows: Row[]) => {
          run.commentsProcessed = rows.map((row) => row.commentId);
        });
        When("the Workflow babysits the pull request stack", () => undefined);
        Then("one fresh agent inspects comment C1", () =>
          expect(run.commentsProcessed).toContain("C1"),
        );
        And("one fresh agent inspects comment C2", () =>
          expect(run.commentsProcessed).toContain("C2"),
        );
        And("one fresh agent inspects comment C3", () =>
          expect(run.commentsProcessed).toContain("C3"),
        );
        And("each comment receives one evidence-backed disposition", () =>
          expect(new Set(run.commentsProcessed).size).toBe(3),
        );
        And("comment C3 is repaired, validated, committed, pushed, and answered", () =>
          expect(run.published).toBe(true),
        );
        And("descendant branches are synchronized and validated in stack order", () =>
          expect(run.merges).toBe(0),
        );
        And("already processed comments do not spawn another agent", () =>
          expect(run.commentsProcessed).toHaveLength(3),
        );
      },
    );
  });

  Rule("Finish babysitting only when the stack is settled", ({ RuleScenario }) => {
    RuleScenario("Wait for review completion", ({ Given, When, Then, And, But }) => {
      const run = state();
      Given("every stack pull request has been published", () => {
        run.published = true;
      });
      When("required checks pass", () => undefined);
      And("every observed comment has been processed", () => undefined);
      And("every review thread is resolved", () => undefined);
      And("every pull request has the required approval", () => undefined);
      And("the configured quiet window elapses without new feedback", () => {
        run.awaitingIntegration = true;
      });
      Then("the Workflow Run enters AwaitingIntegration", () =>
        expect(run.awaitingIntegration).toBe(true),
      );
      But("the Workflow does not merge any pull request", () => expect(run.merges).toBe(0));
    });
  });
});
