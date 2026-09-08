import { mkdirSync, writeFileSync } from "node:fs";
export function renderTemplate(text: string, vars: Record<string, string>) {
  for (const [k, v] of Object.entries(vars)) text = text.split(`{{${k}}}`).join(v);
  return text;
}
export function save(dir: string, name: string, content: string) {
  mkdirSync(dir, { recursive: true });
  const p = `${dir}/${name}`;
  writeFileSync(p, content);
  return p;
}
