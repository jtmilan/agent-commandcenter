/**
 * Agent bridge — desktop host IPC for spawn / PTY / worktrees.
 *
 * Web preview: honest mock PTY that emits job_id + lifecycle events.
 * Tauri host: invoke spawn_agent / kill_agent / worktree_* (see src-tauri).
 * Primary harness path: Claude Code (`claude`).
 */

import { honestTelemetry, publishStatus, type StatusSource } from "./statusBus";

export type HostMode = "web_mock" | "tauri";

export interface SpawnRequest {
  paneId: string;
  harness: string;
  cmd?: string;
  cwd: string;
  worktree?: string;
  role?: string;
  env?: Record<string, string>;
  workspaceId?: string;
}

export interface SpawnJob {
  jobId: string;
  paneId: string;
  harness: string;
  status: "queued" | "starting" | "running" | "exited" | "error";
  pid?: number;
  error?: string;
  host: HostMode;
  cmd: string;
  cwd: string;
  worktree?: string;
  workspaceId?: string;
  startedAt: string;
}

export interface WorktreeRequest {
  root: string;
  path: string;
  branch: string;
}

export interface WorktreeResult {
  ok: boolean;
  path: string;
  destroyed?: boolean;
  created?: boolean;
  error?: string;
  host: HostMode;
  detail?: string;
}

/** Host → UI events (also mirrored on status bus). */
export type HostEventKind =
  | "spawn_queued"
  | "spawn_starting"
  | "spawn_running"
  | "spawn_error"
  | "exit"
  | "needs_input"
  | "tool_fail"
  | "stdout_line"
  | "worktree_created"
  | "worktree_destroyed"
  | "worktree_error";

export interface HostEvent {
  id: string;
  at: string;
  kind: HostEventKind;
  jobId?: string;
  paneId?: string;
  workspaceId?: string;
  harness?: string;
  message: string;
  source: StatusSource;
  code?: number;
  meta?: Record<string, unknown>;
}

type InvokeFn = (cmd: string, args?: Record<string, unknown>) => Promise<unknown>;
type HostListener = (ev: HostEvent) => void;

const hostListeners = new Set<HostListener>();
const jobs = new Map<string, SpawnJob>();
const paneToJob = new Map<string, string>();
const allowedRoots = new Set<string>();
const mockTimers = new Map<string, number[]>();

function getTauriInvoke(): InvokeFn | null {
  if (typeof window === "undefined") return null;
  const w = window as Window & {
    __TAURI_INTERNALS__?: { invoke?: InvokeFn };
    __TAURI__?: {
      core?: { invoke?: InvokeFn };
      invoke?: InvokeFn;
    };
  };
  return (
    w.__TAURI__?.core?.invoke ??
    w.__TAURI__?.invoke ??
    w.__TAURI_INTERNALS__?.invoke ??
    null
  );
}

