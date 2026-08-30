# SSSF Overview

The system map the orchestrator reads on startup — what SSSF is, how a stamped repo is laid out, and which cookbook to load next.

## What SSSF is

Super Simple Software Factory builds repeatable **agents plus code** workflows. Deterministic TypeScript (an ADW script) owns sequencing, retries, and acceptance; agents are bounded nodes inside that graph. Agent proposes, code disposes.

Your job as orchestrator: **run the system, observe the system, help the engineer interact with it.** You do not do the work an ADW exists to do.

## Layout of a stamped repo

```
adws/
├── adw_sssf_config/
│   └── sssf.config.yaml         the agent roster — one agent, one prompt, one purpose
├── adw_prompt.ts                smallest ADW: one agent, one prompt, traced end-to-end
├── adw_plan.ts                  planner only — write the plan before code
├── adw_scout.ts                 read-only recon
├── adw_build.ts                 implement an existing plan
├── adw_build_review.ts          build → review: is this what was asked for?
├── adw_quality.ts               deterministic lint, typecheck, and build checks
├── adw_document.ts              write up the work just done, from git diff vs main
└── adw_modules/                 ALL low-level logic — ADW scripts stay thin
```

**The factory supports Pi and OpenCode CLI workers.** Set `coding_agent: pi` or `coding_agent: opencode`; both use the same phase, envelope, and Prewalk orchestration.

## The phase model

Every ADW run is a sequence of **phases**, each one `await run.phase({...}, handler)`. Three kinds, three swim lanes:

- **engineer** — the human lane; today the system-input phase (who asked, and for what).
- **agent** — `ph.call(AgentCall(...))`: prompt in → typed envelope out → gates verified.
- **code** — deterministic steps that stand alone (git branch, git commit, migrate). Never buried inside an agent phase.

**Success must be earned — every phase defaults to `fail`.** A clean exit flips it to success; agent phases additionally require the envelope to parse and all gates to come back green. A raise keeps it failed, records an error event, and aborts the run. `retries=N` on an agent phase buys extra gate-correction rounds through the same session before that raise happens.

## Envelopes

Agents have exactly two output channels: reference files written into `context_handoff/`, and a **final valid-JSON response** parsed against the output type the call declared. Code persists it as `envelope.json` and injects it into the next agent's `user.md` via `{{previous_envelope}}`. Bad JSON is never a restart — the harness re-prompts the _same session, context intact_, until it parses (bounded). See `references/handoff.md`.

**The output contract is a synced triad**: the type in `data_types.ts` ↔ the `## Report` JSON example in the agent's `user.md` ↔ `output_type=` at the call site. Editing any one of the three means editing all three in the same change — drift between them taxes every call with correction retries.

## Running an ADW

```bash
bun adws/adw_plan.ts "add a /health endpoint"
bun adws/adw_plan.ts requests/health.md --adw-id a1b2c3d4
```

The prompt is inline text or a file path. `--adw-id` is optional on every ADW: given one, the run joins that session (same dirs, same `context_handoff/`, agents resume their existing context windows); omitted, a fresh id is minted and printed.

## Composition examples live in `docs/adw-examples/` in the factory repository. They are documentation only and are not stamped into target repositories.

When you have finished reading this

You are done with startup. List the ADWs (`ls adws/adw_*.ts`, plus each `Phases:` docstring line) as a table, and **wait for the engineer's request.**

Do not survey anything else — not the trace db, not the config, not past runs, not the repo tree. You do not yet know what the request is, so anything you gather now is a guess about what will matter, spent from the context the real work needs. Every cookbook and reference below is lazy-loaded, one per request, and that is the whole design.

## Where to go next

Load one cookbook per request — this overview is the only one you read up front.

| Request                                    | Cookbook                                                      |
| ------------------------------------------ | ------------------------------------------------------------- |
| Turn a request into the prompt an ADW gets | `how_to_prompt_for_the_eng.md` — **read before every launch** |
| Set the system up in a repo                | `install.md`                                                  |
| Write a new ADW script                     | `create_adw.md`                                               |
| Change an existing ADW chain               | `update_adw.md`                                               |
| Generate `sssf.config.yaml`                | `create_config.md`                                            |
| Add or retune an agent                     | `update_config.md`                                            |
| Add low-level logic or a gate              | `update_modules.md`                                           |
| Run and monitor a workflow                 | `how_to_prompt_for_the_eng.md`, then `run_adw.md`             |

References, loaded when you need the spec: `references/config.md` (full config schema), `references/handoff.md` (envelope + session layout), `references/observability.md` (events, db tables, polling).
