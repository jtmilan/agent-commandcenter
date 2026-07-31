/**
 * Merge gate checklist + multi-agent conflict resolution
 * ----------------------------------------------------
 * Gate is a *read-only dry-run* until a real `merge_lanes` bridge exists.
 * Severity: block | warn | info
 *
 * Conflict classes (multi-agent):
 *   PATH   — two+ non-coord agents claim overlapping ownedPaths
 *   BRANCH — two builders on the same branch name (worktree collision risk)
 *   ATTENTION — open needs_input / blocked / error
 *   DIRTY  — git working tree not clean
 *   ROLE   — missing coordinator or multiple coordinators
 *   TELEMETRY — state_blind builders with no attention signal (info only)
 *   MCP    — role policy tools / forbidden servers / drift
 */

import { evaluateMcpPolicies, type McpPolicyIssue } from "./mcpConfig";
import type { Pane, Role, Workspace } from "./types";

export type GateSeverity = "block" | "warn" | "info";
export type GateCheckId =
  | "coord_present"
  | "coord_single"
  | "attention_clear"
  | "worktrees_clean"
  | "path_collisions"
  | "branch_collisions"
  | "builders_unblocked"
  | "lane_coverage"
  | "telemetry_honesty"
  | "mcp_required"
  | "mcp_forbidden"
  | "mcp_health";

export type ConflictKind = "path" | "branch" | "attention" | "dirty" | "role" | "telemetry" | "mcp";

export interface PathConflict {
  kind: "path";
  path: string;
  owners: { id: string; name: string; role: Role; workspaceId: string }[];
  resolveHint: string;
}

export interface BranchConflict {
  kind: "branch";
  branch: string;
  panes: { id: string; name: string; worktree: string }[];
  resolveHint: string;
}

export interface AttentionConflict {
  kind: "attention";
  paneId: string;
  name: string;
  status: Pane["status"];
  detail: string;
  resolveHint: string;
}

export interface DirtyConflict {
  kind: "dirty";
  paneId: string;
  name: string;
  branch: string;
  worktree: string;
  resolveHint: string;
}

export interface RoleConflict {
  kind: "role";
  issue: "missing_coordinator" | "multiple_coordinators";
  panes: { id: string; name: string }[];
  resolveHint: string;
}

export interface TelemetryNote {
  kind: "telemetry";
  paneId: string;
  name: string;
  harness: string;
  resolveHint: string;
}

export interface McpConflict {
  kind: "mcp";
  issue: McpPolicyIssue;
  resolveHint: string;
}

export type AgentConflict =
  | PathConflict
  | BranchConflict
  | AttentionConflict
  | DirtyConflict
  | RoleConflict
  | TelemetryNote
  | McpConflict;

export interface GateCheck {
  id: GateCheckId;
  label: string;
  severity: GateSeverity;
  ok: boolean;
  detail: string;
  related: string[];
  remediation: string;
}

export interface MergeGateReport {
  generatedAt: string;
  workspaceFocus?: string;
  paneCount: number;
  checks: GateCheck[];
  conflicts: AgentConflict[];
  canMergeDryRun: boolean;
  dryRunSummary: string;
  mergePlan: string[];
  mcpIssues: McpPolicyIssue[];
}

function pathKey(p: string) {
  return p.replace(/\/+$/, "").replace(/\/\*\*$/, "/**").toLowerCase();
}

export function pathsOverlap(a: string, b: string): boolean {
  const x = pathKey(a);
  const y = pathKey(b);
  if (x === y) return true;
  const strip = (s: string) => s.replace(/\/\*\*$/, "").replace(/\*$/, "");
  const xs = strip(x);
  const ys = strip(y);
  return xs.startsWith(ys + "/") || ys.startsWith(xs + "/") || xs === ys;
}

