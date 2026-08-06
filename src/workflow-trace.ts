import { createRequire } from "node:module";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type {
	Artifact,
	InvocationStatus,
	ValidationResult,
	WorkflowEnvelope,
	WorkflowFailure,
	WorkflowFailureEvidence,
	WorkflowStatus,
} from "./workflow.js";

export type WorkflowTraceEventKind =
	| "phase"
	| "primitive"
	| "tool_call"
	| "validation"
	| "envelope"
	| "artifact"
	| "process";

export interface WorkflowTraceEvent {
	sequence: number;
	kind: WorkflowTraceEventKind;
	name: string;
	status: InvocationStatus | ValidationResult["status"] | WorkflowStatus;
	data?: unknown;
}

export interface WorkflowTrace {
	runIdentifier: string;
	workflowId: string;
	status: WorkflowStatus;
	events: WorkflowTraceEvent[];
	validationResults: ValidationResult[];
	envelopes: WorkflowEnvelope[];
	artifacts: Artifact[];
	workspacePath?: string;
	workspaceDisposition?: "Retained";
	failure?: WorkflowFailure;
	failureEvidence?: WorkflowFailureEvidence;
}

export const DEFAULT_WORKFLOW_TRACE_DATABASE_PATH =
	".local-agent-factory/workflow-traces.sqlite";

export interface WorkflowTraceStore {
	start(trace: WorkflowTrace): void | Promise<void>;
	append(runIdentifier: string, event: WorkflowTraceEvent): void | Promise<void>;
	save(trace: WorkflowTrace): void | Promise<void>;
	get(runIdentifier: string): WorkflowTrace | undefined | Promise<WorkflowTrace | undefined>;
}

function escapeHtml(value: string): string {
	return value.replace(/[&<>"']/g, (character) => {
		const entities: Record<string, string> = {
			"&": "&amp;",
			"<": "&lt;",
			">": "&gt;",
			'"': "&quot;",
			"'": "&#39;",
		};
		return entities[character];
	});
}

function renderValue(value: unknown): string {
	if (typeof value === "string") return escapeHtml(value);
	return escapeHtml(JSON.stringify(value, null, 2) ?? "");
}

function renderList(items: readonly string[]): string {
	if (items.length === 0) return "<p>None</p>";
	return `<ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
}

/** Render a read-only, standalone HTML view of one workflow trace. */
export function renderWorkflowTrace(trace: WorkflowTrace): string {
	const events = trace.events.length
		? trace.events
				.map(
					(event) =>
						`<li><strong>${event.sequence}. ${escapeHtml(event.name)}</strong> ` +
						`<span class="status">${escapeHtml(event.status)}</span> ` +
						`<span>${escapeHtml(event.kind)}</span>` +
						(event.data === undefined ? "" : `<pre>${renderValue(event.data)}</pre>`),
				)
					.join("")
			: "<li>No activity recorded.</li>";
	const validations = trace.validationResults.length
		? trace.validationResults
				.map(
					(result) =>
						`<article><h3>${escapeHtml(result.operation)}</h3>` +
						`<p><span class="status">${escapeHtml(result.status)}</span> ` +
						`${escapeHtml(result.command)} (exit ${result.evidence.exitCode})</p>` +
						`<pre>${escapeHtml(result.evidence.output)}</pre></article>`,
				)
					.join("")
			: "<p>No validation results.</p>";
	const envelopes = trace.envelopes.length
		? trace.envelopes
				.map(
					(envelope) =>
						`<article><h3>${escapeHtml(envelope.producer)} → ${escapeHtml(envelope.consumer)}</h3>` +
						`<p><span class="status">${escapeHtml(envelope.status)}</span> ` +
						`${escapeHtml(envelope.summary ?? envelope.objective)}</p>` +
						`<h4>Acceptance criteria</h4>${renderList(envelope.acceptanceCriteria)}</article>`,
				)
					.join("")
			: "<p>No envelopes.</p>";
	const artifacts = trace.artifacts.length
		? trace.artifacts
				.map(
					(artifact) =>
						`<article><h3>${escapeHtml(artifact.id)}</h3>` +
						`<p>${escapeHtml(artifact.producerInvocationId)} → ` +
						`${escapeHtml(artifact.consumerInvocationId ?? "unconsumed")}</p>` +
						(artifact.reference ? `<p>Reference: ${escapeHtml(artifact.reference)}</p>` : "") +
						`<pre>${renderValue(artifact.value)}</pre></article>`,
				)
					.join("")
			: "<p>No artifacts.</p>";
	const failure = trace.failure
		? `<section><h2>Failure evidence</h2><p>${escapeHtml(trace.failure)}</p>` +
				(trace.failureEvidence
					? `<p>${escapeHtml(trace.failureEvidence.message)}</p>` +
						(trace.failureEvidence.output === undefined
							? ""
							: `<pre>${renderValue(trace.failureEvidence.output)}</pre>`)
					: "") +
				"</section>"
		: "";

	return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Workflow trace ${escapeHtml(trace.runIdentifier)}</title>
<style>
:root{font-family:system-ui,sans-serif;color:#17202a;background:#f5f7fa}body{max-width:960px;margin:2rem auto;padding:0 1rem}section,article{background:white;border:1px solid #d9e1e8;border-radius:8px;padding:1rem;margin:1rem 0}h1,h2,h3{margin-top:0}.status{font-weight:700}.meta{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:.75rem}.meta strong{display:block}pre{overflow:auto;background:#f0f3f6;padding:.75rem;border-radius:4px;white-space:pre-wrap}
</style></head>
<body>
<header><h1>Workflow trace</h1><div class="meta"><p><strong>Run</strong>${escapeHtml(trace.runIdentifier)}</p><p><strong>Workflow</strong>${escapeHtml(trace.workflowId)}</p><p><strong>Status</strong><span class="status">${escapeHtml(trace.status)}</span></p>${trace.workspacePath ? `<p><strong>Workspace</strong>${escapeHtml(trace.workspacePath)}${trace.workspaceDisposition ? ` (${escapeHtml(trace.workspaceDisposition)})` : ""}</p>` : ""}</div></header>
<section><h2>Activity</h2><ol>${events}</ol></section>
<section><h2>Validation evidence</h2>${validations}</section>
<section><h2>Envelopes</h2>${envelopes}</section>
<section><h2>Artifacts</h2>${artifacts}</section>
${failure}
</body></html>`;
}

