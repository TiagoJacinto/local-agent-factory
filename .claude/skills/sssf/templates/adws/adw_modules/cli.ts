import { resolvePrompt } from "./utils";
export function args() {
  const positional: string[] = [];
  const options: Record<string, string | boolean> = {};
  for (let i = 2; i < process.argv.length; i++) {
    const x = process.argv[i];
    if (x.startsWith("--")) {
      const k = x.slice(2);
      options[k] = process.argv[i + 1]?.startsWith("--") ? true : (process.argv[++i] ?? true);
    } else positional.push(x);
  }
  return { positional, options };
}
export function input() {
  const a = args();
  if (!a.positional[0]) throw new Error("prompt is required");
  return {
    prompt: resolvePrompt(a.positional[0]),
    config: String(a.options.config || "adws/adw_sssf_config/sssf.config.yaml"),
    adwId: a.options["adw-id"] ? String(a.options["adw-id"]) : undefined,
    agent: a.options.agent ? String(a.options.agent) : "builder",
    base: a.options.base ? String(a.options.base) : "main",
  };
}
export async function main(fn: (x: ReturnType<typeof input>) => Promise<number>) {
  try {
    process.exitCode = await fn(input());
  } catch (e) {
    console.error(e instanceof Error ? e.stack : e);
    process.exitCode = 1;
  }
}
