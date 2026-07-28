# Local Agent Factory: Code-Defined Workflow Kernel

Status: ready-for-agent  
Issue tracker: local repository specification; no remote issue tracker is configured

## Problem Statement

A local engineer can ask a coding agent to modify a repository, but the useful software-development workflow around that agent is still implicit and manual. Agent invocation, deterministic validation, artifact handoff, and human review are not represented as explicit, composable steps owned by the factory.

The existing design direction also risks making robustness infrastructure a prerequisite for product value. Databases, retries, durable execution, tracing, sandbox platforms, and provider routing could consume substantial implementation time before the engineer has one usable end-to-end workflow.

The first release needs to prove the smallest valuable vertical slice: a user requests a bounded change, a code-defined workflow invokes a coding worker in an isolated local workspace, deterministic validation runs outside the agent prompt, and the workflow stops at a human review gate with an inspectable result. The design must make it straightforward to add further workflow steps without rewriting the executor.

## Solution

Build a local TypeScript and Node.js workflow kernel whose workflows are ordinary typed code.

The first workflow contains three explicit step kinds:

1. an agent step that invokes one configurable coding-worker command;
2. a command step that runs one user-supplied validation command independently of the agent;
3. a human gate that stops the run and presents a commit or diff for manual review and integration.

A local CLI accepts the repository, objective, expected source commit, and validation command. The workflow operates in a disposable local clone and returns one structured run result containing ordered step results and review artifacts. It never merges, pushes, or changes the source working tree.

The Workflow Executor module is the primary product and testing seam. Its interface accepts a typed workflow definition, request, and required adapters, then returns a structured run result. The CLI is a thin adapter over that interface.

The current release deliberately fails simply. Agent or validation failure ends the run as `failed` and leaves inspectable output. It does not add retries, persistence, recovery machinery, tracing infrastructure, containers, or other robustness features from `ROBUSTNESS.md`.

## User Stories

1. As a local engineer, I want to start a repository-change workflow from one CLI command, so that I can use the system without running a server.
2. As a local engineer, I want to provide the repository path explicitly, so that the factory works on the repository I intend.
3. As a local engineer, I want to provide a plain-language change objective, so that the coding worker understands the desired outcome.
4. As a local engineer, I want to provide the expected source commit, so that I do not begin from an unintended repository revision.
5. As a local engineer, I want to provide one validation command, so that the workflow can apply the repository's own definition of a mechanically valid change.
6. As a local engineer, I want the factory to reject a dirty source repository, so that existing uncommitted work is not confused with agent work.
7. As a local engineer, I want the factory to reject a source repository at the wrong commit, so that stale requests fail visibly.
8. As a local engineer, I want agent work to happen in a disposable local clone, so that my source working tree remains untouched.
9. As a local engineer, I want to see the disposable workspace path, so that I can inspect failed or successful work directly.
10. As a local engineer, I want the coding worker to receive my objective explicitly, so that its task does not depend on hidden prompt state.
11. As a local engineer, I want one real configurable coding-worker command, so that I can use an available coding-agent CLI without changing workflow code.
12. As a local engineer, I want the agent step's exit code and output represented in the result, so that I can understand whether worker invocation succeeded.
13. As a local engineer, I want validation to run as a separate command step, so that an agent cannot claim success without the command actually passing.
14. As a local engineer, I want the validation command to run in the same disposable workspace as the agent changes, so that it validates the produced work.
15. As a local engineer, I want a non-zero validation exit to fail the run, so that invalid work does not reach the success path.
16. As a local engineer, I want failed validation output retained, so that I can diagnose the failure without rerunning the workflow.
17. As a local engineer, I want the first release to stop after one failed attempt, so that retry machinery does not delay a usable product.
18. As a local engineer, I want a passing workflow to stop at a human review gate, so that I retain authority over integration.
19. As a local engineer, I want the factory to create a local commit or equivalent diff, so that the result is easy to review.
20. As a local engineer, I want the result to include manual integration guidance, so that I know how to adopt an accepted change.
21. As a local engineer, I want the factory never to merge automatically, so that review remains meaningful.
22. As a local engineer, I want the factory never to push automatically, so that it cannot publish work without my decision.
23. As a local engineer, I want the source repository's working tree and HEAD to remain unchanged, so that a run cannot disrupt my current workspace.
24. As a local engineer, I want every run to have an identifier, so that its workspace and outputs can be discussed unambiguously.
25. As a local engineer, I want the final status to be either `awaiting_review` or `failed`, so that the first release has a small, clear state model.
26. As a local engineer, I want ordered step results in the final result, so that I can see what ran and in which order.
27. As a local engineer, I want the source commit recorded in the result, so that I can relate the proposed change to its base revision.
28. As a local engineer, I want the validation command and exit code recorded in the result, so that review evidence is explicit.
29. As a local engineer, I want the commit identifier or diff location recorded in the result, so that review does not depend on searching the workspace.
30. As a workflow author, I want workflows defined in typed code, so that sequencing, types, and changes are reviewable using normal development tools.
31. As a workflow author, I want agent, command, and human-gate steps to share one step contract, so that they can be composed by one executor.
32. As a workflow author, I want step identifiers and kinds to be explicit, so that results can be associated with their definitions.
33. As a workflow author, I want step inputs and artifacts to pass through a typed run context, so that workflow data flow is visible rather than hidden in conversations.
34. As a workflow author, I want the executor to run steps in declared order, so that code-defined workflow meaning is deterministic.
35. As a workflow author, I want to add another typed step without modifying executor control flow, so that the product can evolve by composition.
36. As a workflow author, I want the workflow definition to remain ordinary TypeScript rather than YAML, so that no separate workflow language must be designed or maintained.
37. As a workflow author, I want control flow outside prompts, so that model instructions cannot secretly redefine the software-development lifecycle.
38. As a maintainer, I want the Workflow Executor module to expose one small interface, so that orchestration complexity remains behind a deep module.
39. As a maintainer, I want the CLI to be a thin adapter over the Workflow Executor interface, so that command-line parsing does not become a second workflow implementation.
40. As a maintainer, I want coding-worker invocation represented by a replaceable adapter, so that the initial agent CLI does not define workflow semantics.
41. As a maintainer, I want a deterministic demo coding worker for tests, so that core workflow behavior can be verified without a live model.
42. As a maintainer, I want tests to use real temporary Git repositories, so that repository effects are verified rather than mocked away.
43. As a maintainer, I want failures returned as structured run results where possible, so that callers and tests observe the same interface.
44. As a product owner, I want the first release limited to the usable vertical slice, so that high-value workflow functionality arrives quickly.
45. As a product owner, I want robustness ideas kept outside this specification, so that optional technical work cannot silently become release scope.
46. As a product owner, I want the completed kernel to support future planning, review, decomposition, and parallel steps, so that later capabilities build on the same workflow model.

