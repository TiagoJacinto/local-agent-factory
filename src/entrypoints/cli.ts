#!/usr/bin/env bun
import { readFileSync } from "node:fs";
import { Command } from "commander";
import { z } from "zod";
import {
  INSTALLABLE_SKILLS,
  initFactoryConfig,
  installSkill,
  listWorkflows,
  runVisualizer,
  showFactoryConfig,
  resolveConfig,
} from "../modules/factory-distribution";
import { changeDeliveryWorkflows } from "../modules/change-delivery";
import { runWorkflowCli } from "./workflows/run";

const greetingOptionsSchema = z.object({
  name: z.string().trim().min(1).default("world"),
});
function packageVersion(): string {
  try {
    const metadata = JSON.parse(
      readFileSync(new URL("../../package.json", import.meta.url), "utf8"),
    ) as { version?: unknown };
    if (typeof metadata.version !== "string" || !metadata.version) {
      throw new Error("package version is missing");
    }
    return metadata.version;
  } catch (error) {
    throw new Error("Unable to read the Local Agent Factory package version", { cause: error });
  }
}

const VERSION = packageVersion();

type Output = (message: string) => void;

type CwdOptions = { cwd?: string };

function cwdOf(options: CwdOptions): string | undefined {
  return options.cwd;
}

export function createCli(output: Output = console.log): Command {
  const program = new Command();

  program.name("laf").description("The Bun-based Local Agent Factory").version(VERSION);

  program
    .command("greet")
    .description("Print a greeting")
    .argument("[name]", "name to greet")
    .action((name?: string) => {
      const { name: validatedName } = greetingOptionsSchema.parse({ name });
      output(`Hello, ${validatedName}!`);
    });

  const workflow = program.command("workflow").description("Run and inspect workflows");
  workflow
    .command("list")
    .description("List registered workflows")
    .action(() => output(listWorkflows(changeDeliveryWorkflows)));
  workflow
    .command("run")
    .description("Run a registered workflow")
    .argument("<workflow>", "workflow id")
    .argument("[request...]", "workflow request")
    .option("--agent <agent>", "agent owner")
    .option("--revision <revision>", "expected source revision")
    .option("--problem-folder <path>", "problem folder")
    .option("--config <path>", "agent configuration path")
    .option("--adw-id <id>", "run identifier")
    .option("--cwd <path>", "target repository", process.cwd())
    .action(async (workflowId: string, request: string[], options: Record<string, string>) => {
      const args = [...request];
      for (const [name, value] of Object.entries(options)) {
        if (name === "cwd" || value === undefined) continue;
        args.push(`--${name}`, value);
      }
      const originalCwd = process.cwd();
      try {
        if (options.cwd) process.chdir(options.cwd);
        const result = await runWorkflowCli(workflowId, args, output);
        if (result !== 0) process.exitCode = result;
      } finally {
        process.chdir(originalCwd);
      }
    });

  const app = program.command("app").description("Run packaged applications");
  app
    .command("list")
    .description("List packaged applications")
    .action(() => output("visualizer"));
  app
    .command("run")
    .description("Run an application")
    .argument("<application>", "application name")
    .option("--cwd <path>", "target repository", process.cwd())
    .option("--port <port>", "HTTP port")
    .option("--database <path>", "trace database path")
    .action(
      async (application: string, options: CwdOptions & { port?: string; database?: string }) => {
        if (application !== "visualizer") throw new Error(`unknown application "${application}"`);
        const target = cwdOf(options) ?? process.cwd();
        const configuredPort = resolveConfig({ cwd: target }).value.apps.visualizer.port;
        const port = options.port ? Number(options.port) : configuredPort;
        const child = runVisualizer({
          cwd: target,
          port,
          database: options.database,
        });
        output(`Visualizer: http://localhost:${port}`);
        await child.exited;
      },
    );

  const skill = program.command("skill").description("Install approved skills");
  skill
    .command("list")
    .description("List installable skills")
    .action(() => output(INSTALLABLE_SKILLS.join("\n")));
  skill
    .command("install")
    .description("Install an approved skill")
    .argument("<skill>", "skill name")
    .option("--local", "install into the current repository")
    .option("--global", "install into the user skill directory")
    .option("--cwd <path>", "target repository", process.cwd())
    .action((name: string, options: CwdOptions & { global?: boolean }) => {
      const destination = installSkill(name, options.global ? "global" : "local", {
        cwd: cwdOf(options),
      });
      output(`Installed ${name} at ${destination}`);
    });

  const config = program.command("config").description("Manage local and global configuration");
  config
    .command("init")
    .description("Create a configuration file")
    .option("--local", "write configuration in the target repository")
    .option("--global", "write configuration in the user config directory")
    .option("--force", "overwrite an existing configuration")
    .option("--cwd <path>", "target repository", process.cwd())
    .action((options: CwdOptions & { global?: boolean; force?: boolean }) => {
      const path = initFactoryConfig(options.global ? "global" : "local", {
        cwd: cwdOf(options),
        force: options.force,
      });
      output(`Created ${path}`);
    });
  config
    .command("show")
    .description("Show merged configuration and its sources")
    .option("--cwd <path>", "target repository", process.cwd())
    .action((options: CwdOptions) => output(showFactoryConfig({ cwd: cwdOf(options) })));
  config
    .command("path")
    .description("Show local and global configuration paths")
    .option("--cwd <path>", "target repository", process.cwd())
    .action((options: CwdOptions) => {
      const shown = showFactoryConfig({ cwd: cwdOf(options) });
      output(shown.split("\n").slice(-2).join("\n"));
    });

  program
    .command("init")
    .description("Create local or global factory configuration")
    .option("--local", "write configuration in the target repository")
    .option("--global", "write configuration in the user config directory")
    .option("--force", "overwrite an existing configuration")
    .option("--cwd <path>", "target repository", process.cwd())
    .action((options: CwdOptions & { global?: boolean; force?: boolean }) => {
      const path = initFactoryConfig(options.global ? "global" : "local", {
        cwd: cwdOf(options),
        force: options.force,
      });
      output(`Created ${path}`);
    });

  return program;
}

if (import.meta.main) {
  await createCli().parseAsync(Bun.argv);
}
