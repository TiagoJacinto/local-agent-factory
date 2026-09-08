import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { DEFAULT_CONFIG } from "./defaults";

type FactoryWorkflowConfig = {
  database: string;
  defaults: Record<string, unknown>;
  observability: Record<string, unknown>;
  agents: readonly Record<string, unknown>[];
};

export type FactoryConfig = {
  workflow: FactoryWorkflowConfig;
  apps: { visualizer: { port: number } };
};

type PartialFactoryConfig = {
  workflow?: {
    database?: string;
    defaults?: Record<string, unknown>;
    observability?: Record<string, unknown>;
    agents?: readonly Record<string, unknown>[];
  };
  apps?: { visualizer?: { port?: number } };
};

export type ConfigSource = "built-in" | "global" | "local";
export type ResolvedFactoryConfig = {
  value: FactoryConfig;
  sources: Record<
    | "workflow.database"
    | "workflow.defaults"
    | "workflow.observability"
    | "workflow.agents"
    | "apps.visualizer.port",
    ConfigSource
  >;
  paths: { global: string; local: string };
};

export function configPaths(
  options: {
    cwd?: string;
    home?: string;
    xdgConfigHome?: string;
  } = {},
): { global: string; local: string } {
  const cwd = resolve(options.cwd ?? process.cwd());
  const home = options.home ?? homedir();
  const configHome = options.xdgConfigHome ?? process.env.XDG_CONFIG_HOME ?? join(home, ".config");
  return {
    global: join(configHome, "local-agent-factory", "config.yaml"),
    local: join(cwd, "local-agent-factory.config.yaml"),
  };
}

export function initializeConfig(
  scope: "local" | "global",
  options: { cwd?: string; home?: string; xdgConfigHome?: string; force?: boolean } = {},
): string {
  const path = configPaths(options)[scope];
  if (existsSync(path) && !options.force) {
    throw new Error(`${path} already exists — use --force to overwrite`);
  }
  mkdirSync(dirname(path), { recursive: true });
  const serialized =
    typeof Bun !== "undefined"
      ? Bun.YAML.stringify(DEFAULT_CONFIG, null, 2)
      : JSON.stringify(DEFAULT_CONFIG, null, 2);
  writeFileSync(path, serialized);
  return path;
}

