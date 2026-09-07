import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";

type PartialFactoryConfig = {
  workflow?: { config?: string; database?: string };
  apps?: { visualizer?: { port?: number } };
};

export type FactoryConfig = {
  workflow: { config: string; database: string };
  apps: { visualizer: { port: number } };
};

export type ConfigSource = "built-in" | "global" | "local";
export type ResolvedFactoryConfig = {
  value: FactoryConfig;
  sources: Record<"workflow.config" | "workflow.database" | "apps.visualizer.port", ConfigSource>;
  paths: { global: string; local: string };
};

const DEFAULT_CONFIG: FactoryConfig = {
  workflow: {
    config: "adws/adw_sssf_config/sssf.config.yaml",
    database: "adws/adw_data/sssf.db",
  },
  apps: { visualizer: { port: 4600 } },
};

const CONFIG_TEMPLATE = `workflow:\n  config: adws/adw_sssf_config/sssf.config.yaml\n  database: adws/adw_data/sssf.db\napps:\n  visualizer:\n    port: 4600\n`;

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
  writeFileSync(path, CONFIG_TEMPLATE);
  return path;
}

function parseYamlObject(source: string): Record<string, unknown> {
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readConfig(path: string): PartialFactoryConfig {
  if (!existsSync(path)) return {};
  const value = parseYamlObject(readFileSync(path, "utf8"));
  const workflow = value.workflow;
  const apps = value.apps;
  let visualizer: unknown;
  if (isRecord(apps)) visualizer = apps.visualizer;
  if (workflow !== undefined && !isRecord(workflow)) throw new Error("workflow must be an object");
  if (apps !== undefined && !isRecord(apps)) throw new Error("apps must be an object");
  if (visualizer !== undefined && !isRecord(visualizer)) {
    throw new Error("apps.visualizer must be an object");
  }
  let config: unknown;
  let database: unknown;
  if (isRecord(workflow)) {
    config = workflow.config;
    database = workflow.database;
  }
  let port: unknown;
  if (isRecord(visualizer)) port = visualizer.port;
  if (config !== undefined && typeof config !== "string") {
    throw new Error("workflow.config must be a string");
  }
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
  if (workflow !== undefined) result.workflow = { config, database };
  if (apps !== undefined) {
    result.apps = {};
    if (visualizer !== undefined) result.apps.visualizer = { port };
  }
  return result;
}

export function resolveConfig(
  options: { cwd?: string; home?: string; xdgConfigHome?: string } = {},
): ResolvedFactoryConfig {
  const paths = configPaths(options);
  const global = readConfig(paths.global);
  const local = readConfig(paths.local);
  const source = <T>(localValue: T | undefined, globalValue: T | undefined, fallback: T) => {
    if (localValue !== undefined) return { value: localValue, source: "local" as const };
    if (globalValue !== undefined) return { value: globalValue, source: "global" as const };
    return { value: fallback, source: "built-in" as const };
  };
  const workflowConfig = source(
    local.workflow?.config,
    global.workflow?.config,
    DEFAULT_CONFIG.workflow.config,
  );
  const workflowDatabase = source(
    local.workflow?.database,
    global.workflow?.database,
    DEFAULT_CONFIG.workflow.database,
  );
  const visualizerPort = source(
    local.apps?.visualizer?.port,
    global.apps?.visualizer?.port,
    DEFAULT_CONFIG.apps.visualizer.port,
  );
  return {
    value: {
      workflow: { config: workflowConfig.value, database: workflowDatabase.value },
      apps: { visualizer: { port: visualizerPort.value } },
    },
    sources: {
      "workflow.config": workflowConfig.source,
      "workflow.database": workflowDatabase.source,
      "apps.visualizer.port": visualizerPort.source,
    },
    paths,
  };
}

export function formatResolvedConfig(config: ResolvedFactoryConfig): string {
  return [
    `workflow.config: ${config.value.workflow.config} (${config.sources["workflow.config"]})`,
    `workflow.database: ${config.value.workflow.database} (${config.sources["workflow.database"]})`,
    `apps.visualizer.port: ${config.value.apps.visualizer.port} (${config.sources["apps.visualizer.port"]})`,
    `global config: ${config.paths.global}`,
    `local config: ${config.paths.local}`,
  ].join("\n");
}
