// @ts-check
// Deep-module enforcement for src/modules.
// Root files are public entry points; every subfolder is private implementation.

const PACKAGES_ROOT = "src/modules";
const R = PACKAGES_ROOT;
const PACKAGE_INTERNALS = `^${R}/[^/]+/[^/]+/`;

/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: "entrypoint-boundary-from-app",
      comment:
        "Code outside a module may import its root entry points, but never files in its subfolders.",
      severity: "error",
      from: { pathNot: `^${R}/` },
      to: { path: PACKAGE_INTERNALS },
    },
    {
      name: "entrypoint-boundary-across-packages",
      comment:
        "A module may use its own implementation freely, but reaches other modules only through root entry points.",
      severity: "error",
      from: { path: `^${R}/([^/]+)/`, pathNot: `^${R}/[^/]+/tests/` },
      to: {
        path: PACKAGE_INTERNALS,
        pathNot: `^${R}/$1/`,
      },
    },
    {
      name: "tests-through-entrypoints",
      comment:
        "Tests exercise modules through root entry points, except for fixtures within their own tests folder.",
      severity: "error",
      from: { path: `^${R}/([^/]+)/tests/` },
      to: {
        path: PACKAGE_INTERNALS,
        pathNot: `^${R}/$1/tests/`,
      },
    },
    {
      name: "tests-folder-is-private",
      comment: "Only tests may import files from a module's tests folder.",
      severity: "error",
      from: { pathNot: `^${R}/[^/]+/tests/` },
      to: { path: `^${R}/[^/]+/tests/` },
    },
    {
      name: "no-circular",
      comment: "No dependency cycles.",
      severity: "error",
      from: {},
      to: { circular: true },
    },

    // Layering controls which modules may depend on which. Add repository-specific
    // rules here when those dependency directions need deterministic enforcement.
  ],
  options: {
    doNotFollow: { path: "node_modules" },
    tsConfig: { fileName: "tsconfig.json" },
    enhancedResolveOptions: {
      extensions: [".ts", ".tsx", ".js", ".jsx", ".json"],
    },
  },
};
