import { existsSync, readFileSync } from "node:fs";
import {
	AgentCall,
	AgentConfig,
	EnvelopeBase,
	Phase,
	PiRequest,
	SSSFConfig,
} from "./data_types";
import * as pi from "./agent_pi";
import * as prompts from "./prompts";
import { newId } from "./utils";
import { snapshot, enforce } from "./permissions";

export function loadConfig(
	path = "adws/adw_sssf_config/sssf.config.yaml",
): SSSFConfig {
	const raw: any = Bun.YAML.parse(readFileSync(path, "utf8")) || {};
	const d = raw.defaults || {};
	const defaults = {
		coding_agent: d.coding_agent || "pi",
		model: d.model || "openrouter/google/gemini-3.6-flash",
		thinking: d.thinking || "medium",
		color: d.color || "",
		harness_engineering: d.harness_engineering || [],
		tools: d.tools ?? null,
		protected_files: d.protected_files || [
			"adws/adw_modules/",
			"adws/adw_sssf_config/",
			"adws/adw_*.ts",
		],
		data_dir: d.data_dir || "adws/adw_data",
		allowed_env: d.allowed_env || [],
		harness_timeout_seconds: Number(d.harness_timeout_seconds || 600),
		run_timeout_seconds: Number(d.run_timeout_seconds || 3600),
		max_output_bytes: Number(d.max_output_bytes || 1_000_000),
	};
	const agents = (raw.agents || []).map((a: any) => ({
		...a,
		coding_agent: a.coding_agent ?? defaults.coding_agent,
		model: a.model ?? defaults.model,
		thinking: a.thinking ?? defaults.thinking,
		color: a.color ?? defaults.color,
		tools: a.tools ?? defaults.tools,
		harness_engineering: a.harness_engineering ?? defaults.harness_engineering,
		writes: a.writes === undefined ? null : a.writes,
		allowed_env: a.allowed_env ?? defaults.allowed_env,
	}));
	return {
		defaults,
		observability: {
			db: raw.observability?.db || "adws/adw_data/sssf.db",
			poll_ms: raw.observability?.poll_ms || 500,
		},
		agents,
	};
}

export function resolveAgent(cfg: SSSFConfig, name: string) {
	const agent = cfg.agents.find((x) => x.name === name);
	if (!agent)
		throw new Error(
			`agent ${name} is not defined in config — available: ${cfg.agents.map((x) => x.name).join(", ")}`,
		);
	return agent;
}

export function validate(cfg: SSSFConfig, required: string[]) {
	const problems: string[] = [];
	for (const name of required) {
		let agent: AgentConfig;
		try {
			agent = resolveAgent(cfg, name);
		} catch (error) {
			problems.push(String(error));
			continue;
		}
		if (agent.coding_agent !== "pi")
			problems.push(
				`agent ${name}: coding_agent ${agent.coding_agent} is not implemented (pi only)`,
			);
		for (const [label, path] of [
			["system", agent.prompt_engineering.system],
			["user", agent.prompt_engineering.user],
		] as const)
			if (!existsSync(path))
				problems.push(`agent ${name}: ${label} prompt not found: ${path}`);
		try {
			const [provider] = pi.resolveModel(agent.model);
			pi.assertCredential(provider);
		} catch (error) {
			problems.push(`agent ${name}: ${error}`);
		}
	}
	if (problems.length)
		throw new Error(`config validation failed:\n- ${problems.join("\n- ")}`);
}

function sessionId(run: any, agent: AgentConfig) {
	const old = run.agentMap[agent.name];
	if (old?.session_id && old.model === agent.model) return old.session_id;
	const id = newId(12);
	run.saveAgentMap(agent.name, {
		session_id: id,
		agent: agent.name,
		model: agent.model,
	});
	return id;
}

