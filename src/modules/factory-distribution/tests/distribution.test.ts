import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { resolveConfig, installSkill } from "../index";

describe("factory distribution", () => {
  test("resolves local configuration over global configuration and defaults", () => {
    const root = mkdtempSync(join(homedir(), "laf-config-"));
    const cwd = join(root, "repository");
    const xdgConfigHome = join(root, "xdg");
    try {
      mkdirSync(cwd, { recursive: true });
      mkdirSync(join(xdgConfigHome, "local-agent-factory"), { recursive: true });
      writeFileSync(
        join(xdgConfigHome, "local-agent-factory/config.yaml"),
        "apps:\n  visualizer:\n    port: 4700\nworkflow:\n  database: global.db\n",
      );
      writeFileSync(
        join(cwd, "local-agent-factory.config.yaml"),
        "apps:\n  visualizer:\n    port: 4800\n",
      );

      const resolved = resolveConfig({ cwd, xdgConfigHome });
      expect(resolved.value.apps.visualizer.port).toBe(4800);
      expect(resolved.sources["apps.visualizer.port"]).toBe("local");
      expect(resolved.value.workflow.database).toBe("global.db");
      expect(resolved.sources["workflow.database"]).toBe("global");
      expect(resolved.value.workflow.agents.length).toBeGreaterThan(0);
      expect(resolved.sources["workflow.agents"]).toBe("built-in");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("rejects unknown skills before writing a destination", () => {
    const cwd = mkdtempSync(join(homedir(), "laf-skill-"));
    try {
      expect(() => installSkill("not-a-skill", "local", { cwd })).toThrow(
        'unknown skill "not-a-skill"',
      );
      expect(existsSync(join(cwd, ".pi/skills/not-a-skill"))).toBe(false);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });
});