export function detectPathConflicts(panes: Pane[]): PathConflict[] {
  const entries: { path: string; pane: Pane }[] = [];
  for (const pane of panes) {
    for (const path of pane.ownedPaths ?? []) {
      entries.push({ path, pane });
    }
  }
  const groups = new Map<string, Pane[]>();
  for (let i = 0; i < entries.length; i++) {
    for (let j = i + 1; j < entries.length; j++) {
      const a = entries[i]!;
      const b = entries[j]!;
      if (a.pane.id === b.pane.id) continue;
      if (!pathsOverlap(a.path, b.path)) continue;
      const key =
        pathKey(a.path) === pathKey(b.path)
          ? pathKey(a.path)
          : `${pathKey(a.path)} ∩ ${pathKey(b.path)}`;
      const list = groups.get(key) ?? [];
      if (!list.find((p) => p.id === a.pane.id)) list.push(a.pane);
      if (!list.find((p) => p.id === b.pane.id)) list.push(b.pane);
      groups.set(key, list);
    }
  }
  return [...groups.entries()]
    .filter(([, owners]) => owners.length > 1)
    .map(([path, owners]) => ({
      kind: "path" as const,
      path,
      owners: owners.map((p) => ({
        id: p.id,
        name: p.name,
        role: p.role,
        workspaceId: p.workspaceId,
      })),
      resolveHint:
        "Reassign ownedPaths so only one builder owns each glob; coordinator keeps docs/** only.",
    }));
}

export function detectBranchConflicts(panes: Pane[]): BranchConflict[] {
  const byBranch = new Map<string, Pane[]>();
  for (const p of panes) {
    if (p.role === "coordinator") continue;
    const list = byBranch.get(p.branch) ?? [];
    list.push(p);
    byBranch.set(p.branch, list);
  }
  return [...byBranch.entries()]
    .filter(([, list]) => list.length > 1)
    .map(([branch, list]) => ({
      kind: "branch" as const,
      branch,
      panes: list.map((p) => ({ id: p.id, name: p.name, worktree: p.worktree })),
      resolveHint: "Each builder should use a unique lane branch before merge.",
    }));
}

export function detectAttentionConflicts(panes: Pane[]): AttentionConflict[] {
  return panes
    .filter(
      (p) =>
        p.status === "needs_input" ||
        p.status === "blocked" ||
        p.status === "error" ||
        Boolean(p.lastToolFailure),
    )
    .map((p) => ({
      kind: "attention" as const,
      paneId: p.id,
      name: p.name,
      status: p.status,
      detail: p.attention ?? p.lastToolFailure ?? p.status,
      resolveHint:
        p.status === "needs_input"
          ? "Reply from Attention inbox, then re-run gate."
          : "Unblock or clear error before merge.",
    }));
}

export function detectDirtyConflicts(panes: Pane[]): DirtyConflict[] {
  return panes
    .filter((p) => p.gitClean === false)
    .map((p) => ({
      kind: "dirty" as const,
      paneId: p.id,
      name: p.name,
      branch: p.branch,
      worktree: p.worktree,
      resolveHint: "Commit or stash before destroy/merge.",
    }));
}

export function detectRoleConflicts(panes: Pane[]): RoleConflict[] {
  const coords = panes.filter((p) => p.role === "coordinator");
  if (coords.length === 0 && panes.length > 0) {
    return [
      {
        kind: "role",
        issue: "missing_coordinator",
        panes: [],
        resolveHint: "Spawn or promote a coordinator before merge.",
      },
    ];
  }
  if (coords.length > 1) {
    return [
      {
        kind: "role",
        issue: "multiple_coordinators",
        panes: coords.map((p) => ({ id: p.id, name: p.name })),
        resolveHint: "Keep one coordinator; demote extras.",
      },
    ];
  }
  return [];
}

export function detectTelemetryNotes(panes: Pane[]): TelemetryNote[] {
  return panes
    .filter((p) => p.telemetry === "state_blind" || p.telemetry === "no_data")
    .map((p) => ({
      kind: "telemetry" as const,
      paneId: p.id,
      name: p.name,
      harness: p.harness,
      resolveHint: "Do not trust zero CPU/mem. Prefer attention/logs.",
    }));
}

export function collectConflicts(panes: Pane[]): AgentConflict[] {
  const mcpIssues = evaluateMcpPolicies(panes);
  const mcpConflicts: McpConflict[] = mcpIssues
    .filter((i) => i.severity === "block" || i.severity === "warn")
    .map((issue) => ({
      kind: "mcp" as const,
      issue,
      resolveHint: issue.remediation,
    }));

  return [
    ...detectRoleConflicts(panes),
    ...detectPathConflicts(panes),
    ...detectBranchConflicts(panes),
    ...detectAttentionConflicts(panes),
    ...detectDirtyConflicts(panes),
    ...detectTelemetryNotes(panes),
    ...mcpConflicts,
  ];
}