## Implementation Decisions

- Use TypeScript on Node.js.
- Define workflows as ordinary typed code. Do not create a YAML workflow language, visual workflow builder, or prompt-defined outer control flow.
- Build a deep Workflow Executor module as the primary seam. Its interface accepts a workflow definition, request, and required adapters and returns a structured run result.
- Keep the Workflow Executor interface small. Step iteration, context propagation, failure handling, and result aggregation belong inside its implementation.
- Represent each workflow as an ordered collection of typed steps with explicit identifiers and kinds.
- Define one common step contract that accepts the current run context and returns a typed step result plus any produced artifacts.
- Include three initial step implementations: Agent Step, Command Step, and Human Gate.
- Keep the CLI as an adapter that parses user input, creates the request and dependencies, invokes the Workflow Executor, and renders its result.
- Accept repository path, objective, expected source commit, and one validation command as the CLI request contract.
- Generate a run identifier locally. No HTTP request ID or external coordinator is required.
- Create a disposable local clone from the requested source repository before agent execution.
- Require the source repository to be clean and at the expected commit before creating the disposable clone.
- Run all agent and command work in the disposable clone. The source working tree is never an execution workspace.
- Invoke one configurable real coding-worker command through a Coding Worker adapter.
- Pass the objective explicitly to the worker and set the disposable clone as its working directory.
- Capture the worker's exit code, standard output, and standard error in a typed Agent Step result.
- Permit a deterministic demo Coding Worker adapter for tests. It is a test adapter, not a second production integration requirement.
- Run the user-provided validation command through the Command Step after the Agent Step completes successfully.
- Treat validation exit code `0` as success and every other exit code as run failure.
- Do not route failed validation back to the coding worker in this release.
- End the workflow immediately on Agent Step or Command Step failure and return status `failed` with inspectable outputs and workspace path.
- End a passing workflow at the Human Gate with status `awaiting_review`.
- Create a local commit in the disposable clone when possible. If commit creation is not possible, produce an equivalent reviewable diff artifact.
- Return a structured result containing run identifier, status, source commit, workspace path, ordered step results, validation evidence, commit or diff reference, and manual integration guidance.
- Do not merge, push, deploy, or otherwise integrate the produced change automatically.
- Model only `awaiting_review` and `failed` as terminal states in this release.
- Avoid databases, durable workflow runtimes, retries, resume support, duplicate protection, containers, trace platforms, model gateways, and distributed workers.
- Keep optional technical improvements in `ROBUSTNESS.md`. They require explicit owner promotion before becoming implementation scope.
- Preserve the ranked functional direction after this release: typed planning, configurable validation, independent review, review feedback, role-specific context, decomposition, specialists, parallel execution, merge gating, specialized workflows, ticket intake, evaluation, and controlled expertise.

