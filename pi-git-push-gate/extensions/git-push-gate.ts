import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { classifyPush, policyMessage } from "../gate";

const GATE_TIMEOUT_MS = 10 * 60 * 1000;

export default function (pi: ExtensionAPI) {
  pi.on("tool_call", async (event) => {
    if (event.toolName !== "bash") return;

    const command = String(event.input.command ?? "");
    const kind = classifyPush(command);
    if (kind === "none") return;
    if (kind !== "push") return { block: true, reason: policyMessage(kind) };

    const result = await pi.exec("lefthook", ["run", "pre-push"], {
      timeout: GATE_TIMEOUT_MS,
    });
    if (result.code !== 0) {
      const output = `${result.stdout}\n${result.stderr}`.trim();
      return {
        block: true,
        reason: `${policyMessage(kind)}\n\n${output || "lefthook exited without output."}`,
      };
    }
  });
}
