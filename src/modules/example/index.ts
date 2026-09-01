import { buildModuleGreeting } from "./lib/impl";

export function greetFromExample(name: string): string {
  return buildModuleGreeting(name);
}
