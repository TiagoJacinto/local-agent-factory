# Factory distribution

This module distributes the Bun-based CLI, repository runtime, visualizer, configuration, and the two currently approved mock skills.

## Public interface

Import from `index.ts` for workflow/skill listing and installation, configuration
initialization/resolution, and `runVisualizer`. Repository runtime installation remains the
responsibility of the npm-free release installer. The executable adapter is
`src/entrypoints/cli.ts`; it owns argument parsing only.

## Invariants

- Bun is the only supported runtime and package manager.
- The npm-free GitHub Release installer remains checksummed and repository-scoped.
- Skill installation accepts only `mock-reviewer` and `mock-researcher`.
- Local configuration overrides global configuration, which overrides built-in defaults.
- Generated repository runtime remains self-contained and does not import package dependencies.

## Verification

```bash
bun run test -- src/cli.test.ts src/modules/factory-distribution/tests/distribution.test.ts
bun run build:visualizer
bun run check:skill
```

Generated package output is written to `dist/` and verified with `bun run check:skill`.
`release.ts` is the deterministic release boundary. It accepts explicit `--path` values,
commits only those paths, pushes the branch and version tag, polls the GitHub Actions
release workflow, and installs the tagged release into `--target`. The packaged copy is
distributed as `.pi/skills/sssf/scripts/release.ts`.
