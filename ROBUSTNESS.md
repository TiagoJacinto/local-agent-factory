# Local Agent Factory robustness ideas

## Purpose

This is the only document for non-functional and mostly user-invisible improvements.

It is an advisory technical backlog, not a PRD. Nothing here is implementation scope unless the owner explicitly promotes it. The product should continue gaining high-value workflow functionality without waiting for this list.

Typical topics include reliability, recovery, security, isolation, observability, replaceability, performance, cost control, and scale.

## How an agent should recommend an idea

An agent may suggest an item when it observes a concrete problem. The suggestion must state:

1. the observed failure, risk, or repeated human burden;
2. the smallest technical change that addresses it;
3. evidence that the problem matters now;
4. which product feature would be delayed, if any;
5. why the suggestion should not wait;
6. how to test the improvement;
7. how to disable or remove it if it does not help.

The agent must not silently insert the suggestion into `PRD.md`, turn it into a release gate, or weaken the functional roadmap. The owner decides whether and when to schedule it.

## Current minimum policy

The owner selected only three safeguards for the first release:

- require a clean source repository at the expected commit;
- run agent and command steps in a disposable local clone;
- require a human to integrate the result.

Everything else in this file remains optional.

# Reliability and execution control

## Bounded correction attempts

**Consider when:** correctable agent or validation failures repeatedly force users to restart entire runs.

Possible improvements:

- return structured failure feedback to the same logical coding session;
- use one workflow-level correction budget rather than nested retry loops;
- distinguish correction attempts from infrastructure retries;
- cap attempts, elapsed time, model turns, tokens, and cost;
- preserve the final failed workspace and outputs.

Avoid unbounded or stacked retries.

## Retry classification

**Consider when:** transient infrastructure failures become common enough that manual reruns are costly.

Classify failures before retrying:

- retry transient transport, availability, or rate-limit failures;
- send validation or review findings through a correction workflow;
- fail fast on policy violations, invalid requests, or deterministic defects;
- reconcile uncertain external side effects instead of blindly repeating them;
- use deadlines, bounded exponential backoff, and jitter where appropriate.

## Timeout, cancellation, and process cleanup

**Consider when:** commands hang, cancellation leaves work running, or child processes leak.

Possible improvements:

- per-step and whole-run deadlines;
- process-group ownership and termination;
- graceful cancellation followed by forced cleanup;
- bounded standard output and standard error artifacts;
- confirmation that no child process remains after timeout;
- CPU, memory, disk, PID, and model-cost limits when needed.

## Run-state persistence and resume

**Consider when:** process restarts or long-running workflows cause meaningful lost work.

Possible improvements:

- explicit run states and recorded transitions;
- a small SQLite state store with short transactions, busy timeout, and migrations;
- durable step results and artifact references;
- restart from the last safe boundary;
- cancellation and supersession rules;
- retention and cleanup policy for completed and failed runs.

Start with the smallest persistence mechanism that addresses the observed problem.

## Duplicate protection

**Consider when:** repeated CLI calls, events, or restarts create duplicate work or side effects.

Possible improvements:

- request IDs and a persistent inbox;
- idempotency keys for externally visible actions;
- operation records separating attempted, confirmed, and uncertain effects;
- duplicate-result lookup rather than re-execution.

# Repository integrity

## Stronger source-state checks

**Consider when:** stale requests or concurrent repository changes produce incorrect results.

Possible improvements:

- verify the expected source commit before workspace creation;
- recheck it before reporting success;
- assert that the source working tree and HEAD remain unchanged;
- reject stale runs when the target branch advances;
- record expected and actual commit IDs with the result.

## Changed-path policy

**Consider when:** human review and clone isolation are insufficient to prevent changes outside the intended scope.

Possible improvements:

- allowed and denied path rules;
- canonical path resolution;
- symlink, junction, and path-escape detection;
- changed-file manifests and content hashes;
- policy decisions included in the run result.

Repository content and model output must not override these checks.

## Worktree lifecycle management

**Consider when:** parallel task execution needs lighter-weight workspaces than full clones.

Possible improvements:

- one branch and worktree per task;
- parse `git worktree list --porcelain -z` instead of inspecting `.git` internals;
- explicit leases and lock reasons;
- cleanup, stale administration pruning, and moved-path repair;
- expected-base checks;
- an explicit submodule policy;
- conflict prediction from expected file manifests.

Use full clones until worktree complexity has a demonstrated benefit.

## Merge integrity

**Consider when:** independently valid task results fail after integration.

Possible improvements:

- a factory-owned merge gate;
- deterministic merge order;
- human fallback for conflicts;
- complete validation after integration;
- provenance linking each merged change to its task and validation evidence.

# Security and isolation