interface SQLiteDatabase {
	run(sql: string): void;
	prepare(sql: string): {
		run(parameters: Record<string, string>): void;
		get(parameters: Record<string, string>): unknown;
	};
}

const require = createRequire(import.meta.url);

function openSQLiteDatabase(path: string): SQLiteDatabase | undefined {
	try {
		const sqlite = require("bun:sqlite") as {
			Database?: new (databasePath: string) => SQLiteDatabase;
		};
		return sqlite.Database ? new sqlite.Database(path) : undefined;
	} catch {
		return undefined;
	}
}

export class SQLiteWorkflowTraceStore implements WorkflowTraceStore {
	private readonly database?: SQLiteDatabase;
	private readonly databasePath: string;

	public constructor(databasePath = ".local-agent-factory/workflow-traces.sqlite") {
		mkdirSync(dirname(databasePath), { recursive: true });
		this.databasePath = databasePath;
		this.database = openSQLiteDatabase(databasePath);
		this.database?.run(`
			CREATE TABLE IF NOT EXISTS workflow_traces (
				run_identifier TEXT PRIMARY KEY,
				trace_json TEXT NOT NULL
			)
		`);
	}

	public start(trace: WorkflowTrace): void {
		this.save(trace);
	}

	public append(runIdentifier: string, event: WorkflowTraceEvent): void {
		const existing = this.get(runIdentifier);
		if (!existing) throw new Error(`Workflow trace not found: ${runIdentifier}`);
		existing.events.push(event);
		this.save(existing);
	}

	public save(trace: WorkflowTrace): void {
		if (!this.database) {
			const traces = this.readFallbackTraces();
			traces[trace.runIdentifier] = trace;
			writeFileSync(this.databasePath, JSON.stringify(traces, null, 2));
			return;
		}
		this.database
			.prepare(
				`INSERT INTO workflow_traces (run_identifier, trace_json)
				 VALUES ($runIdentifier, $trace)
				 ON CONFLICT(run_identifier) DO UPDATE SET trace_json = excluded.trace_json`,
			)
			.run({
				$runIdentifier: trace.runIdentifier,
				$trace: JSON.stringify(trace),
			});
	}

	public get(runIdentifier: string): WorkflowTrace | undefined {
		if (!this.database) {
			const trace = this.readFallbackTraces()[runIdentifier];
			return trace ? structuredClone(trace) : undefined;
		}
		const row = this.database
			.prepare("SELECT trace_json FROM workflow_traces WHERE run_identifier = $runIdentifier")
			.get({ $runIdentifier: runIdentifier }) as { trace_json: string } | null;
		if (!row) return undefined;
		try {
			return JSON.parse(row.trace_json) as WorkflowTrace;
		} catch {
			return undefined;
		}
	}

	private readFallbackTraces(): Record<string, WorkflowTrace> {
		try {
			return JSON.parse(readFileSync(this.databasePath, "utf8")) as Record<string, WorkflowTrace>;
		} catch {
			return {};
		}
	}
}

export class InMemoryWorkflowTraceStore implements WorkflowTraceStore {
	private readonly traces = new Map<string, WorkflowTrace>();

	public start(trace: WorkflowTrace): void {
		this.save(trace);
	}

	public append(runIdentifier: string, event: WorkflowTraceEvent): void {
		const trace = this.traces.get(runIdentifier);
		if (!trace) throw new Error(`Workflow trace not found: ${runIdentifier}`);
		trace.events.push(event);
	}

	public save(trace: WorkflowTrace): void {
		this.traces.set(trace.runIdentifier, structuredClone(trace));
	}

	public get(runIdentifier: string): WorkflowTrace | undefined {
		const trace = this.traces.get(runIdentifier);
		return trace ? structuredClone(trace) : undefined;
	}

	public latestRunIdentifier(): string | undefined {
		return [...this.traces.keys()].at(-1);
	}
}