## Testing Decisions

- Use the Workflow Executor interface as the primary testing seam confirmed by the owner.
- Test external behavior through that seam: supply a typed workflow, request, and adapters, then assert the returned run result and observable repository effects.
- Prefer one high seam over isolated tests of each internal helper. Step iteration, context propagation, failure short-circuiting, and result aggregation should be proven together.
- Use real temporary Git repositories and filesystem workspaces so tests verify source cleanliness checks, clone isolation, commits or diffs, and unchanged source state.
- Use a deterministic demo Coding Worker adapter rather than a live model for the core test suite.
- Exercise the real command execution path with small deterministic validation commands.
- Add one CLI smoke test to prove argument parsing reaches the Workflow Executor and renders its result. Do not duplicate the entire behavioral suite through the CLI.
- Test the successful workflow: Agent Step succeeds, validation succeeds, Human Gate is reached, status is `awaiting_review`, and a commit or diff is returned.
- Test Agent Step failure: later steps do not execute, status is `failed`, and worker output remains inspectable.
- Test validation failure: the Human Gate is not reached, status is `failed`, no correction attempt occurs, and validation evidence is returned.
- Test dirty-source rejection before workspace execution.
- Test expected-commit mismatch rejection before workspace execution.
- Test that the source repository HEAD and working tree remain unchanged after successful and failed runs.
- Test declared step ordering using recorded demo-step observations in the returned result.
- Test artifact propagation through the run context using values observable in later step results.
- Test the extensibility requirement by defining an additional typed example step and executing it without modifying the Workflow Executor implementation.
- Test that a passing run stops at `awaiting_review` and performs no merge or push.
- Test the complete run-result contract, including run identifier, status, source commit, workspace, ordered results, validation evidence, and review artifact reference.
- Avoid assertions against private helper calls, internal class shapes, exact logging text, or directory layout unless they are part of the documented interface.
- The repository currently contains documentation only, so there is no existing test prior art. Establish the Workflow Executor behavioral suite as the initial testing pattern.

## Out of Scope

- Correction loops, bounded retries, retry classification, and provider retry behavior.
- Persistent state, SQLite, duplicate guards, crash recovery, or run resume.
- Per-step timeouts, process-group cleanup, resource quotas, or cost caps beyond ordinary process failure reporting.
- Changed-path allowlists, canonical-path policy, symlink escape detection, or advanced repository policy.
- Git worktrees, task decomposition, specialist agents, parallel workers, or integration merging.
- Planning agents, independent reviewers, review-to-build feedback, or specialized workflow variants.
- Ticket, issue, pull-request, webhook, or CI event intake.
- MCP tools, a `/factory` skill, or an HTTP server.
- Container or virtual-machine sandboxes.
- Structured tracing platforms, dashboards, datasets, evaluation gates, or trace mining.
- Persistent expertise, retrieval systems, memory, prompt optimization, or model training.
- Model gateways, model routing, fallbacks, circuit breakers, or local inference infrastructure.
- Multi-repository coordination, remote workers, distributed scheduling, backup, or disaster recovery.
- Automatic merge, push, deployment, release, or any production side effect.
- Any item in `ROBUSTNESS.md` unless the owner explicitly promotes it.

## Further Notes

- `ROBUSTNESS.md` is the only companion document. It contains optional, mostly user-invisible technical ideas and is not part of the implementation context for this specification.
- This specification intentionally favors a usable workflow kernel over a robust platform.
- The accepted primary seam is the Workflow Executor interface. The CLI is a thin adapter and receives only smoke-level coverage.
- The first follow-on capability is a typed Change Plan step. Later functional priorities are configurable validation gates, independent review, review feedback, role-specific context packs, task decomposition, specialist roles, parallel execution, integration merging, specialized workflows, ticket intake, evaluation, and controlled expert-role packages.
- No Git remote or external issue tracker is configured for this repository. This file is therefore the local published specification and carries the `ready-for-agent` status directly.