## Untrusted-input boundaries

**Consider when:** workflows consume repository files, issue text, tool output, retrieved content, or model-generated instructions.

Treat all of them as untrusted data.

Possible improvements:

- separate instructions from retrieved content;
- prevent repository text from changing deterministic policy;
- grant each role only the tools and authority it needs;
- require human approval for sensitive side effects;
- test direct and indirect prompt injection;
- record policy decisions separately from model reasoning.

## Secret handling

**Consider when:** workers need credentials or network services.

Possible improvements:

- minimal explicit environment forwarding;
- scoped and short-lived credentials;
- secret broker or explicit read-only mounts;
- redaction before logs or trace export;
- no ambient host credentials;
- different credentials for read, write, and release actions.

## Rootless container workers

**Consider when:** a disposable clone is no longer an adequate boundary for the code, tools, secrets, or users involved.

Possible improvements:

- rootless containers running as a non-root user;
- read-only base image and source seed;
- only the task workspace writable;
- no host container socket, implicit host mounts, privileged mode, or ambient credentials;
- explicit CPU, memory, disk, PID, wall-clock, and network limits;
- network disabled by default with narrow egress allowlists when required;
- deterministic artifact extraction and cleanup;
- retain-on-failure snapshots for inspection.

## Virtual-machine isolation

**Consider when:** containers do not satisfy the actual threat model.

Use a local VM adapter only after identifying the boundary that containers fail to provide. Preserve the same task and result protocol so the workflow does not depend on one isolation technology.

# Event and external-side-effect robustness

## Authenticated event ingress

**Consider when:** ticket or pull-request intake becomes externally reachable.

Possible improvements:

- verify webhook signatures against the unmodified request body;
- use constant-time signature comparison;
- reject unauthenticated payloads before parsing or dispatch;
- persist an immutable event envelope before acknowledgement;
- acknowledge quickly and dispatch work asynchronously.

## Event ordering and concurrency

**Consider when:** events for the same repository or pull request overlap or arrive out of order.

Possible improvements:

- per-repository or pull-request concurrency keys;
- expected-head checks;
- cancel or supersede work invalidated by newer commits;
- suppress events caused by the factory itself;
- preserve source event IDs and causal relationships.

## Durable event execution

**Consider when:** event-driven runs lose work across restarts or uncertain side effects become common.

Possible improvements:

- compare DBOS, Restate, Inngest, Temporal, Hatchet, or another runtime with local fault tests;
- idempotency keys for comments, branches, commits, labels, and pull-request writes;
- retry classification, backoff, jitter, and deadlines;
- reconciliation polling for uncertain outcomes;
- manual or API redelivery;
- dead-letter state and operator recovery;
- version compatibility for active executions.

Do not add a durable runtime merely because one may be useful later.

# Evidence and observability

## Local run evidence

**Consider when:** console output no longer explains what happened.

Possible improvements:

- one run directory containing request, workflow version, step results, commands, commit or diff, and decisions;
- stable run and operation IDs;
- bounded JSONL events;
- explicit artifact paths instead of embedding large output;
- redaction status on every potentially sensitive artifact.

## Distributed tracing

**Consider when:** workflows span enough agents, commands, events, or services that local artifacts are hard to correlate.

Possible improvements:

- map stable local events to OpenTelemetry;
- one root span per run;
- child spans for preparation, agent attempts, commands, review, commit, and external effects;
- producer/consumer spans or links for asynchronous events;
- attributes for workflow and adapter versions, commit IDs, decisions, duration, exit code, changed-file hashes, token use, and cost;
- redaction and sampling before export;
- a replaceable local backend such as Langfuse, Opik, or Phoenix.

## Operational dashboards

**Consider when:** aggregate behavior matters more than individual run inspection.

Potential measures:

- end-to-end success;
- human acceptance and rejection;
- validation and review corrections;
- duration and cost;
- retry and timeout rates;
- policy blocks and false positives;
- reverts and escaped defects;
- retained-workspace growth;
- restart recovery time;
- merge-conflict rate.

Do not build dashboards without a decision they will inform.

# Evaluation safety

## Versioned evaluation assets

**Consider when:** the functional evaluation workflow needs trustworthy comparisons.

Possible improvements:

- version datasets, evaluators, prompts, skills, workflows, and model routes;
- separate training, validation, holdout, and adversarial cases;
- use deterministic evaluators where possible;
- reserve model or human evaluation for judgment;
- record evaluator disagreement;
- prevent test-case leakage into optimization inputs.

## Promotion gates and canaries

**Consider when:** prompt, role, workflow, retrieval, or tool changes can regress existing behavior.

Possible improvements:

