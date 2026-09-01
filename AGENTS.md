# Local Agent Factory

## Architecture

- For architecture, workflow behavior, source structure, or cross-run learning, read `docs/ARCHITECTURE.md` before exploring implementation.
- Use `CONTEXT.md` for domain language only. It is not a plan, run log, or implementation reference.
- Use `docs/plans/agent-native-source-architecture.md` when changing the source layout or execution kernel. It defines the target and migration completion checks.
- `src/` and `src/skills/` are canonical source. `dist/` is generated package output. A stamped target repository's `adws/` tree is installed output, and `adws/adw_data/` is runtime evidence.
- Modules are deep modules: read [`src/modules/README.md`](./src/modules/README.md) before adding or importing one.

### Issue tracker

Issues and PRDs live in GitHub Issues, managed with the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Use the five default canonical triage labels. See `docs/agents/triage-labels.md`.

### Domain docs

Use a single-context layout. See `docs/agents/domain.md`.
