/**
 * Honest status bus — pane events with source provenance.
 * Never invent "live" for state_blind harnesses.
 */

import type { PaneStatus, TelemetryState } from "../components/ade/types";

export type StatusSource =
  | "hooks"
  | "pty"
  | "git"
  | "cli"
  | "state_blind"
  | "mock"
  | "operator";

export interface StatusEvent {
  id: string;
  at: string;
  paneId?: string;
  workspaceId?: string;
  kind:
    | "spawn"
    | "status"
    | "tool_fail"
    | "needs_input"
    | "merge"
    | "worktree"
    | "credit"
    | "mission"
    | "conflict"
    | "runbook"
    | "system";
  message: string;
  source: StatusSource;
  status?: PaneStatus;
  telemetry?: TelemetryState;
}

type Listener = (ev: StatusEvent) => void;

const listeners = new Set<Listener>();
const history: StatusEvent[] = [];
const MAX = 400;

export function subscribeStatus(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function publishStatus(
  partial: Omit<StatusEvent, "id" | "at"> & { id?: string; at?: string },
): StatusEvent {
  const ev: StatusEvent = {
    id: partial.id ?? `ev_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    at: partial.at ?? new Date().toISOString(),
    paneId: partial.paneId,
    workspaceId: partial.workspaceId,
    kind: partial.kind,
    message: partial.message,
    source: partial.source,
    status: partial.status,
    telemetry: partial.telemetry,
  };
  history.unshift(ev);
  if (history.length > MAX) history.length = MAX;
  for (const fn of listeners) fn(ev);
  return ev;
}

export function getStatusHistory(limit = 100): StatusEvent[] {
  return history.slice(0, limit);
}

export function clearStatusHistory() {
  history.length = 0;
}

/** Map harness telemetry capability → honest TelemetryState */
export function honestTelemetry(
  capability: "full" | "limited" | "none" | undefined,
  opts?: { ageMs?: number },
): TelemetryState {
  if (capability === "none" || capability === undefined) return "state_blind";
  if (capability === "limited") return "state_blind";
  const age = opts?.ageMs ?? 0;
  if (age > 60_000) return "stale";
  return "live";
}