- compare candidates against a retained baseline;
- require holdout performance before promotion;
- canary a new version on bounded work;
- preserve immediate rollback;
- turn important failures into regression cases;
- avoid promotion based on one evaluator or one task.

# Controlled expertise safety

## Lesson provenance

**Consider when:** the product begins proposing reusable lessons from prior runs.

Possible improvements:

- record source evidence, trust classification, scope, confidence, owner, expiry, approval, and rollback state;
- distinguish corrections, repeated failures, expensive paths, reverts, and exemplary runs;
- keep repository text and retrieved content as untrusted evidence rather than authoritative instructions;
- prevent one run from becoming permanent guidance automatically.

## Retrieval safety

**Consider when:** role packages retrieve persistent knowledge.

Possible improvements:

- scope by repository, language, framework, role, and workflow;
- evaluate relevance and harmful interference;
- test poisoned content and indirect prompt injection;
- expire or supersede stale guidance;
- require human approval for broad, security-sensitive, or policy-changing artifacts.

# Replaceability and maintainability

## Capability ports

**Consider when:** a vendor-specific integration begins shaping workflow behavior.

Potential stable interfaces:

- agent runtime;
- coding worker;
- validation pipeline;
- repository workspace;
- event inbox;
- trace sink;
- memory store;
- model gateway;
- optional durable workflow runtime.

Keep interfaces small and capability-oriented. Vendor SDK features remain adapter details.

## Contract tests

**Consider when:** more than one adapter exists or an integration is likely to change.

Possible improvements:

- one shared contract suite per capability;
- mock or demo adapters for deterministic tests;
- standard task, result, error, and artifact shapes;
- tests that prove steps can be added, removed, or reordered without changing workers;
- migration tests before replacing an incumbent adapter.

## Version compatibility

**Consider when:** active runs may outlive deployments or workflow changes.

Possible improvements:

- version workflow definitions and role packages;
- pin active runs to compatible definitions;
- define upgrade and downgrade paths;
- do not silently migrate active executions;
- canary infrastructure and adapter versions.

# Model and provider resilience

## Capability-based model aliases

**Consider when:** several models or providers are approved and direct model names leak throughout workflow code.

Possible improvements:

- aliases such as scout, fast-code, deep-plan, review, and vision;
- route by role, modality, context size, sensitivity, budget, availability, and measured quality;
- keep routing outside agent and workflow implementations;
- make route decisions visible in evidence.

## Gateway and fallback

**Consider when:** provider availability, cost, or policy makes manual route selection burdensome.

Possible improvements:

- one replaceable gateway adapter;
- local OpenAI-compatible serving where useful;
- approved-provider allowlists;
- rate limits and circuit breakers;
- cost accounting and budgets;
- fallback that cannot duplicate external side effects;
- route canaries and rollback.

## Semantic routing

**Consider when:** deterministic role-based routing has a measured baseline and ambiguous selection remains a real problem.

Evaluate a semantic router offline before allowing it to choose production routes. Do not optimize for the cheapest model without quality and privacy constraints.

# Scale and disaster recovery

## Multi-worker scheduling

**Consider when:** one machine or worker is a demonstrated throughput limit.

Possible improvements:

- worker registration and health;
- capability and trust labels;
- leases, cancellation, and lost-worker recovery;
- content-hashed artifact and result caching;
- resource-aware scheduling;
- bounded queues and backpressure.

## Multi-repository coordination

**Consider when:** valuable changes regularly span dependent repositories.

Possible improvements:

- cross-repository task and dependency graphs;
- integration branches;
- combined validation environments;
- explicit compatibility and release ordering;
- human review of the complete multi-repository change.

## Backup and recovery

**Consider when:** state becomes valuable enough that loss has material cost.

Possible improvements:

- define recovery-time and recovery-point objectives;
- document backup and restore for every stateful component;
- test restore rather than only backup creation;
- retain a one-machine recovery mode;
- exercise upgrade, downgrade, capacity, and chaos scenarios;
- maintain migration playbooks for replaceable runtimes and stores.

# Suggested failure drills

Promote drills only with the corresponding feature. Useful examples include:

- coding worker exits with malformed or partial output;
- validation command hangs or leaves child processes;
- source commit changes during a run;
- changed files escape the requested scope;
- process restarts between two steps;
- the same event is delivered twice or out of order;
- an external write succeeds but its acknowledgement is lost;
- two parallel tasks modify overlapping files;
- a sandbox tries to access secrets, the host socket, or disallowed network destinations;
- a trace contains sensitive content before redaction;
- a new prompt, role, workflow, or model route regresses holdout tasks;
- a worker disappears while holding a lease;
- backup restore fails on a clean machine.

Failure drills should validate a chosen robustness improvement. They must not become prerequisites for unrelated product functionality.