export function evaluateMergeGate(
  scopePanes: Pane[],
  opts?: { workspace?: Workspace | null },
): MergeGateReport {
  const conflicts = collectConflicts(scopePanes);
  const coords = scopePanes.filter((p) => p.role === "coordinator");
  const builders = scopePanes.filter((p) => p.role === "builder");
  const pathC = conflicts.filter((c): c is PathConflict => c.kind === "path");
  const branchC = conflicts.filter((c): c is BranchConflict => c.kind === "branch");
  const attC = conflicts.filter((c): c is AttentionConflict => c.kind === "attention");
  const dirtyC = conflicts.filter((c): c is DirtyConflict => c.kind === "dirty");
  const telC = conflicts.filter((c): c is TelemetryNote => c.kind === "telemetry");
  const mcpIssues = evaluateMcpPolicies(scopePanes);
  const mcpBlock = mcpIssues.filter((i) => i.severity === "block");
  const mcpWarn = mcpIssues.filter((i) => i.severity === "warn");
  const mcpInfo = mcpIssues.filter((i) => i.severity === "info");
  const mcpMissing = mcpBlock.filter((i) => i.code === "missing_required_tool");
  const mcpForbid = mcpBlock.filter(
    (i) => i.code === "forbidden_tool" || i.code === "forbidden_server",
  );

  const checks: GateCheck[] = [
    {
      id: "coord_present",
      label: "Coordinator present",
      severity: "block",
      ok: coords.length >= 1,
      detail: coords.length ? coords.map((c) => c.name).join(", ") : "None",
      related: coords.map((c) => c.id),
      remediation: "Spawn or role-assign a coordinator pane.",
    },
    {
      id: "coord_single",
      label: "Single merge owner",
      severity: "block",
      ok: coords.length <= 1,
      detail:
        coords.length <= 1
          ? "One coordinator"
          : `${coords.length} coordinators: ${coords.map((c) => c.name).join(", ")}`,
      related: coords.map((c) => c.id),
      remediation: "Demote extra coordinators before merge.",
    },
    {
      id: "attention_clear",
      label: "Attention queue clear",
      severity: "block",
      ok: attC.length === 0,
      detail: attC.length ? attC.map((a) => `${a.name}(${a.status})`).join(" · ") : "Clear",
      related: attC.map((a) => a.paneId),
      remediation: "Clear inbox items then re-run gate.",
    },
    {
      id: "worktrees_clean",
      label: "Worktrees clean",
      severity: "block",
      ok: dirtyC.length === 0,
      detail: dirtyC.length ? dirtyC.map((d) => d.name).join(", ") : "All clean",
      related: dirtyC.map((d) => d.paneId),
      remediation: "Commit, stash, or discard dirty trees.",
    },
    {
      id: "path_collisions",
      label: "No path ownership collisions",
      severity: "block",
      ok: pathC.length === 0,
      detail: pathC.length ? pathC.map((p) => p.path).join(" · ") : "No overlapping ownedPaths",
      related: pathC.flatMap((p) => p.owners.map((o) => o.id)),
      remediation: "Resolve path conflicts (sole owner or split globs).",
    },
    {
      id: "branch_collisions",
      label: "Unique lane branches",
      severity: "warn",
      ok: branchC.length === 0,
      detail: branchC.length
        ? branchC.map((b) => `${b.branch}×${b.panes.length}`).join(" · ")
        : "Branches unique per non-coord pane",
      related: branchC.flatMap((b) => b.panes.map((p) => p.id)),
      remediation: "Rename lane branches so merges are non-clobbering.",
    },
    {
      id: "builders_unblocked",
      label: "Builders not blocked/error",
      severity: "block",
      ok: builders.every((b) => b.status !== "blocked" && b.status !== "error"),
      detail: `${builders.filter((b) => b.status === "blocked" || b.status === "error").length} blocked/error of ${builders.length}`,
      related: builders
        .filter((b) => b.status === "blocked" || b.status === "error")
        .map((b) => b.id),
      remediation: "Wait for builders or cancel failed lanes.",
    },
    {
      id: "lane_coverage",
      label: "Lane coverage (builders idle or done)",
      severity: "warn",
      ok:
        builders.length === 0 ||
        builders.every((b) => b.status === "idle" || b.status === "working"),
      detail:
        builders.length === 0
          ? "No builders — solo coord merge?"
          : builders.map((b) => `${b.name}:${b.status}`).join(" · "),
      related: builders.map((b) => b.id),
      remediation: "Prefer merge when builders are idle.",
    },
    {
      id: "mcp_required",
      label: "MCP required tools",
      severity: "block",
      ok: mcpMissing.length === 0,
      detail: mcpMissing.length
        ? mcpMissing.map((i) => i.detail).join(" · ")
        : "Role tool requirements met",
      related: mcpMissing.map((i) => i.paneId).filter(Boolean) as string[],
      remediation: "Bind filesystem/git MCP for coord/builders in Control Center.",
    },
    {
      id: "mcp_forbidden",
      label: "MCP role policy (no forbidden tools)",
      severity: "block",
      ok: mcpForbid.length === 0,
      detail: mcpForbid.length
        ? mcpForbid.map((i) => i.detail).join(" · ")
        : "No forbidden MCP for scout/reviewer",
      related: mcpForbid.map((i) => i.paneId).filter(Boolean) as string[],
      remediation: "Unbind write/browser MCP from restricted roles.",
    },
    {
      id: "mcp_health",
      label: "MCP health / drift",
      severity: "warn",
      ok: mcpWarn.length === 0,
      detail: mcpWarn.length
        ? mcpWarn.map((i) => i.detail).slice(0, 4).join(" · ")
        : mcpInfo.length
          ? `${mcpInfo.length} info note(s)`
          : "MCP bindings healthy",
      related: mcpWarn.map((i) => i.paneId).filter(Boolean) as string[],
      remediation: "Fix missing binaries or accept drift.",
    },
    {
      id: "telemetry_honesty",
      label: "Telemetry honesty acknowledged",
      severity: "info",
      ok: true,
      detail: telC.length
        ? `${telC.length} state_blind pane(s) — metrics ignored`
        : "All scoped panes report live/stale telemetry",
      related: telC.map((t) => t.paneId),
      remediation: "Use logs/attention, not CPU charts, for limited harnesses.",
    },
  ];

  const blockers = checks.filter((c) => c.severity === "block" && !c.ok);
  const canMergeDryRun = blockers.length === 0;

  const coord = coords[0];
  const mergePlan: string[] = [];
  if (coord) {
    mergePlan.push(`Base: ${coord.name} @ ${coord.branch}`);
    const lanes = [...builders].sort((a, b) => a.branch.localeCompare(b.branch));
    lanes.forEach((b, i) => {
      mergePlan.push(
        `${i + 1}. Merge ${b.branch} (${b.name}) → ${coord.branch} from ${b.worktree}`,
      );
    });
    mergePlan.push("Verify MCP policy still PASS after merge");
    mergePlan.push("Run workspace tests; keep worktrees until confirmed");
  } else {
    mergePlan.push("No coordinator — cannot build ordered merge plan");
  }

  const dryRunSummary = canMergeDryRun
    ? `PASS dry-run: would merge ${builders.length} lane(s) onto ${coord?.branch ?? "?"} · MCP policy ok. No git mutation.`
    : `BLOCKED: ${blockers.length} hard check(s) — ${blockers.map((b) => b.id).join(", ")}.`;

  return {
    generatedAt: new Date().toISOString(),
    workspaceFocus: opts?.workspace?.name,
    paneCount: scopePanes.length,
    checks,
    conflicts,
    canMergeDryRun,
    dryRunSummary,
    mergePlan,
    mcpIssues,
  };
}

