export function buildModuleGreeting(name: string): string {
  const normalizedName = name.trim() || "engineer";
  return `Hello, ${normalizedName}.`;
}
