/**
 * Agent bridge — desktop host IPC for spawn / PTY / worktrees.
 * Web preview uses an honest mock; real harnesses only under Tauri.
 */

export type HostMode = "web_mock" | "tauri";

export interface SpawnRequest {
  paneId: string;
  harness: string;
  cmd: string;
  cwd: string;
  worktree?: string;
  role?: string;
  env?: Record<string, string>;
}

export interface SpawnJob {
  jobId: string;
  paneId: string;
  status: "queued" | "starting" | "running" | "exited" | "error";
  pid?: number;
  error?: string;
  host: HostMode;
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
  error?: string;
  host: HostMode;
}

type InvokeFn = (cmd: string, args?: Record<string, unknown>) => Promise<unknown>;

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
  return getTauriInvoke() || (typeof window !== "undefined" && (window as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__)
    ? "tauri"
    : "web_mock";
}

export function isDesktopHost(): boolean {
  return detectHost() === "tauri";
}

const jobs = new Map<string, SpawnJob>();
const allowedRoots = new Set<string>();

export function registerWorktreeRoot(root: string) {
  if (root?.trim()) allowedRoots.add(root.replace(/\/$/, ""));
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

export async function spawnAgent(req: SpawnRequest): Promise<SpawnJob> {
  const host = detectHost();
  const jobId = `job_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;

  if (host === "tauri") {
    try {
      const result = await invokeTauri<{ jobId: string; pid?: number }>("spawn_agent", {
        ...req,
      });
      const job: SpawnJob = {
        jobId: result.jobId ?? jobId,
        paneId: req.paneId,
        status: "running",
        pid: result.pid,
        host,
      };
      jobs.set(job.jobId, job);
      return job;
    } catch (e) {
      const job: SpawnJob = {
        jobId,
        paneId: req.paneId,
        status: "error",
        error: e instanceof Error ? e.message : String(e),
        host,
      };
      jobs.set(jobId, job);
      return job;
    }
  }

  const job: SpawnJob = {
    jobId,
    paneId: req.paneId,
    status: "running",
    host: "web_mock",
  };
  jobs.set(jobId, job);
  return job;
}

export async function killAgent(jobId: string): Promise<boolean> {
  const host = detectHost();
  if (host === "tauri") {
    try {
      await invokeTauri("kill_agent", { jobId });
      const j = jobs.get(jobId);
      if (j) j.status = "exited";
      return true;
    } catch {
      return false;
    }
  }
  const j = jobs.get(jobId);
  if (j) j.status = "exited";
  return true;
}

export async function createWorktree(req: WorktreeRequest): Promise<WorktreeResult> {
  const host = detectHost();
  registerWorktreeRoot(req.root);
  if (!isPathScoped(req.path)) {
    return { ok: false, path: req.path, error: "path_not_in_allowed_roots", host };
  }
  if (host === "tauri") {
    try {
      await invokeTauri("worktree_create", { ...req });
      return { ok: true, path: req.path, host };
    } catch (e) {
      return {
        ok: false,
        path: req.path,
        error: e instanceof Error ? e.message : String(e),
        host,
      };
    }
  }
  return { ok: true, path: req.path, host: "web_mock" };
}

export async function destroyWorktree(
  path: string,
  opts?: { force?: boolean },
): Promise<WorktreeResult> {
  const host = detectHost();
  if (!isPathScoped(path)) {
    return { ok: false, path, error: "path_not_in_allowed_roots", host };
  }
  if (host === "tauri") {
    try {
      await invokeTauri("worktree_destroy", { path, force: opts?.force ?? false });
      return { ok: true, path, destroyed: true, host };
    } catch (e) {
      return {
        ok: false,
        path,
        error: e instanceof Error ? e.message : String(e),
        host,
      };
    }
  }
  return { ok: true, path, destroyed: true, host: "web_mock" };
}

export function getJob(jobId: string): SpawnJob | undefined {
  return jobs.get(jobId);
}

export function hostBannerText(host: HostMode = detectHost()): string {
  return host === "tauri"
    ? "Desktop host — agent-bridge live"
    : "UI preview — harness spawn is mock until Tauri host";
}
