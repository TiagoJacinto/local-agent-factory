export type PushPolicyResult = { allowed: true } | { allowed: false; reason: string };

const GIT_PUSH = /\bgit(?:\s+-C\s+[^\s;&|]+)?\s+push\b/i;
const BYPASS = /(^|[\s-])--no-verify\b/i;
const FORCE = /(^|[\s-])--force(?:-with-lease)?\b|\bgit\s+push\s+-[a-z]*f[a-z-]*/i;

export function classifyPush(command: string): "none" | "push" | "bypass" | "force" {
  if (!GIT_PUSH.test(command)) return "none";
  if (BYPASS.test(command)) return "bypass";
  if (FORCE.test(command)) return "force";
  return "push";
}

export function policyMessage(kind: Exclude<ReturnType<typeof classifyPush>, "none">): string {
  if (kind === "bypass") return "Blocked: git push --no-verify bypasses the repository push gate.";
  if (kind === "force")
    return "Blocked: force pushes require an explicit human decision outside the agent.";
  return "The repository pre-push gate must pass before this push.";
}
