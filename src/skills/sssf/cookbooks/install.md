# Install

`/sssf install` — stamp the entire factory out of the skill and into the current working directory.

## Run it

New installs use the latest stable release:

```bash
curl -fsSL https://raw.githubusercontent.com/TiagoJacinto/local-agent-factory/main/install.sh | bash
```

Choose an exact release when you need repeatability:

```bash
curl -fsSL https://raw.githubusercontent.com/TiagoJacinto/local-agent-factory/main/install.sh | bash -s -- --version v0.2.0
```

For a skill already installed locally:

```bash
bun .pi/skills/sssf/scripts/install.ts --update --version v0.2.0
```

The resolved version is recorded in `adws/adw_sssf_config/sssf.lock.yaml`. Existing installs keep their locked version unless `--update`, `--version`, or `--latest` is selected.

Run from the **target repo root** — the cwd is where everything lands. If the skill lives in your user scope, the path is `~/.pi/skills/sssf/scripts/install.ts`.

## What gets stamped

`install.ts` copies `templates/` into the cwd:

- `adws/adw_sssf_config/sssf.config.yaml` comes from `templates/sssf.config.yaml` and is tracked as the agent roster.
- `.env.sample` comes from `templates/env.sample` and is tracked.
- `adws/factory/modules/change-delivery/workflows/` comes from `templates/adws/` and is tracked as registered workflow definitions. Composition examples remain in the factory repository.
- `factory/modules/` comes from `templates/factory/modules/` and is tracked as the current runtime implementation.
- `adws/adw_data/prompt_engineering/{planner,builder,scout,reviewer,documenter}/` comes from `templates/prompt_engineering/` and is tracked as the **user-owned** prompt home.
- `justfile` comes from `templates/justfile` and is tracked with starter run and trace recipes.
- `adws/adw_sssf_config/sssf.lock.yaml` records the resolved release version and is tracked.
- `adws/adw_data/sessions/` and `adws/adw_data/sssf.db` are runtime output and are gitignored.

`prompt_engineering/` is the user-owned home for agent prompts. Edit those files in `adws/adw_data/`, never back inside the skill. The factory deliberately uses only Pi's built-in tools; extensions and custom tools are not part of the runtime.

## Idempotency

Re-running is safe. `install.ts` skips **every** file that already exists — your config, your prompts, and previously stamped code alike — and reports what it skipped, so a second run doubles as a drift check. Use `--update` to refresh runtime files while preserving config, prompts, and the justfile. Use `--force` only when you also want to overwrite user-owned files.

## Post-install checklist

1. **Env** — `cp .env.sample .env`, then authenticate the configured `openai-codex/gpt-5.6-luna` model in Pi with `/login openai-codex`. No OpenRouter API key is required.
2. **Pi is installed and on PATH** — `pi --version`. Set `PI_PATH` in `.env` if it is not.
3. **The model resolves** — `openai-codex/gpt-5.6-luna` must be a registered id in `~/.pi/agent/models.json`. Check with `pi --list-models` or read the file directly; see `references/config.md` for model resolution.
4. **Gitignore** — `install.ts` appends `adws/adw_data/sessions/`, `adws/adw_data/runs/`, `adws/adw_data/sssf.db*`, `.pi/skills/sssf/`, and `.env` for you; confirm they landed. These are runtime, installed package, or secrets and must never be committed.
5. **Git repo** — ADWs that end in a commit phase call `git_helper.commit_all`, which raises if the cwd is not a git repository. Run `git init` and make a first commit before using commit-capable workflows. The composition examples in `docs/adw-examples/` are documentation only and are not stamped. `bun adws/run.ts document` needs one too: it measures the change with `git diff` against a base ref (`main` by default, `--base` to override).
6. **Smoke test** — `just demo` runs two cheap read-only workflows back to back, or run the smallest ADW directly:

```bash
just demo                                                    # both, end to end
bun adws/run.ts prompt "reply with a one-line summary of this repo"   # the raw form
```

Green means the whole path works: config validated, session minted, Pi ran, envelope parsed, events landed in `adws/adw_data/sssf.db`. Verify the trace exists before trusting anything larger:

```bash
sqlite3 adws/adw_data/sssf.db "select adw_id, status from sessions order by started_at desc limit 1;"
```

If the smoke test fails, fix it before composing chains — every multi-agent ADW rides on this exact path.
