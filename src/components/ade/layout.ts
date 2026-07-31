/**
 * Sub-linear workspace + pane layout engine
 * -----------------------------------------
 * Goal: keep the open-pane surface usable as fleet size grows.
 * A flat N-cell grid is O(N) screen cost — every new agent shrinks every tile.
 *
 * Sub-linear packing (SL-1):
 *   visible surface cost ≈ O(P + log N + A)
 *   where P = pinned panes (explicit + coordinator default)
 *         A = attention panes (needs_input | blocked | error)
 *         N = total panes in the workspace
 *
 * Strategy:
 *   1. PIN column (left)  — all pinned panes, always fully open. O(P).
 *   2. FOCUS grid (right) — attention + selected + recent workers, capped.
 *   3. STACK strip        — remaining panes as compact chips (overflow).
 *                           Opening a chip promotes it into FOCUS.
 *
 * Workspace sub-structure (WS-sub):
 *   Workspaces may declare `parentId` → tree of projects.
 *   Layout runs per leaf workspace; parent rows only aggregate counts.
 *   Switching a parent focuses its first child with open panes.
 */

import type { Pane, PaneStatus, Role, Workspace } from "./types";

export const FOCUS_CAP = 4; // max non-pin tiles fully open at once

export type LayoutBand = "pin" | "focus" | "stack";

export interface LayoutSlot {
  pane: Pane;
  band: LayoutBand;
  /** Why this pane is in pin/focus (for HUD / debug) */
  reason: string;
}

export interface WorkspaceLayout {
  workspaceId: string;
  pins: LayoutSlot[];
  focus: LayoutSlot[];
  stack: LayoutSlot[];
  /** Estimated visual cost metric (lower is better) */
  surfaceCost: number;
  /** Human-readable pack summary */
  summary: string;
}

const ATTENTION: PaneStatus[] = ["needs_input", "blocked", "error"];

function isAttention(p: Pane): boolean {
  return ATTENTION.includes(p.status);
}

function rolePinDefault(role: Role): boolean {
  return role === "coordinator";
}

/**
 * Decide pin set:
 *  - explicit `pane.pinned === true`
 *  - OR coordinator role when no explicit pins exist (auto pin)
 *  - never more than half the fleet auto-pinned
 */
export function resolvePins(panes: Pane[]): Pane[] {
  const explicit = panes.filter((p) => p.pinned);
  if (explicit.length > 0) return explicit;

  const coords = panes.filter((p) => rolePinDefault(p.role));
  if (coords.length > 0) return coords.slice(0, Math.max(1, Math.floor(panes.length / 2)));

  // Fallback: first pane so the left column is never empty when fleet > 0
  return panes[0] ? [panes[0]] : [];
}

/**
 * Sub-linear pack for one workspace.
 * order[] is manual priority among non-pinned panes (user drag).
 */
export function packWorkspace(
  panes: Pane[],
  order: string[],
  selectedId: string | null,
  focusCap: number = FOCUS_CAP,
): WorkspaceLayout {
  if (panes.length === 0) {
    return {
      workspaceId: "",
      pins: [],
      focus: [],
      stack: [],
      surfaceCost: 0,
      summary: "empty",
    };
  }

  const byId = new Map(panes.map((p) => [p.id, p]));
  const orderedIds = [
    ...order.filter((id) => byId.has(id)),
    ...panes.map((p) => p.id).filter((id) => !order.includes(id)),
  ];

  const pinSet = new Set(resolvePins(panes).map((p) => p.id));
  const pins: LayoutSlot[] = orderedIds
    .filter((id) => pinSet.has(id))
    .map((id) => {
      const pane = byId.get(id)!;
      return {
        pane,
        band: "pin" as const,
        reason: pane.pinned
          ? "user-pin"
          : pane.role === "coordinator"
            ? "auto-coordinator"
            : "auto-primary",
      };
    });

  // Candidates for focus: not pinned, ordered by attention > selected > order
  const rest = orderedIds
    .filter((id) => !pinSet.has(id))
    .map((id) => byId.get(id)!)
    .sort((a, b) => scoreFocus(b, selectedId) - scoreFocus(a, selectedId));

  const focusPanes = rest.slice(0, focusCap);
  const stackPanes = rest.slice(focusCap);

  const focus: LayoutSlot[] = focusPanes.map((pane) => ({
    pane,
    band: "focus",
    reason: isAttention(pane)
      ? "attention"
      : pane.id === selectedId
        ? "selected"
        : "active-worker",
  }));

  const stack: LayoutSlot[] = stackPanes.map((pane) => ({
    pane,
    band: "stack",
    reason: "overflow-stack",
  }));

  // O(P + min(F, N-P) + 1) — stack is one strip regardless of length
  const surfaceCost = pins.length + focus.length + (stack.length > 0 ? 1 : 0);

  return {
    workspaceId: panes[0]!.workspaceId,
    pins,
    focus,
    stack,
    surfaceCost,
    summary: `${pins.length} pin · ${focus.length} focus · ${stack.length} stacked (cost ${surfaceCost} vs flat ${panes.length})`,
  };
}

function scoreFocus(p: Pane, selectedId: string | null): number {
  let s = 0;
  if (p.status === "error") s += 400;
  if (p.status === "needs_input") s += 300;
  if (p.status === "blocked") s += 200;
  if (p.status === "working") s += 50;
  if (p.id === selectedId) s += 80;
  return s;
}

/** Promote a stacked pane into focus (and demote lowest-score focus if over cap). */
export function promoteFromStack(
  layout: WorkspaceLayout,
  paneId: string,
  focusCap: number = FOCUS_CAP,
): string[] {
  const all = [...layout.pins, ...layout.focus, ...layout.stack].map((s) => s.pane);
  const order = [
    ...layout.pins.map((s) => s.pane.id),
    paneId,
    ...layout.focus.map((s) => s.pane.id).filter((id) => id !== paneId),
    ...layout.stack.map((s) => s.pane.id).filter((id) => id !== paneId),
  ];
  // Re-pack will pick top focusCap by score; bump by putting promoted first among non-pins
  void focusCap;
  void all;
  return order;
}

/** Workspace tree: roots first, children nested */
export function workspaceTree(workspaces: Workspace[]): {
  root: Workspace;
  children: Workspace[];
}[] {
  const roots = workspaces.filter((w) => !w.parentId);
  const byParent = new Map<string, Workspace[]>();
  for (const w of workspaces) {
    if (!w.parentId) continue;
    const list = byParent.get(w.parentId) ?? [];
    list.push(w);
    byParent.set(w.parentId, list);
  }
  // Orphan sub-workspaces (parent missing) treated as roots
  const rootIds = new Set(roots.map((r) => r.id));
  for (const w of workspaces) {
    if (w.parentId && !rootIds.has(w.parentId) && !roots.find((r) => r.id === w.id)) {
      roots.push(w);
    }
  }
  return roots.map((root) => ({
    root,
    children: byParent.get(root.id) ?? [],
  }));
}

export function layoutMathBlurb(n: number, cost: number): string {
  if (n === 0) return "No panes — surface cost 0";
  const saved = n - cost;
  return `Flat grid would open ${n} tiles. Sub-linear pack opens ${cost} (saves ${saved}). Stack grows free.`;
}