export function detectHost(): HostMode {
  if (typeof window === "undefined") return "web_mock";
  if (getTauriInvoke() || (window as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__) {
    return "tauri";
  }
  return "web_mock";
}

export function isDesktopHost(): boolean {
  return detectHost() === "tauri";
}

export function registerWorktreeRoot(root: string) {
  if (root?.trim()) allowedRoots.add(root.replace(/\/$/, ""));
}

export function getAllowedRoots(): string[] {
  return [...allowedRoots];
}

export function isPathScoped(path: string): boolean {
  if (allowedRoots.size === 0) return true;
  const norm = path.replace(/\/$/, "");
  for (const root of allowedRoots) {
    if (norm === root || norm.startsWith(`${root}/`)) return true;
  }
  return false;
}

async function invokeTauri<T>(cmd: string, args: Record<string, unknown>): Promise<T> {
  const inv = getTauriInvoke();
  if (!inv) throw new Error("Tauri invoke unavailable");
  return (await inv(cmd, args)) as T;
}

function emitHost(partial: Omit<HostEvent, "id" | "at"> & { id?: string; at?: string }): HostEvent {
  const ev: HostEvent = {
    id: partial.id ?? `he_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    at: partial.at ?? new Date().toISOString(),
    kind: partial.kind,
    jobId: partial.jobId,
    paneId: partial.paneId,
    workspaceId: partial.workspaceId,
    harness: partial.harness,
    message: partial.message,
    source: partial.source,
    code: partial.code,
    meta: partial.meta,
  };
  for (const fn of hostListeners) fn(ev);

  // Mirror onto status bus for Timeline
  const statusKind =
    ev.kind === "needs_input"
      ? "needs_input"
      : ev.kind === "tool_fail"
        ? "tool_fail"
        : ev.kind === "worktree_created" ||
            ev.kind === "worktree_destroyed" ||
            ev.kind === "worktree_error"
          ? "worktree"
          : ev.kind.startsWith("spawn") || ev.kind === "exit"
            ? "spawn"
            : "status";

  publishStatus({
    kind: statusKind,
    paneId: ev.paneId,
    workspaceId: ev.workspaceId,
    message: ev.message,
    source: ev.source,
    status:
      ev.kind === "needs_input"
        ? "needs_input"
        : ev.kind === "tool_fail"
          ? "error"
          : ev.kind === "spawn_running"
            ? "working"
            : ev.kind === "exit"
              ? "idle"
              : undefined,
    telemetry: honestTelemetry(
      ev.harness === "claude-code" || ev.harness === "claude" ? "full" : "limited",
    ),
  });

  return ev;
}

export function subscribeHostEvents(fn: HostListener): () => void {
  hostListeners.add(fn);
  return () => hostListeners.delete(fn);
}

/** Resolve CLI for harness — Claude first-class. */
export function resolveHarnessCmd(harness: string, override?: string): string {
  if (override) return override;
  const h = harness.toLowerCase();
  if (h === "claude" || h === "claude-code") return "claude";
  if (h === "cursor") return "cursor-agent";
  if (h === "codex") return "codex";
  if (h === "grok") return "grok";
  if (h === "opencode") return "opencode";
  if (h === "bash") return "bash";
  return harness;
}

function newJobId(paneId: string): string {
  return `job_${paneId}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`;
}

function clearMockTimers(jobId: string) {
  const ids = mockTimers.get(jobId);
  if (!ids) return;
  for (const t of ids) window.clearTimeout(t);
  mockTimers.delete(jobId);
}

/** Mock PTY lifecycle for UI preview — emits real-shaped events. */
function scheduleMockLifecycle(job: SpawnJob) {
  if (typeof window === "undefined") return;
  const timers: number[] = [];
  const src: StatusSource = "mock";

  timers.push(
    window.setTimeout(() => {
      job.status = "starting";
      emitHost({
        kind: "spawn_starting",
        jobId: job.jobId,
        paneId: job.paneId,
        workspaceId: job.workspaceId,
        harness: job.harness,
        message: `Starting ${job.cmd} in ${job.worktree ?? job.cwd}`,
        source: src,
      });
    }, 120),
  );

  timers.push(
    window.setTimeout(() => {
      job.status = "running";
      job.pid = 10_000 + Math.floor(Math.random() * 50_000);
      emitHost({
        kind: "spawn_running",
        jobId: job.jobId,
        paneId: job.paneId,
        workspaceId: job.workspaceId,
        harness: job.harness,
        message: `PTY running job=${job.jobId} pid=${job.pid} (${job.host})`,
        source: src,
        meta: { pid: job.pid },
      });
    }, 400),
  );

  // Claude path: occasional needs_input / tool events for demo honesty
  if (job.harness.includes("claude") || job.cmd === "claude") {
    timers.push(
      window.setTimeout(() => {
        if (job.status !== "running") return;
        emitHost({
          kind: "needs_input",
          jobId: job.jobId,
          paneId: job.paneId,
          workspaceId: job.workspaceId,
          harness: job.harness,
          message: "Claude needs approval for tool use (mock)",
          source: "hooks",
        });
      }, 4500),
    );
  } else {
    timers.push(
      window.setTimeout(() => {
        if (job.status !== "running") return;
        emitHost({
          kind: "tool_fail",
          jobId: job.jobId,
          paneId: job.paneId,
          workspaceId: job.workspaceId,
          harness: job.harness,
          message: `Tool failure on ${job.harness} (mock limited telemetry)`,
          source: "state_blind",
        });
      }, 6000),
    );
  }

  mockTimers.set(job.jobId, timers);
}

export async function spawnAgent(req: SpawnRequest): Promise<SpawnJob> {
  const host = detectHost();
  const cmd = resolveHarnessCmd(req.harness, req.cmd);
  const jobId = newJobId(req.paneId);

  const base: SpawnJob = {
    jobId,
    paneId: req.paneId,
    harness: req.harness,
    status: "queued",
    host,
    cmd,
    cwd: req.cwd,
    worktree: req.worktree,
    workspaceId: req.workspaceId,
    startedAt: new Date().toISOString(),
  };

  emitHost({
    kind: "spawn_queued",
    jobId,
    paneId: req.paneId,
    workspaceId: req.workspaceId,
    harness: req.harness,
    message: `Spawn queued: ${cmd} · ${req.harness}`,
    source: host === "tauri" ? "pty" : "mock",
  });

  if (host === "tauri") {
    try {
      const result = await invokeTauri<{
        jobId?: string;
        job_id?: string;
        pid?: number;
        status?: string;
      }>("spawn_agent", {
        paneId: req.paneId,
        harness: req.harness,
        cmd,
        cwd: req.cwd,
        worktree: req.worktree,
        role: req.role,
        env: req.env ?? {},
      });
      const jid = result.jobId ?? result.job_id ?? jobId;
      const job: SpawnJob = {
        ...base,
        jobId: jid,
        status: "running",
        pid: result.pid,
      };
      jobs.set(jid, job);
      paneToJob.set(req.paneId, jid);
      emitHost({
        kind: "spawn_running",
        jobId: jid,
        paneId: req.paneId,
        workspaceId: req.workspaceId,
        harness: req.harness,
        message: `Host PTY running job=${jid} pid=${result.pid ?? "—"}`,
        source: "pty",
        meta: { pid: result.pid },
      });
      return job;
    } catch (e) {
      const job: SpawnJob = {
        ...base,
        status: "error",
        error: e instanceof Error ? e.message : String(e),
      };
      jobs.set(jobId, job);
      emitHost({
        kind: "spawn_error",
        jobId,
        paneId: req.paneId,
        workspaceId: req.workspaceId,
        harness: req.harness,
        message: job.error ?? "spawn failed",
        source: "pty",
      });
      return job;
    }
  }

  // Web mock
  jobs.set(jobId, base);
  paneToJob.set(req.paneId, jobId);
  scheduleMockLifecycle(base);
  return base;
}

/** Convenience: spawn Claude Code for a pane. */
export async function spawnClaude(opts: {
  paneId: string;
  cwd: string;
  worktree?: string;
  role?: string;
  workspaceId?: string;
}): Promise<SpawnJob> {
  return spawnAgent({
    paneId: opts.paneId,
    harness: "claude-code",
    cmd: "claude",
    cwd: opts.cwd,
    worktree: opts.worktree,
    role: opts.role,
    workspaceId: opts.workspaceId,
  });
}

export async function killAgent(jobId: string): Promise<boolean> {
  const host = detectHost();
  const job = jobs.get(jobId);
  clearMockTimers(jobId);

  if (host === "tauri") {
    try {
      await invokeTauri("kill_agent", { jobId });
      if (job) job.status = "exited";
      emitHost({
        kind: "exit",
        jobId,
        paneId: job?.paneId,
        workspaceId: job?.workspaceId,
        harness: job?.harness,
        message: `Job ${jobId} killed`,
        source: "pty",
        code: 0,
      });
      return true;
    } catch {
      return false;
    }
  }

  if (job) job.status = "exited";
  emitHost({
    kind: "exit",
    jobId,
    paneId: job?.paneId,
    workspaceId: job?.workspaceId,
    harness: job?.harness,
    message: `Mock job ${jobId} exited`,
    source: "mock",
    code: 0,
  });
  return true;
}

export async function killPaneAgent(paneId: string): Promise<boolean> {
  const jobId = paneToJob.get(paneId);
  if (!jobId) return false;
  const ok = await killAgent(jobId);
  paneToJob.delete(paneId);
  return ok;
}

export async function createWorktree(req: WorktreeRequest): Promise<WorktreeResult> {
  const host = detectHost();
  registerWorktreeRoot(req.root);
  if (!isPathScoped(req.path)) {
    const r: WorktreeResult = {
      ok: false,
      path: req.path,
      error: "path_not_in_allowed_roots",
      host,
    };
    emitHost({
      kind: "worktree_error",
      message: `create blocked: ${req.path}`,
      source: host === "tauri" ? "git" : "mock",
    });
    return r;
  }
  if (host === "tauri") {
    try {
      await invokeTauri("worktree_create", {
        root: req.root,
        path: req.path,
        branch: req.branch,
      });
      emitHost({
        kind: "worktree_created",
        message: `Created worktree ${req.path} @ ${req.branch}`,
        source: "git",
      });
      return { ok: true, path: req.path, created: true, host };
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      emitHost({
        kind: "worktree_error",
        message: `create failed: ${error}`,
        source: "git",
      });
      return { ok: false, path: req.path, error, host };
    }
  }
  emitHost({
    kind: "worktree_created",
    message: `Mock created worktree ${req.path}`,
    source: "mock",
  });
  return { ok: true, path: req.path, created: true, host: "web_mock", detail: "mock" };
}

export async function destroyWorktree(
  path: string,
  opts?: { force?: boolean; paneId?: string },
): Promise<WorktreeResult> {
  const host = detectHost();
  if (!isPathScoped(path)) {
    emitHost({
      kind: "worktree_error",
      paneId: opts?.paneId,
      message: `destroy blocked (path scope): ${path}`,
      source: host === "tauri" ? "git" : "mock",
    });
    return { ok: false, path, error: "path_not_in_allowed_roots", host };
  }
  if (host === "tauri") {
    try {
      const detail = await invokeTauri<{ ok?: boolean; detail?: string } | void>(
        "worktree_destroy",
        {
          path,
          force: opts?.force ?? true,
        },
      );
      emitHost({
        kind: "worktree_destroyed",
        paneId: opts?.paneId,
        message: `Destroyed worktree ${path}`,
        source: "git",
        meta: detail && typeof detail === "object" ? (detail as Record<string, unknown>) : {},
      });
      return {
        ok: true,
        path,
        destroyed: true,
        host,
        detail: detail && typeof detail === "object" ? detail.detail : undefined,
      };
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      emitHost({
        kind: "worktree_error",
        paneId: opts?.paneId,
        message: `destroy failed: ${error}`,
        source: "git",
      });
      return { ok: false, path, error, host };
    }
  }
  emitHost({
    kind: "worktree_destroyed",
    paneId: opts?.paneId,
    message: `Mock destroyed worktree ${path}`,
    source: "mock",
  });
  return { ok: true, path, destroyed: true, host: "web_mock", detail: "mock_destroy" };
}

export function getJob(jobId: string): SpawnJob | undefined {
  return jobs.get(jobId);
}

export function getJobForPane(paneId: string): SpawnJob | undefined {
  const id = paneToJob.get(paneId);
  return id ? jobs.get(id) : undefined;
}

export function listJobs(): SpawnJob[] {
  return [...jobs.values()];
}

export function hostBannerText(host: HostMode = detectHost()): string {
  return host === "tauri"
    ? "Desktop host — Claude PTY + worktrees live"
    : "UI preview — Claude spawn emits mock job events until Tauri";
}