export function resolvePathSoleOwner(
  panes: Pane[],
  pathExpr: string,
  soleOwnerId: string,
): Pane[] {
  const keys = pathExpr.split(" ∩ ").map((s) => s.trim());
  return panes.map((p) => {
    if (!p.ownedPaths?.length) return p;
    if (p.id === soleOwnerId) {
      const keep = new Set(p.ownedPaths);
      for (const k of keys) {
        if (![...keep].some((x) => pathsOverlap(x, k))) keep.add(k);
      }
      return { ...p, ownedPaths: [...keep] };
    }
    return {
      ...p,
      ownedPaths: p.ownedPaths.filter(
        (op) => !keys.some((k) => pathsOverlap(op, k) || pathKey(op) === pathKey(k)),
      ),
    };
  });
}

export function dropPathClaim(panes: Pane[], paneId: string, pathExpr: string): Pane[] {
  const keys = pathExpr.split(" ∩ ").map((s) => s.trim());
  return panes.map((p) => {
    if (p.id !== paneId || !p.ownedPaths) return p;
    return {
      ...p,
      ownedPaths: p.ownedPaths.filter(
        (op) => !keys.some((k) => pathsOverlap(op, k) || pathKey(op) === pathKey(k)),
      ),
    };
  });
}

export function resolveSingleCoordinator(panes: Pane[], keepId: string): Pane[] {
  return panes.map((p) =>
    p.role === "coordinator" && p.id !== keepId ? { ...p, role: "builder" as const } : p,
  );
}
