# Deep modules

Each immediate directory under `src/modules/` is a deep module: it provides substantial behavior behind a small interface. Copy `example/` as a starter or delete it once a real module replaces its teaching role.

```text
src/modules/<name>/
├── index.ts          # public entry point
├── client.ts         # optional additional public entry point
├── lib/              # private implementation
└── tests/            # private tests and fixtures
```

**Entry-point seam.** Import a module only through its root files. Every root file is a public entry point; every file in a subfolder is private. Add several focused root entry points when callers need distinct interfaces.

**Intra-module freedom.** Implementation files within one module may import each other freely. Keep behavior behind the module's small interface to preserve depth and locality.

**Tests through entry points.** Tests import the module under test through its root entry points, just like production callers. Tests may share fixtures from their own `tests/` folder, but they may not import any module's implementation subfolders.

**No cycles.** Module dependencies must remain acyclic. Layering—deciding which modules may depend on which—is separate and can be added to `.dependency-cruiser.cjs` when required.

Do not build giant barrel files that re-export implementation trees. Prefer several small entry points such as `index.ts`, `client.ts`, and `server.ts`.

Run `bun run lint:boundaries` to verify these rules. The command is also part of `bun run cibuild`.