function parseSimpleYaml(source: string): Record<string, unknown> {
  const root: Record<string, unknown> = {};
  const stack: Array<{ indent: number; value: Record<string, unknown> }> = [
    { indent: -1, value: root },
  ];
  for (const line of source.split("\n")) {
    if (!line.trim() || line.trimStart().startsWith("#")) continue;
    const match = line.match(/^(\s*)([^:#]+):(?:\s*(.*))?$/);
    if (!match) throw new Error(`invalid configuration line: ${line}`);
    const indent = match[1].length;
    while (stack.at(-1)!.indent >= indent) stack.pop();
    const parent = stack.at(-1)!.value;
    const key = match[2].trim();
    const raw = (match[3] ?? "").trim();
    if (!raw) {
      const child: Record<string, unknown> = {};
      parent[key] = child;
      stack.push({ indent, value: child });
    } else if (/^-?\d+$/.test(raw)) {
      parent[key] = Number(raw);
    } else {
      parent[key] = raw.replace(/^(?:"(.*)"|'(.*)')$/, "$1$2");
    }
  }
  return root;
}

function parseConfigDocument(source: string, path: string): Record<string, unknown> {
  try {
    const value =
      typeof Bun !== "undefined"
        ? Bun.YAML.parse(source)
        : (() => {
            try {
              return JSON.parse(source);
            } catch {
              return parseSimpleYaml(source);
            }
          })();
    if (!isRecord(value)) throw new Error("configuration root must be an object");
    return value;
  } catch (error) {
    throw new Error(`Cannot parse factory configuration ${path}: ${String(error)}`);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readConfig(path: string): PartialFactoryConfig {
  if (!existsSync(path)) return {};
  const value = parseConfigDocument(readFileSync(path, "utf8"), path);
  const workflow = value.workflow;
  const apps = value.apps;
  if (workflow !== undefined && !isRecord(workflow)) throw new Error("workflow must be an object");
  if (apps !== undefined && !isRecord(apps)) throw new Error("apps must be an object");

  const workflowValue = workflow as Record<string, unknown> | undefined;
  if (workflowValue?.config !== undefined) {
    throw new Error(
      "workflow.config was removed; run `laf init --local --force` to create inline configuration",
    );
  }
  const defaults = workflowValue?.defaults;
  const observability = workflowValue?.observability;
  const agents = workflowValue?.agents;
  if (defaults !== undefined && !isRecord(defaults)) {
    throw new Error("workflow.defaults must be an object");
  }
  if (observability !== undefined && !isRecord(observability)) {
    throw new Error("workflow.observability must be an object");
  }
  if (agents !== undefined && !Array.isArray(agents)) {
    throw new Error("workflow.agents must be an array");
  }
  if (agents?.some((agent) => !isRecord(agent))) {
    throw new Error("workflow.agents entries must be objects");
  }

  const visualizer = isRecord(apps?.visualizer) ? apps.visualizer : undefined;
  if (apps?.visualizer !== undefined && !visualizer) {
    throw new Error("apps.visualizer must be an object");
  }
  const database = workflowValue?.database;
  const port = visualizer?.port;
  if (database !== undefined && typeof database !== "string") {
    throw new Error("workflow.database must be a string");
  }
  if (
    port !== undefined &&
    (typeof port !== "number" || !Number.isInteger(port) || port < 1 || port > 65_535)
  ) {
    throw new Error("apps.visualizer.port must be an integer between 1 and 65535");
  }

  const result: PartialFactoryConfig = {};
  if (workflow !== undefined) {
    result.workflow = {
      database,
      defaults,
      observability,
      agents: agents as readonly Record<string, unknown>[] | undefined,
    };
  }
  if (apps !== undefined) result.apps = { visualizer: visualizer ? { port } : undefined };
  return result;
}

function source<T>(
  localValue: T | undefined,
  globalValue: T | undefined,
  fallback: T,
): { value: T; source: ConfigSource } {
  if (localValue !== undefined) return { value: localValue, source: "local" };
  if (globalValue !== undefined) return { value: globalValue, source: "global" };
  return { value: fallback, source: "built-in" };
}

export function resolveConfig(
  options: { cwd?: string; home?: string; xdgConfigHome?: string } = {},
): ResolvedFactoryConfig {
  const paths = configPaths(options);
  const global = readConfig(paths.global);
  const local = readConfig(paths.local);
  const globalWorkflow = global.workflow;
  const localWorkflow = local.workflow;
  const database = source(
    localWorkflow?.database,
    globalWorkflow?.database,
    DEFAULT_CONFIG.workflow.database,
  );
  const defaults = source(
    localWorkflow?.defaults,
    globalWorkflow?.defaults,
    DEFAULT_CONFIG.workflow.defaults,
  );
  const observability = source(
    localWorkflow?.observability,
    globalWorkflow?.observability,
    DEFAULT_CONFIG.workflow.observability,
  );
  const agents = source(
    localWorkflow?.agents,
    globalWorkflow?.agents,
    DEFAULT_CONFIG.workflow.agents,
  );
  const port = source(
    local.apps?.visualizer?.port,
    global.apps?.visualizer?.port,
    DEFAULT_CONFIG.apps.visualizer.port,
  );
  return {
    value: {
      workflow: {
        database: database.value,
        defaults: defaults.value,
        observability: observability.value,
        agents: agents.value,
      },
      apps: { visualizer: { port: port.value } },
    },
    sources: {
      "workflow.database": database.source,
      "workflow.defaults": defaults.source,
      "workflow.observability": observability.source,
      "workflow.agents": agents.source,
      "apps.visualizer.port": port.source,
    },
    paths,
  };
}

export function formatResolvedConfig(config: ResolvedFactoryConfig): string {
  const globalConfig = existsSync(config.paths.global)
    ? config.paths.global
    : `absent (${config.paths.global})`;
  const localConfig = existsSync(config.paths.local)
    ? config.paths.local
    : `absent (${config.paths.local})`;

  return [
    `workflow.database: ${config.value.workflow.database} (${config.sources["workflow.database"]})`,
    `workflow.defaults: inline (${config.sources["workflow.defaults"]})`,
    `workflow.observability: inline (${config.sources["workflow.observability"]})`,
    `workflow.agents: ${config.value.workflow.agents.length} inline agents (${config.sources["workflow.agents"]})`,
    `apps.visualizer.port: ${config.value.apps.visualizer.port} (${config.sources["apps.visualizer.port"]})`,
    `global config: ${globalConfig}`,
    `local config: ${localConfig}`,
  ].join("\n");
}
