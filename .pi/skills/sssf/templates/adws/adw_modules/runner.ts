import { AgentCall, EnvelopeBase, Phase, PhaseParams, SSSFConfig } from "./data_types";
import { Console } from "./console";
import { Tracer } from "./tracer";
import { atomicWrite, ensureDir, nowIso, redactSecrets } from "./utils";
import * as agents from "./agents";
import * as git from "./git_helper";
import { cpSync, existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { tmpdir } from "node:os";
export class PhaseHandle {
  constructor(
    public run: Run,
    public phase: Phase,
  ) {}
  log(payload: Record<string, unknown>) {
    this.run.tracer.event({
      adw_id: this.run.adwId,
      phase_id: this.phase.phaseId,
      type: "log",
      name: this.phase.params.name,
      payload,
    });
    this.run.console.note(
      Object.entries(payload)
        .map(([k, v]) => `${k}: ${v}`)
        .join(", "),
    );
    if (this.phase.params.kind === "engineer" && payload.input) {
      this.run.tracer.sessionRequest(this.run.adwId, String(payload.input));
      this.run.writeEvidence("request.json", {
        adw_id: this.run.adwId,
        request: String(payload.input),
        created_at: nowIso(),
      });
    }
  }
  async call(c: AgentCall) {
    if (this.phase.params.kind !== "agent") throw new Error("call is only valid in an agent phase");
    return this.run.executeAgentCall(this.phase, c);
  }
}
export class Run {
  phases: Phase[] = [];
  tokens = 0;
  cost = 0;
  seq: number;
  repoRoot: string;
  sourceRoot: string;
  sourceRevision = "";
  workspacePath = "";
  gitEnabled = false;
  sessionDir: string;
  contextHandoffDir: string;
  runEvidenceDir: string;
  agentMap: Record<string, any>;
  console: Console;
  private readonly abortController = new AbortController();
  private readonly timeoutTimer: ReturnType<typeof setTimeout>;
  private abortReason = "";
  private finalized = false;
  get signal() {
    return this.abortController.signal;
  }
  constructor(
    public cfg: SSSFConfig,
    public adwId: string,
    public tracer: Tracer,
    public engineer: string,
  ) {
    this.console = new Console(tracer, adwId);
    this.seq = tracer.maxPhaseSeq(adwId);
    this.sourceRoot = git.repoRoot();
    this.repoRoot = this.sourceRoot;
    this.sessionDir = resolve(cfg.defaults.data_dir, "sessions", adwId);
    this.contextHandoffDir = resolve(this.sessionDir, "context_handoff");
    this.runEvidenceDir = resolve(cfg.defaults.data_dir, "runs", adwId);
    const timeoutMs = Math.max(0, cfg.defaults.run_timeout_seconds * 1000);
    this.timeoutTimer = setTimeout(() => this.abort("whole-run timeout"), timeoutMs);
    this.timeoutTimer.unref();
    const p = `${this.sessionDir}/agent_map.json`;
    this.agentMap = {};
    if (existsSync(p))
      try {
        this.agentMap = JSON.parse(readFileSync(p, "utf8")) || {};
      } catch {
        this.agentMap = {};
      }
  }
  prepareWorkspace(expectedRevision?: string) {
    this.gitEnabled = git.isRepo(this.sourceRoot);
    ensureDir(this.contextHandoffDir);
    ensureDir(this.runEvidenceDir);
    const workspace = resolve(tmpdir(), "local-agent-factory", this.adwId);
    ensureDir(resolve(tmpdir(), "local-agent-factory"));
    if (existsSync(workspace)) rmSync(workspace, { recursive: true, force: true });
    if (this.gitEnabled) {
      const before = git.inspectSource(this.sourceRoot);
      if (before.workingTree !== "Clean")
        throw new Error("source preflight failed: working tree is dirty");
      if (expectedRevision && before.revision !== expectedRevision)
        throw new Error(
          `source preflight failed: expected ${expectedRevision}, found ${before.revision}`,
        );
      this.sourceRevision = before.revision;
      git.cloneRepository(this.sourceRoot, workspace);
      const after = git.inspectSource(this.sourceRoot);
      if (after.workingTree !== "Clean" || after.revision !== this.sourceRevision)
        throw new Error("source preflight failed: source changed during workspace creation");
      this.writeEvidence("source.json", {
        path: this.sourceRoot,
        before_revision: before.revision,
        before_working_tree: before.workingTree,
        expected_revision: this.sourceRevision,
        after_clone_revision: after.revision,
        after_clone_working_tree: after.workingTree,
        workspace,
      });
    } else {
      cpSync(this.sourceRoot, workspace, { recursive: true });
      this.writeEvidence("source.json", {
        path: this.sourceRoot,
        git: false,
        workspace,
        limitations: ["no source integrity check", "no commits", "no Git diff/change capture"],
      });
    }
    this.workspacePath = workspace;
    this.repoRoot = workspace;
    this.writeEvidence("workspace.txt", `${workspace}\n`);
  }
  writeEvidence(name: string, value: unknown) {
    const content = typeof value === "string" ? value : JSON.stringify(value, null, 2);
    return atomicWrite(resolve(this.runEvidenceDir, name), redactSecrets(content));
  }
  saveAgentMap(agent: string, entry: any) {
    this.agentMap[agent] = entry;
    writeFileSync(`${this.sessionDir}/agent_map.json`, JSON.stringify(this.agentMap, null, 2));
  }
  addUsage(tokens: number, cost: number) {
    this.tokens += tokens;
    this.cost += cost;
    this.tracer.sessionAddUsage(this.adwId, tokens, cost);
  }
  async executeAgentCall(phase: Phase, call: AgentCall): Promise<EnvelopeBase> {
    return agents.execute(this, phase, call);
  }
  abort(reason: string) {
    if (this.signal.aborted) return;
    this.abortReason = reason;
    this.abortController.abort(reason);
    this.tracer.event({
      adw_id: this.adwId,
      type: "error",
      name: "process",
      payload: { failure: reason },
    });
  }
  private finalSourceState() {
    try {
      return git.inspectSource(this.sourceRoot);
    } catch {
      return undefined;
    }
  }
  private sourceIntegrityError(state = this.finalSourceState()) {
    if (!state) return "source integrity check failed: source state is unavailable";
    if (state.revision !== this.sourceRevision || state.workingTree !== "Clean")
      return `source integrity violation: revision ${state.revision}, working tree ${state.workingTree}`;
    return undefined;
  }
  private finalize(ok: boolean, reason = "", statusOverride?: string) {
    if (this.finalized) return !reason && ok;
    this.finalized = true;
    clearTimeout(this.timeoutTimer);
    const finalSource = this.sourceRevision ? this.finalSourceState() : undefined;
    const integrityError = this.sourceRevision ? this.sourceIntegrityError(finalSource) : undefined;
    const finalReason = integrityError || this.abortReason || reason;
    const accepted =
      statusOverride === "awaiting_review"
        ? !integrityError && !this.abortReason
        : ok && !finalReason;
    const status = statusOverride || (accepted ? "success" : "fail");
    if (integrityError)
      this.tracer.event({
        adw_id: this.adwId,
        type: "error",
        name: "source_integrity",
        payload: { error: integrityError },
      });
    this.writeEvidence("result.json", {
      adw_id: this.adwId,
      status,
      reason: finalReason || undefined,
      source: {
        path: this.sourceRoot,
        expected_revision: this.sourceRevision,
        actual_revision: finalSource?.revision,
        working_tree: finalSource?.workingTree,
        workspace: this.workspacePath,
      },
      tokens: this.tokens,
      cost: this.cost,
      ended_at: nowIso(),
    });
    this.tracer.sessionFinish(this.adwId, accepted, status);
    return accepted;
  }
  fail(reason: string) {
    return this.finalize(false, reason);
  }
  awaitReview(reason = "human review required") {
    if (!this.phases.every((phase) => phase.status === "success"))
      return this.finish(false, reason);
    this.writeEvidence("review.json", {
      status: "awaiting_review",
      reason,
      workspace: this.workspacePath,
      source_revision: this.sourceRevision,
      integration: "manual",
    });
    this.tracer.event({
      adw_id: this.adwId,
      type: "log",
      name: "human_review",
      payload: {
        status: "awaiting_review",
        reason,
        workspace: this.workspacePath,
        integration: "manual",
      },
    });
    const accepted = this.finalize(true, "", "awaiting_review");
    this.console.sessionFinished(
      accepted,
      this.tokens,
      this.cost,
      this.cfg.observability.db,
      accepted ? "awaiting_review" : "fail",
    );
    return accepted ? 0 : 1;
  }
  async phase(params: PhaseParams, body: (ph: PhaseHandle) => Promise<void> | void) {
    if (this.signal.aborted) throw new Error(this.abortReason || "workflow canceled");
    if (
      !params.description.trim() ||
      params.description.trim().replace(/\.$/, "").toLowerCase() ===
        params.name.replaceAll("_", " ").toLowerCase()
    )
      throw new Error(`phase ${params.name}: description must explain what it does and why`);
    this.seq++;
    const phase: Phase = {
      phaseId: `${this.adwId}_${String(this.seq).padStart(2, "0")}_${params.name}`,
      adwId: this.adwId,
      seq: this.seq,
      params,
      status: "running",
      attempt: 0,
      startedAt: nowIso(),
    };
    this.phases.push(phase);
    this.tracer.phaseUpsert(phase);
    this.tracer.event({
      adw_id: this.adwId,
      phase_id: phase.phaseId,
      type: "phase_start",
      name: params.name,
      payload: {
        kind: params.kind,
        owner: params.owner,
        description: params.description,
      },
    });
    this.console.phaseStarted(phase);
    const start = Date.now();
    try {
      await body(new PhaseHandle(this, phase));
      if (this.signal.aborted) throw new Error(this.abortReason || "workflow canceled");
      phase.status = "success";
      phase.endedAt = nowIso();
      this.tracer.event({
        adw_id: this.adwId,
        phase_id: phase.phaseId,
        type: "phase_end",
        name: params.name,
        payload: { status: "success" },
      });
      this.tracer.phaseUpsert(phase);
      this.console.phaseEnded(phase, (Date.now() - start) / 1000);
    } catch (error) {
      phase.status = "fail";
      phase.error = String(error instanceof Error ? error.message : error).slice(0, 1000);
      phase.endedAt = nowIso();
      this.tracer.event({
        adw_id: this.adwId,
        phase_id: phase.phaseId,
        type: "error",
        name: params.name,
        payload: { error: phase.error },
      });
      this.tracer.event({
        adw_id: this.adwId,
        phase_id: phase.phaseId,
        type: "phase_end",
        name: params.name,
        payload: { status: "fail" },
      });
      this.tracer.phaseUpsert(phase);
      this.fail(phase.error);
      this.console.phaseEnded(phase, (Date.now() - start) / 1000);
      this.console.sessionFinished(false, this.tokens, this.cost, this.cfg.observability.db);
      throw error;
    }
  }
  finish(accepted = true, reason = "") {
    const phasesOk = this.phases.every((phase) => phase.status === "success");
    const ok = this.finalize(
      phasesOk && accepted,
      reason || (!phasesOk ? "one or more phases failed" : ""),
    );
    if (reason && !ok) this.console.note(reason);
    this.console.sessionFinished(ok, this.tokens, this.cost, this.cfg.observability.db);
    return ok ? 0 : 1;
  }
}
