import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import type {
	PrimitiveAdapter,
	PrimitiveAdapterOutput,
} from "./workflow.js";

export interface PiAdapterOptions {
	readonly executable?: string;
	readonly sessionDirectory?: string;
	readonly timeoutMs?: number;
	readonly environment?: NodeJS.ProcessEnv;
}

interface PiEvent {
	readonly type?: string;
	readonly [key: string]: unknown;
}

/** Create a primitive adapter which runs Pi in a disposable workspace. */
export function createPiAdapter(options: PiAdapterOptions = {}): PrimitiveAdapter {
	const executable = options.executable ?? "pi";
	const sessions = new Map<string, string>();

	return ({
		input,
		role,
		workspacePath,
		session,
		emit,
	}) => {
		const roleName = role?.name ?? "default";
		const sessionKey = `${session?.id ?? "ephemeral"}:${roleName}`;
		const sessionId =
			session?.agentSessions[roleName] ?? sessions.get(sessionKey) ?? randomUUID();
		if (session) session.agentSessions[roleName] = sessionId;
		sessions.set(sessionKey, sessionId);

		const args = ["--mode", "json", "--print", "--session-id", sessionId];
		if (role?.model && role.model !== "default") args.push("--model", role.model);
		if (role?.instructions) args.push("--append-system-prompt", role.instructions);
		if (role?.tools.length) args.push("--tools", role.tools.join(","));
		if (options.sessionDirectory)
			args.push("--session-dir", options.sessionDirectory);
		if (workspacePath) args.push("--no-context-files", "--approve");
		args.push(input);

		return runPi({
			executable,
			args,
			cwd: workspacePath,
			environment: options.environment,
			timeoutMs: options.timeoutMs ?? 120_000,
			emit,
		});
	};
}

interface RunPiOptions {
	executable: string;
	args: string[];
	cwd?: string;
	environment?: NodeJS.ProcessEnv;
	timeoutMs: number;
	emit?: (event: { name: string; status: "Running"; data?: unknown }) => void;
}

function runPi(options: RunPiOptions): Promise<PrimitiveAdapterOutput> {
	return new Promise((resolve, reject) => {
		const child = spawn(options.executable, options.args, {
			cwd: options.cwd,
			env: { ...process.env, ...options.environment },
			stdio: ["ignore", "pipe", "pipe"],
		});
		const lines: string[] = [];
		let stdoutBuffer = "";
		let stderr = "";
		let settled = false;
		const timer = setTimeout(() => {
			child.kill("SIGTERM");
			finish(new Error(`Pi timed out after ${options.timeoutMs}ms`));
		}, options.timeoutMs);

		const finish = (error?: Error): void => {
			if (settled) return;
			settled = true;
			clearTimeout(timer);
			if (error) reject(error);
		};

		child.stdout.setEncoding("utf8");
		child.stderr.setEncoding("utf8");
		child.stdout.on("data", (chunk: string) => {
			stdoutBuffer += chunk;
			const completeLines = stdoutBuffer.split("\n");
			stdoutBuffer = completeLines.pop() ?? "";
			for (const line of completeLines.filter(Boolean)) {
				lines.push(line);
				try {
					const event = JSON.parse(line) as PiEvent;
					options.emit?.({ name: event.type ?? "pi", status: "Running", data: event });
				} catch {
					// Ignore non-JSON diagnostics. The final result still uses valid events.
				}
			}
		});
		child.stderr.on("data", (chunk: string) => {
			stderr += chunk;
		});
		child.on("error", (error) => finish(error));
		child.on("close", (code) => {
			if (stdoutBuffer.trim()) lines.push(stdoutBuffer.trim());
			if (settled) return;
			if (code !== 0) {
				finish(new Error(`Pi exited with code ${code}: ${stderr.trim()}`));
				return;
			}
			try {
				const value = extractPiOutput(lines);
				clearTimeout(timer);
				settled = true;
				resolve({ value });
			} catch (error) {
				finish(error instanceof Error ? error : new Error(String(error)));
			}
		});
	});
}

function extractPiOutput(lines: readonly string[]): unknown {
	const events = lines.flatMap((line) => {
		try {
			return [JSON.parse(line) as PiEvent];
		} catch {
			return [];
		}
	});
	const text = events
		.flatMap((event) => {
			const message = event.message as { role?: string; content?: unknown } | undefined;
			if (message?.role !== "assistant" || !Array.isArray(message.content)) return [];
			return message.content.flatMap((part) =>
				part && typeof part === "object" && "text" in part && typeof part.text === "string"
					? [part.text]
					: [],
			);
		})
		.join("")
		.trim();
	if (!text) throw new Error("Pi returned no assistant output");
	const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)?.[1] ?? text;
	try {
		return JSON.parse(fenced);
	} catch {
		return text;
	}
}

export function createPiAdapters(options: PiAdapterOptions = {}): {
	readonly ai: PrimitiveAdapter;
	readonly harness: PrimitiveAdapter;
	readonly gate: PrimitiveAdapter;
} {
	const adapter = createPiAdapter(options);
	return { ai: adapter, harness: adapter, gate: adapter };
}