export async function execute(
	run: any,
	phase: Phase,
	call: AgentCall,
): Promise<EnvelopeBase> {
	const agent = resolveAgent(run.cfg, phase.params.owner);
	const dir = `${run.sessionDir}/${agent.name}`;
	const sid = sessionId(run, agent);
	const vars = {
		prompt: call.prompt,
		previous_envelope: call.previous
			? JSON.stringify(call.previous, null, 2)
			: "(none)",
		context_handoff_dir: run.contextHandoffDir,
	};
	const system = prompts.render(agent.prompt_engineering.system, vars);
	const user = prompts.render(agent.prompt_engineering.user, vars);
	prompts.save(`${dir}/prompts`, "system.md", system);
	prompts.save(`${dir}/prompts`, "user.md", user);
	run.tracer.event({
		adw_id: run.adwId,
		phase_id: phase.phaseId,
		type: "agent_start",
		name: agent.name,
		payload: {
			model: agent.model,
			thinking: agent.thinking,
			session_id: sid,
			coding_agent: agent.coding_agent,
			purpose: agent.purpose,
			tools: agent.tools,
			harness_engineering: agent.harness_engineering,
		},
	});
	run.console.agentStarted(agent.name, agent.model, sid);
	const before = snapshot(run);
	const attempts = (phase.params.retries || 0) + 1;
	const tracker = new pi.ToolCallTracker();
	let last: any;
	let correction = "";
	for (let i = 0; i < attempts * 2; i++) {
		const request: PiRequest = {
			prompt: correction || user,
			systemPrompt: system,
			model: agent.model,
			thinking: agent.thinking,
			sessionId: sid,
			sessionDir: `${run.sessionDir}/${agent.name}`,
			rawOutputPath: `${run.sessionDir}/${agent.name}/raw_output.jsonl`,
			stderrPath: `${run.sessionDir}/${agent.name}/stderr.log`,
			tools: agent.tools,
			extensions: agent.harness_engineering,
			cwd: run.repoRoot,
			allowedEnv: agent.allowed_env,
			timeoutMs: run.cfg.defaults.harness_timeout_seconds * 1000,
			maxOutputBytes: run.cfg.defaults.max_output_bytes,
			signal: run.signal,
		};
		last = await pi.run(
			request,
			(e) => {
				const toolCall = tracker.observe(e);
				if (toolCall)
					run.tracer.event({
						adw_id: run.adwId,
						phase_id: phase.phaseId,
						type: "tool_call",
						name: toolCall.label,
						payload: toolCall,
						started_at: toolCall.started_at,
						ended_at: toolCall.ended_at,
					});
			},
			(pid) =>
				run.tracer.processStart(
					run.adwId,
					"agent",
					agent.name,
					pid,
					`pi ${agent.model}`,
				),
			(pid) => run.tracer.processEnd(pid),
		);
		run.addUsage(last.tokens, last.cost);
		let parsed: any;
		try {
			const raw = last.text.match(/\{[\s\S]*\}/)?.[0] || last.text;
			parsed = JSON.parse(raw);
			const env = (await import("./data_types")).envelope(
				call.outputType,
				parsed,
			);
			run.tracer.envelope(
				run.adwId,
				phase.phaseId,
				agent.name,
				call.outputType,
				env,
				true,
				i + 1,
			);
			for (const gate of call.gates) {
				const report = gate(env, run);
				run.tracer.gate(
					run.adwId,
					phase.phaseId,
					i + 1,
					gate.name || "gate",
					report,
				);
				if (!report.passed) throw new Error(report.violations.join("; "));
			}
			enforce(run, before, agent, env);
			run.tracer.event({
				adw_id: run.adwId,
				phase_id: phase.phaseId,
				type: "handoff",
				name: agent.name,
				payload: {
					output_type: call.outputType,
					artifacts: env.artifacts || [],
					summary: env.summary || "",
				},
			});
			run.tracer.event({
				adw_id: run.adwId,
				phase_id: phase.phaseId,
				type: "agent_end",
				name: agent.name,
				payload: {
					status: "success",
					tokens: last.tokens,
					cost: last.cost,
					context_tokens: last.context_tokens,
					context_window: last.context_window,
				},
			});
			run.tracer.agentSession(
				run.adwId,
				agent,
				sid,
				last.context_tokens,
				last.context_window,
			);
			await Bun.write(
				`${run.sessionDir}/${agent.name}/envelope.json`,
				JSON.stringify(env, null, 2),
			);
			run.console.agentFinished(agent.name, last.tokens, last.cost);
			return env;
		} catch (error) {
			run.tracer.envelope(
				run.adwId,
				phase.phaseId,
				agent.name,
				call.outputType,
				{ error: String(error) },
				false,
				i + 1,
			);
			correction = `Correction: your previous response failed validation: ${String(error)}. Return only valid JSON matching ${call.outputType}.\n${call.prompt}`;
			if (i + 1 >= attempts * 2) throw error;
		}
	}
	throw new Error("agent execution failed");
}
