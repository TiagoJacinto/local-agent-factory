import { Command } from "commander";
import { z } from "zod";

const greetingOptionsSchema = z.object({
  name: z.string().trim().min(1).default("world"),
});

export function createCli(output: (message: string) => void = console.log): Command {
  const program = new Command();

  program
    .name("local-agent-factory")
    .description("Local tools for building and running coding agents")
    .version("0.1.0");

  program
    .command("greet")
    .description("Print a greeting")
    .argument("[name]", "name to greet")
    .action((name?: string) => {
      const { name: validatedName } = greetingOptionsSchema.parse({ name });
      output(`Hello, ${validatedName}!`);
    });

  return program;
}

if (import.meta.main) {
  await createCli().parseAsync(Bun.argv);
}
