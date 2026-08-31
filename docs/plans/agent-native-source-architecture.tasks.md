# Agent-native source architecture tasks

- [x] Characterize the existing prototype and operational runner seams.
- [ ] Create canonical workflow-execution domain contracts and ports.
- [ ] Move source admission, workspace lifecycle, phases, handoff, evidence, and decisions behind Factory.
- [ ] Migrate change-delivery workflow registrations and typed use cases.
- [ ] Move distribution packaging and thin entrypoints.
- [ ] Remove obsolete execution kernels and update generated-package verification.

## Verification

Run the cheapest focused workflow-execution tests after each migration step, then run `bun run format:check`, `bun run lint`, `bun run typecheck`, `bun run test`, `bun run check:skill`, and package verification.
