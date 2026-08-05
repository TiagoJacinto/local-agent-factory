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
} from "./workflow.ts";

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

export interface WorkflowTraceStore {
	start(trace: WorkflowTrace): void | Promise<void>;
	append(runIdentifier: string, event: WorkflowTraceEvent): void | Promise<void>;
	save(trace: WorkflowTrace): void | Promise<void>;
	get(runIdentifier: string): WorkflowTrace | undefined | Promise<WorkflowTrace | undefined>;
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
