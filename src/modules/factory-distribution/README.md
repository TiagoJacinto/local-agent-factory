# Factory distribution

This module distributes the Bun-based CLI, packaged application assets, configuration,
and the two currently approved mock skills.

## Public interface

Import from `index.ts` for workflow and skill listing, skill installation, configuration
initialization/resolution, and `runVisualizer`. The executable adapter is
`src/entrypoints/cli.ts`; it owns argument parsing only.

`laf init` is configuration-only: local initialization writes
`local-agent-factory.config.yaml`, while global initialization writes the user-scoped
configuration file. Neither operation creates repository runtime files.

## Invariants

- Bun is the only supported runtime and package manager.
- Configuration resolution is local, then global, then built-in defaults.
- Skill installation accepts only `mock-reviewer` and `mock-researcher`.
- The visualizer runs from the package and receives its database path explicitly or
  through resolved configuration.

## Verification

```bash
bun run test -- src/cli.test.ts src/modules/factory-distribution/tests/distribution.test.ts
bun run build:visualizer
```
