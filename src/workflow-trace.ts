import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
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

export class SQLiteWorkflowTraceStore implements WorkflowTraceStore {
	private readonly database: Database;

	public constructor(databasePath = ".local-agent-factory/workflow-traces.sqlite") {
		mkdirSync(dirname(databasePath), { recursive: true });
		this.database = new Database(databasePath);
		this.database.run(`
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
