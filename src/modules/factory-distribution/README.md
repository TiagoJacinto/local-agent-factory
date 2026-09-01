# Factory distribution

Public entrypoints are the application scripts under `application/`: build/check the skill, package it, release selected changes, install it, and generate configuration or workflow assets. Generated package output is written to `dist/` and verified with `bun run check:skill`.

`release.ts` is the deterministic release boundary. It accepts explicit `--path` values, commits only those paths, pushes the branch and version tag, polls the GitHub Actions release workflow, and installs the tagged release into `--target`. The packaged copy is distributed as `.pi/skills/sssf/scripts/release.ts`.
