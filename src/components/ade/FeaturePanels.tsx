/**
 * Ten ADE feature surfaces — attention, ownership, recipes, telemetry,
 * broadcast, merge gate, handoff, palette v2, layout presets, capability matrix.
 */
import { useEffect, useMemo, useState, type ComponentType, type ReactNode } from "react";
import {
  AlertTriangle,
  Bell,
  BookOpen,
  Check,
  CheckSquare,
  ClipboardCopy,
  Command,
  Download,
  Flame,
  FolderTree,
  GitMerge,
  GitPullRequest,
  History,
  Inbox,
  LayoutTemplate,
  Lock,
  Map as MapIcon,
  Radio,
  Rocket,
  Save,
  Send,
  Shield,
  Table2,
  Users,
  X,
  Activity,
  Info,
  Cable,
} from "lucide-react";

import { buildHandoffMarkdown } from "./handoff";
import {
  dropPathClaim,
  evaluateMergeGate,
  resolvePathSoleOwner,
  resolveSingleCoordinator,
  type AgentConflict,
  type GateCheck,
  type PathConflict,
} from "./mergeGate";
import { HARNESS_REGISTRY, PRODUCT_RECIPES, type Recipe } from "./harnesses";
import type { Pane, Role, Workspace } from "./types";

export type FeatureId =
  | "inbox"
  | "ownership"
  | "recipes"
  | "telemetry"
  | "broadcast"
  | "merge"
  | "handoff"
  | "presets"
  | "matrix"
  | "mcp"
  | "diff"
  | "runbook"
  | "heat"
  | "timeline"
  | "orgmcp"
  | "team_inbox"
  | "mission"
  | null;


const RECIPE_KEY = "hr-ade-recipes-v1";
const PRESET_KEY = "hr-ade-presets-v1";

export interface LayoutPreset {
  id: string;
  name: string;
  workspacePath: string;
  order: string[];
  pinnedIds: string[];
  createdAt: string;
}

export interface StoredRecipe extends Recipe {
  custom?: boolean;
  savedAt?: string;
}

function loadRecipes(): StoredRecipe[] {
  try {
    const raw = localStorage.getItem(RECIPE_KEY);
    if (raw) return JSON.parse(raw) as StoredRecipe[];
  } catch {
    /* ignore */
  }
  return PRODUCT_RECIPES.map((r) => ({ ...r }));
}

function saveRecipes(list: StoredRecipe[]) {
  try {
    localStorage.setItem(RECIPE_KEY, JSON.stringify(list));
  } catch {
    /* ignore */
  }
}

function loadPresets(): LayoutPreset[] {
  try {
    const raw = localStorage.getItem(PRESET_KEY);
    if (raw) return JSON.parse(raw) as LayoutPreset[];
  } catch {
    /* ignore */
  }
  return [];
}

function savePresets(list: LayoutPreset[]) {
  try {
    localStorage.setItem(PRESET_KEY, JSON.stringify(list));
  } catch {
    /* ignore */
  }
}

/* ─── Shell drawer ─── */

function DrawerShell({
  title,
  subtitle,
  icon: Icon,
  onClose,
  wide,
  children,
}: {
  title: string;
  subtitle?: string;
  icon: ComponentType<{ className?: string }>;
  onClose: () => void;
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-[60] flex justify-end bg-bg/50"
      onClick={onClose}
      role="dialog"
      aria-modal
    >
      <div
        className={`flex h-full w-full flex-col border-l border-border bg-surface shadow-panel ${
          wide ? "max-w-2xl" : "max-w-md"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex shrink-0 items-start gap-2 border-b border-border px-4 py-3">
          <Icon className="mt-0.5 size-4 text-accent" />
          <div className="min-w-0 flex-1">
            <h2 className="font-mono text-sm font-semibold text-fg">{title}</h2>
            {subtitle && <p className="text-[11px] text-muted">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-muted hover:text-fg"
            aria-label="Close"
          >
            <X className="size-4" />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">{children}</div>
      </div>
    </div>
  );
}

/* ─── 1. Attention inbox ─── */

export function AttentionInbox({
  panes,
  workspaces,
  onJump,
  onReply,
  onClose,
}: {
  panes: Pane[];
  workspaces: Workspace[];
  onJump: (paneId: string) => void;
  onReply: (paneId: string, text: string) => void;
  onClose: () => void;
}) {
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const items = useMemo(
    () =>
      panes
        .filter(
          (p) =>
            p.status === "needs_input" ||
            p.status === "blocked" ||
            p.status === "error" ||
            Boolean(p.lastToolFailure),
        )
        .sort((a, b) => {
          const rank = (s: Pane["status"]) =>
            s === "error" ? 0 : s === "needs_input" ? 1 : s === "blocked" ? 2 : 3;
          return rank(a.status) - rank(b.status);
        }),
    [panes],
  );

  return (
    <DrawerShell
      title="Attention inbox"
      subtitle={`${items.length} items need you · all workspaces`}
      icon={Inbox}
      onClose={onClose}
    >
      {items.length === 0 ? (
        <p className="font-mono text-sm text-muted">Queue clear — no attention.</p>
      ) : (
        <ul className="space-y-3">
          {items.map((p) => {
            const ws = workspaces.find((w) => w.id === p.workspaceId);
            return (
              <li key={p.id} className="rounded-md border border-border bg-elevated p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-sm px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase ${
                      p.status === "error"
                        ? "bg-danger-dim text-danger"
                        : p.status === "needs_input"
                          ? "bg-need-dim text-need"
                          : "bg-danger-dim/60 text-danger"
                    }`}
                  >
                    {p.status}
                  </span>
                  <span className="font-mono text-xs font-semibold uppercase text-fg">
                    {p.name}
                  </span>
                  <span className="font-mono text-[10px] text-subtle">{ws?.name}</span>
                </div>
                <p className="mt-1.5 text-xs text-muted">
                  {p.attention ?? p.lastToolFailure ?? "Awaiting operator"}
                </p>
                <div className="mt-2 flex gap-1.5">
                  <input
                    value={drafts[p.id] ?? ""}
                    onChange={(e) => setDrafts((d) => ({ ...d, [p.id]: e.target.value }))}
                    placeholder="Quick reply…"
                    className="min-w-0 flex-1 rounded-sm border border-border bg-surface px-2 py-1.5 font-mono text-[11px] text-fg focus:border-accent focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const t = drafts[p.id]?.trim();
                      if (t) onReply(p.id, t);
                    }}
                    className="rounded-sm bg-accent px-2 py-1 font-mono text-[10px] font-semibold text-accent-fg"
                  >
                    <Send className="size-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onJump(p.id)}
                    className="rounded-sm border border-border px-2 py-1 font-mono text-[10px] text-muted hover:text-fg"
                  >
                    Jump
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </DrawerShell>
  );
}

/* ─── 2. Path ownership + conflict resolution ─── */

export function OwnershipMap({
  panes,
  onClose,
  onApplyPanes,
  onToast,
}: {
  panes: Pane[];
  onClose: () => void;
  onApplyPanes?: (next: Pane[]) => void;
  onToast?: (m: string) => void;
}) {
  const report = useMemo(() => evaluateMergeGate(panes), [panes]);
  const pathConflicts = report.conflicts.filter((c): c is PathConflict => c.kind === "path");
  const rows = panes.filter((p) => (p.ownedPaths?.length ?? 0) > 0);

  const apply = (next: Pane[], msg: string) => {
    onApplyPanes?.(next);
    onToast?.(msg);
  };

  return (
    <DrawerShell
      title="Path ownership & conflicts"
      subtitle="Detect · resolve sole owner · split claims"
      icon={MapIcon}
      onClose={onClose}
      wide
    >
      {/* Conflict resolution */}
      <section className="mb-4">
        <h3 className="label-caps mb-2 flex items-center gap-1">
          <Shield className="size-3" /> Active conflicts
        </h3>
        {pathConflicts.length === 0 ? (
          <p className="rounded-md border border-success/30 bg-success-dim/20 px-3 py-2 font-mono text-[11px] text-success">
            No path collisions
          </p>
        ) : (
          <ul className="space-y-3">
            {pathConflicts.map((c) => (
              <li
                key={c.path}
                className="rounded-md border border-need/40 bg-need-dim/30 p-3"
              >
                <div className="font-mono text-xs font-semibold text-need">
                  <AlertTriangle className="mr-1 inline size-3.5" />
                  {c.path}
                </div>
                <p className="mt-1 text-[11px] text-muted">{c.resolveHint}</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {c.owners.map((o) => (
                    <button
                      key={o.id}
                      type="button"
                      disabled={!onApplyPanes}
                      onClick={() =>
                        apply(
                          resolvePathSoleOwner(panes, c.path, o.id),
                          `Sole owner → ${o.name} for ${c.path}`,
                        )
                      }
                      className="rounded-sm border border-border bg-surface px-2 py-1 font-mono text-[10px] text-fg hover:border-accent/50 disabled:opacity-40"
                    >
                      Sole: {o.name}
                    </button>
                  ))}
                  {c.owners.map((o) => (
                    <button
                      key={`drop-${o.id}`}
                      type="button"
                      disabled={!onApplyPanes}
                      onClick={() =>
                        apply(
                          dropPathClaim(panes, o.id, c.path),
                          `Dropped claim from ${o.name}`,
                        )
                      }
                      className="rounded-sm border border-border px-2 py-1 font-mono text-[10px] text-muted hover:text-fg disabled:opacity-40"
                    >
                      Drop {o.name}
                    </button>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Other conflict classes */}
      <section className="mb-4">
        <h3 className="label-caps mb-2">Other conflict classes</h3>
        <ConflictList
          conflicts={report.conflicts.filter((c) => c.kind !== "path")}
          compact
        />
      </section>

      <section>
        <h3 className="label-caps mb-2">Ownership map</h3>
        {rows.length === 0 ? (
          <p className="text-sm text-muted">No owned paths declared.</p>
        ) : (
          <div className="space-y-2">
            {rows.map((p) => (
              <div key={p.id} className="rounded-md border border-border bg-elevated p-3">
                <div className="font-mono text-xs font-semibold uppercase text-fg">
                  {p.name}{" "}
                  <span className="text-subtle">
                    · {p.role} · {p.harness}
                  </span>
                </div>
                <ul className="mt-2 flex flex-wrap gap-1.5">
                  {(p.ownedPaths ?? []).map((path) => {
                    const hit = pathConflicts.some(
                      (c) =>
                        c.path.includes(path.toLowerCase()) ||
                        path.toLowerCase().includes(c.path.split(" ∩ ")[0] ?? ""),
                    );
                    return (
                      <li
                        key={path}
                        className={`rounded-sm border px-2 py-0.5 font-mono text-[10px] ${
                          hit
                            ? "border-need/50 bg-need-dim text-need"
                            : "border-border bg-surface text-muted"
                        }`}
                      >
                        {path}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>
    </DrawerShell>
  );
}

function ConflictList({
  conflicts,
  compact,
  onResolveRole,
}: {
  conflicts: AgentConflict[];
  compact?: boolean;
  onResolveRole?: (keepId: string) => void;
}) {
  if (!conflicts.length) {
    return (
      <p className="font-mono text-[11px] text-muted">None in this class.</p>
    );
  }
  return (
    <ul className={compact ? "space-y-1.5" : "space-y-2"}>
      {conflicts.map((c, i) => {
        if (c.kind === "branch") {
          return (
            <li
              key={`b-${c.branch}-${i}`}
              className="rounded border border-need/30 bg-need-dim/20 px-2 py-1.5 font-mono text-[11px]"
            >
              <span className="text-need">branch</span>{" "}
              <code className="text-fg">{c.branch}</code> ·{" "}
              {c.panes.map((p) => p.name).join(", ")}
              <div className="text-[10px] text-muted">{c.resolveHint}</div>
            </li>
          );
        }
        if (c.kind === "attention") {
          return (
            <li
              key={`a-${c.paneId}`}
              className="rounded border border-border bg-elevated px-2 py-1.5 font-mono text-[11px]"
            >
              <span className="text-need">{c.status}</span> {c.name}: {c.detail}
            </li>
          );
        }
        if (c.kind === "dirty") {
          return (
            <li
              key={`d-${c.paneId}`}
              className="rounded border border-border bg-elevated px-2 py-1.5 font-mono text-[11px]"
            >
              <span className="text-need">dirty</span> {c.name} · {c.branch}
            </li>
          );
        }
        if (c.kind === "role") {
          return (
            <li
              key={`r-${c.issue}`}
              className="rounded border border-danger/30 bg-danger-dim/20 px-2 py-1.5 font-mono text-[11px]"
            >
              <span className="text-danger">{c.issue}</span>
              <div className="text-[10px] text-muted">{c.resolveHint}</div>
              {c.issue === "multiple_coordinators" && onResolveRole && (
                <div className="mt-1 flex flex-wrap gap-1">
                  {c.panes.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => onResolveRole(p.id)}
                      className="rounded-sm border border-border px-1.5 py-0.5 text-[10px] text-accent"
                    >
                      Keep {p.name}
                    </button>
                  ))}
                </div>
              )}
            </li>
          );
        }
        if (c.kind === "telemetry") {
          return (
            <li
              key={`t-${c.paneId}`}
              className="rounded border border-border/60 px-2 py-1 font-mono text-[10px] text-subtle"
            >
              <Info className="mr-1 inline size-3" />
              {c.name} state_blind
            </li>
          );
        }
        if (c.kind === "mcp") {
          return (
            <li
              key={`m-${c.issue.code}-${c.issue.paneId ?? i}`}
              className={`rounded border px-2 py-1.5 font-mono text-[11px] ${
                c.issue.severity === "block"
                  ? "border-danger/30 bg-danger-dim/20 text-danger"
                  : "border-need/30 bg-need-dim/20 text-need"
              }`}
            >
              <span className="uppercase">{c.issue.code}</span> · {c.issue.detail}
              <div className="text-[10px] text-muted">{c.resolveHint}</div>
            </li>
          );
        }
        return null;
      })}
    </ul>
  );
}

/* ─── 3. Recipe library ─── */

export function RecipeLibrary({
  onSpawn,
  onClose,
  onToast,
}: {
  onSpawn: (recipe: StoredRecipe) => void;
  onClose: () => void;
  onToast: (m: string) => void;
}) {
  const [list, setList] = useState<StoredRecipe[]>(() => loadRecipes());
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");

  const persist = (next: StoredRecipe[]) => {
    setList(next);
    saveRecipes(next);
  };

  return (
    <DrawerShell
      title="Recipe library"
      subtitle="Local JSON store · no cloud"
      icon={FolderTree}
      onClose={onClose}
      wide
    >
      <div className="mb-4 rounded-md border border-border bg-elevated p-3">
        <p className="label-caps mb-2">Save custom recipe</p>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title"
          className="mb-1.5 w-full rounded-sm border border-border bg-surface px-2 py-1.5 font-mono text-[11px] text-fg focus:border-accent focus:outline-none"
        />
        <input
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          placeholder="Summary"
          className="mb-2 w-full rounded-sm border border-border bg-surface px-2 py-1.5 font-mono text-[11px] text-fg focus:border-accent focus:outline-none"
        />
        <button
          type="button"
          onClick={() => {
            if (!title.trim()) return;
            const r: StoredRecipe = {
              id: `custom-${Date.now()}`,
              title: title.trim(),
              summary: summary.trim() || "Custom local recipe",
              version: 1,
              agents: [{ harness: "claude", role: "builder" }],
              custom: true,
              savedAt: new Date().toISOString(),
            };
            persist([r, ...list]);
            setTitle("");
            setSummary("");
            onToast(`Saved recipe “${r.title}” locally`);
          }}
          className="inline-flex items-center gap-1 rounded-sm bg-accent px-2 py-1.5 font-mono text-[10px] font-semibold text-accent-fg"
        >
          <Save className="size-3" /> Save to local store
        </button>
      </div>
      <ul className="space-y-2">
        {list.map((r) => (
          <li
            key={r.id}
            className="flex flex-col gap-2 rounded-md border border-border bg-elevated p-3 sm:flex-row sm:items-center"
          >
            <div className="min-w-0 flex-1">
              <div className="font-mono text-xs font-semibold text-fg">
                {r.title}
                {r.custom && <span className="ml-2 text-[9px] text-accent">local</span>}
              </div>
              <p className="text-[11px] text-muted">{r.summary}</p>
            </div>
            <button
              type="button"
              onClick={() => {
                onSpawn(r);
                onClose();
              }}
              className="rounded-sm border border-accent/40 bg-accent-dim px-2 py-1.5 font-mono text-[10px] text-accent"
            >
              Spawn
            </button>
          </li>
        ))}
      </ul>
    </DrawerShell>
  );
}

/* ─── 4. Telemetry drawer ─── */

export function TelemetryDrawer({
  panes,
  onClose,
}: {
  panes: Pane[];
  onClose: () => void;
}) {
  return (
    <DrawerShell
      title="Honest telemetry"
      subtitle="Source · age · never fake live for state_blind"
      icon={Activity}
      onClose={onClose}
      wide
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[480px] border-collapse font-mono text-[11px]">
          <thead>
            <tr className="border-b border-border text-left text-subtle">
              <th className="py-1.5 pr-2">Pane</th>
              <th className="py-1.5 pr-2">Source</th>
              <th className="py-1.5 pr-2">State</th>
              <th className="py-1.5 pr-2">CPU</th>
              <th className="py-1.5 pr-2">Mem</th>
              <th className="py-1.5">Age</th>
            </tr>
          </thead>
          <tbody>
            {panes.map((p) => {
              const blind = p.telemetry === "state_blind" || p.telemetry === "no_data";
              const source =
                p.telemetry === "live"
                  ? "hooks"
                  : p.telemetry === "state_blind"
                    ? "state_blind"
                    : p.telemetry;
              return (
                <tr key={p.id} className="border-b border-border/60">
                  <td className="py-2 pr-2 font-semibold uppercase text-fg">{p.name}</td>
                  <td className="py-2 pr-2 text-muted">{source}</td>
                  <td className="py-2 pr-2">
                    <span
                      className={
                        blind
                          ? "text-need"
                          : p.telemetry === "live"
                            ? "text-success"
                            : "text-subtle"
                      }
                    >
                      {p.telemetry}
                    </span>
                  </td>
                  <td className="py-2 pr-2 text-muted">
                    {blind || p.cpu == null ? "—" : `${p.cpu.toFixed(1)}%`}
                  </td>
                  <td className="py-2 pr-2 text-muted">
                    {blind || p.memMb == null ? "—" : `${p.memMb}MB`}
                  </td>
                  <td className="py-2 text-subtle">{blind ? "n/a" : "< 2s"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </DrawerShell>
  );
}

/* ─── 5. Broadcast ─── */

export function BroadcastComposer({
  panes,
  onSend,
  onClose,
  onToast,
}: {
  panes: Pane[];
  onSend: (paneIds: string[], message: string) => void;
  onClose: () => void;
  onToast: (m: string) => void;
}) {
  const [message, setMessage] = useState("");
  const [roleFilter, setRoleFilter] = useState<Role | "all">("all");
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const visible = panes.filter((p) => roleFilter === "all" || p.role === roleFilter);

  return (
    <DrawerShell
      title="Broadcast / delegate"
      subtitle="One message → N panes"
      icon={Radio}
      onClose={onClose}
    >
      <div className="mb-3 flex flex-wrap gap-1">
        {(["all", "builder", "scout", "reviewer", "coordinator", "none"] as const).map(
          (r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRoleFilter(r)}
              className={`rounded-sm border px-2 py-0.5 font-mono text-[10px] ${
                roleFilter === r
                  ? "border-accent bg-accent-dim text-accent"
                  : "border-border text-muted"
              }`}
            >
              {r}
            </button>
          ),
        )}
      </div>
      <ul className="mb-3 max-h-40 space-y-1 overflow-y-auto">
        {visible.map((p) => (
          <li key={p.id}>
            <label className="flex cursor-pointer items-center gap-2 rounded-sm px-1 py-1 hover:bg-elevated">
              <input
                type="checkbox"
                checked={selected.has(p.id)}
                onChange={() => {
                  setSelected((s) => {
                    const n = new Set(s);
                    if (n.has(p.id)) n.delete(p.id);
                    else n.add(p.id);
                    return n;
                  });
                }}
              />
              <span className="font-mono text-[11px] uppercase text-fg">{p.name}</span>
            </label>
          </li>
        ))}
      </ul>
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        rows={4}
        placeholder="Message to selected agents…"
        className="w-full rounded-md border border-border bg-elevated px-3 py-2 font-mono text-xs text-fg focus:border-accent focus:outline-none"
      />
      <button
        type="button"
        disabled={!message.trim() || selected.size === 0}
        onClick={() => {
          onSend([...selected], message.trim());
          onToast(`Broadcast to ${selected.size} pane(s)`);
          onClose();
        }}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-md bg-accent py-2 font-mono text-xs font-semibold text-accent-fg disabled:opacity-40"
      >
        <Send className="size-3.5" /> Send broadcast
      </button>
    </DrawerShell>
  );
}

/* ─── 6. Merge gate (detailed) ─── */

function checkIcon(c: GateCheck) {
  if (c.ok) return <Check className="mt-0.5 size-3.5 shrink-0 text-success" />;
  if (c.severity === "block")
    return <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-danger" />;
  if (c.severity === "warn")
    return <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-need" />;
  return <Info className="mt-0.5 size-3.5 shrink-0 text-info" />;
}

export function MergeGate({
  panes,
  workspace,
  onClose,
  onToast,
  onApplyPanes,
  onJump,
}: {
  panes: Pane[];
  workspace?: Workspace | null;
  onClose: () => void;
  onToast: (m: string) => void;
  onApplyPanes?: (next: Pane[]) => void;
  onJump?: (paneId: string) => void;
}) {
  const [tab, setTab] = useState<"checks" | "conflicts" | "plan" | "logic">("checks");
  const report = useMemo(
    () => evaluateMergeGate(panes, { workspace }),
    [panes, workspace],
  );

  const pathConflicts = report.conflicts.filter((c): c is PathConflict => c.kind === "path");

  return (
    <DrawerShell
      title="Merge gate"
      subtitle={
        report.canMergeDryRun
          ? "PASS dry-run · no git mutation"
          : "BLOCKED · resolve hard checks"
      }
      icon={GitMerge}
      onClose={onClose}
      wide
    >
      {/* Status banner */}
      <div
        className={`mb-3 rounded-md border px-3 py-2 font-mono text-xs ${
          report.canMergeDryRun
            ? "border-success/40 bg-success-dim/30 text-success"
            : "border-danger/40 bg-danger-dim/30 text-danger"
        }`}
      >
        {report.dryRunSummary}
      </div>

      {/* Tabs */}
      <div className="mb-3 flex flex-wrap gap-1">
        {(
          [
            ["checks", "Checklist"],
            ["conflicts", "Conflicts"],
            ["plan", "Merge plan"],
            ["logic", "Logic"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`rounded-sm border px-2 py-1 font-mono text-[10px] ${
              tab === id
                ? "border-accent bg-accent-dim text-accent"
                : "border-border text-muted"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "checks" && (
        <ul className="space-y-2">
          {report.checks.map((c) => (
            <li
              key={c.id}
              className={`rounded-md border px-3 py-2 font-mono text-xs ${
                c.ok
                  ? "border-success/25 bg-success-dim/15"
                  : c.severity === "block"
                    ? "border-danger/35 bg-danger-dim/20"
                    : c.severity === "warn"
                      ? "border-need/35 bg-need-dim/20"
                      : "border-border bg-elevated"
              }`}
            >
              <div className="flex items-start gap-2">
                {checkIcon(c)}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-fg">{c.label}</span>
                    <span className="rounded-sm border border-border px-1 text-[9px] uppercase text-subtle">
                      {c.severity}
                    </span>
                    <span className="font-mono text-[9px] text-subtle">{c.id}</span>
                  </div>
                  <div className="mt-0.5 text-[11px] text-muted">{c.detail}</div>
                  {!c.ok && (
                    <div className="mt-1 text-[10px] text-need">→ {c.remediation}</div>
                  )}
                  {c.related.length > 0 && onJump && !c.ok && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {c.related.slice(0, 4).map((id) => {
                        const pane = panes.find((p) => p.id === id);
                        if (!pane) return null;
                        return (
                          <button
                            key={id}
                            type="button"
                            onClick={() => onJump(id)}
                            className="rounded-sm border border-border px-1.5 py-0.5 text-[9px] text-accent"
                          >
                            Jump {pane.name}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {tab === "conflicts" && (
        <div className="space-y-4">
          <div>
            <h3 className="label-caps mb-2">Path collisions</h3>
            {pathConflicts.length === 0 ? (
              <p className="text-[11px] text-muted">None</p>
            ) : (
              pathConflicts.map((c) => (
                <div
                  key={c.path}
                  className="mb-2 rounded-md border border-need/40 bg-need-dim/25 p-2"
                >
                  <code className="font-mono text-[11px] text-fg">{c.path}</code>
                  <div className="mt-1 text-[10px] text-muted">{c.resolveHint}</div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {c.owners.map((o) => (
                      <button
                        key={o.id}
                        type="button"
                        disabled={!onApplyPanes}
                        onClick={() => {
                          onApplyPanes?.(resolvePathSoleOwner(panes, c.path, o.id));
                          onToast(`Sole owner → ${o.name}`);
                        }}
                        className="rounded-sm border border-border bg-surface px-2 py-0.5 font-mono text-[10px] text-fg disabled:opacity-40"
                      >
                        Sole: {o.name}
                      </button>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
          <div>
            <h3 className="label-caps mb-2">Role / branch / dirty / attention</h3>
            <ConflictList
              conflicts={report.conflicts.filter((c) => c.kind !== "path")}
              onResolveRole={
                onApplyPanes
                  ? (keepId) => {
                      onApplyPanes(resolveSingleCoordinator(panes, keepId));
                      onToast("Single coordinator resolved");
                    }
                  : undefined
              }
            />
          </div>
        </div>
      )}

      {tab === "plan" && (
        <div>
          <ol className="list-decimal space-y-2 pl-4 font-mono text-xs text-muted">
            {report.mergePlan.map((step) => (
              <li key={step} className="text-fg">
                {step}
              </li>
            ))}
          </ol>
          <p className="mt-3 font-mono text-[10px] text-subtle">
            Dry-run only — ADE does not execute git merge in this mock.
          </p>
        </div>
      )}

      {tab === "logic" && (
        <div className="space-y-3 font-mono text-[11px] leading-relaxed text-muted">
          <p className="text-fg">Gate evaluation order</p>
          <ol className="list-decimal space-y-1 pl-4">
            <li>
              <span className="text-danger">block</span> checks must all pass →{" "}
              <code className="text-accent">canMergeDryRun</code>
            </li>
            <li>
              <span className="text-need">warn</span> checks surface risk but allow dry-run
              approve
            </li>
            <li>
              <span className="text-info">info</span> (telemetry honesty) never blocks
            </li>
          </ol>
          <p className="text-fg">Conflict classes</p>
          <ul className="space-y-1 pl-2">
            <li>
              <code className="text-accent">path</code> — overlapping ownedPaths (prefix/**
              heuristics)
            </li>
            <li>
              <code className="text-accent">branch</code> — two non-coord panes on same branch
            </li>
            <li>
              <code className="text-accent">attention</code> — needs_input / blocked / error
            </li>
            <li>
              <code className="text-accent">dirty</code> — gitClean === false
            </li>
            <li>
              <code className="text-accent">role</code> — zero or multiple coordinators
            </li>
            <li>
              <code className="text-accent">mcp</code> — role tools, forbidden servers, drift
            </li>
            <li>
              <code className="text-accent">telemetry</code> — state_blind notes only
            </li>
          </ul>
          <p className="text-fg">Resolution actions (mock)</p>

          <ul className="space-y-1 pl-2">
            <li>Sole owner — strip overlapping globs from other panes</li>
            <li>Drop claim — remove path from one pane</li>
            <li>Keep coordinator — demote extras to builder</li>
          </ul>
          <p className="rounded border border-border bg-elevated p-2 text-[10px]">
            Engine: <code className="text-accent">mergeGate.ts · evaluateMergeGate()</code>
          </p>
        </div>
      )}

      <button
        type="button"
        disabled={!report.canMergeDryRun}
        onClick={() => {
          onToast(
            report.canMergeDryRun
              ? "Merge gate PASS — dry-run recorded (no git)"
              : "Still blocked",
          );
          if (report.canMergeDryRun) onClose();
        }}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-md border border-accent/40 bg-accent-dim py-2 font-mono text-xs font-semibold text-accent disabled:opacity-40"
      >
        <CheckSquare className="size-3.5" />
        {report.canMergeDryRun ? "Approve merge dry-run" : "Fix block checks first"}
      </button>
    </DrawerShell>
  );
}

/* ─── 7. Handoff pack v2 ─── */

export function HandoffPack({
  workspaces,
  panes,
  focusWorkspaceId,
  onClose,
  onToast,
}: {
  workspaces: Workspace[];
  panes: Pane[];
  focusWorkspaceId?: string;
  onClose: () => void;
  onToast: (m: string) => void;
}) {
  const [note, setNote] = useState("");
  const [includeConflicts, setIncludeConflicts] = useState(true);
  const [includeMergePlan, setIncludeMergePlan] = useState(true);
  const [includeMcp, setIncludeMcp] = useState(true);
  const [scopeFocus, setScopeFocus] = useState(Boolean(focusWorkspaceId));

  const md = useMemo(
    () =>
      buildHandoffMarkdown(workspaces, panes, {
        note: note || undefined,
        focusWorkspaceId: scopeFocus ? focusWorkspaceId : undefined,
        includeConflicts,
        includeMergePlan,
        includeMcp,
      }),
    [
      workspaces,
      panes,
      note,
      scopeFocus,
      focusWorkspaceId,
      includeConflicts,
      includeMergePlan,
      includeMcp,
    ],
  );


  return (
    <DrawerShell
      title="Session handoff"
      subtitle="handoff-md/v2 · tables · gate · checklist"
      icon={Download}
      onClose={onClose}
      wide
    >
      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Operator note for next session…"
        className="mb-2 w-full rounded-sm border border-border bg-elevated px-2 py-1.5 font-mono text-[11px] text-fg focus:border-accent focus:outline-none"
      />
      <div className="mb-3 flex flex-wrap gap-3 font-mono text-[10px] text-muted">
        <label className="flex items-center gap-1.5">
          <input
            type="checkbox"
            checked={includeConflicts}
            onChange={(e) => setIncludeConflicts(e.target.checked)}
          />
          Conflicts
        </label>
        <label className="flex items-center gap-1.5">
          <input
            type="checkbox"
            checked={includeMergePlan}
            onChange={(e) => setIncludeMergePlan(e.target.checked)}
          />
          Merge plan
        </label>
        <label className="flex items-center gap-1.5">
          <input
            type="checkbox"
            checked={includeMcp}
            onChange={(e) => setIncludeMcp(e.target.checked)}
          />
          MCP pack
        </label>
        {focusWorkspaceId && (
          <label className="flex items-center gap-1.5">
            <input
              type="checkbox"
              checked={scopeFocus}
              onChange={(e) => setScopeFocus(e.target.checked)}
            />
            Gate scope = active workspace
          </label>
        )}
      </div>
      <pre className="max-h-[48dvh] overflow-auto rounded-md border border-border bg-bg p-3 font-mono text-[10px] leading-relaxed text-muted">
        {md}
      </pre>
      <button
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(md);
            onToast("Handoff pack v2 copied");
          } catch {
            onToast("Copy failed — select text manually");
          }
        }}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-md bg-accent py-2 font-mono text-xs font-semibold text-accent-fg"
      >
        <ClipboardCopy className="size-3.5" /> Copy handoff markdown
      </button>
    </DrawerShell>
  );
}

/* ─── 9. Layout presets ─── */

export function LayoutPresetsPanel({
  workspace,
  order,
  panes,
  onApply,
  onClose,
  onToast,
}: {
  workspace: Workspace | null;
  order: string[];
  panes: Pane[];
  onApply: (preset: LayoutPreset) => void;
  onClose: () => void;
  onToast: (m: string) => void;
}) {
  const [list, setList] = useState<LayoutPreset[]>(() => loadPresets());
  const [name, setName] = useState("");
  const forPath = workspace
    ? list.filter((p) => p.workspacePath === workspace.path)
    : list;

  return (
    <DrawerShell
      title="Layout presets"
      subtitle={workspace ? `For ${workspace.path}` : "Pick a workspace first"}
      icon={LayoutTemplate}
      onClose={onClose}
    >
      <div className="mb-4 flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Preset name"
          className="min-w-0 flex-1 rounded-sm border border-border bg-elevated px-2 py-1.5 font-mono text-[11px] text-fg focus:border-accent focus:outline-none"
        />
        <button
          type="button"
          disabled={!workspace || !name.trim()}
          onClick={() => {
            if (!workspace) return;
            const preset: LayoutPreset = {
              id: `preset-${Date.now()}`,
              name: name.trim(),
              workspacePath: workspace.path,
              order: [...order],
              pinnedIds: panes.filter((p) => p.pinned).map((p) => p.id),
              createdAt: new Date().toISOString(),
            };
            const next = [preset, ...list];
            setList(next);
            savePresets(next);
            setName("");
            onToast(`Saved layout “${preset.name}”`);
          }}
          className="rounded-sm bg-accent px-2 py-1.5 font-mono text-[10px] font-semibold text-accent-fg disabled:opacity-40"
        >
          Save
        </button>
      </div>
      {forPath.length === 0 ? (
        <p className="text-xs text-muted">No presets yet.</p>
      ) : (
        <ul className="space-y-2">
          {forPath.map((p) => (
            <li
              key={p.id}
              className="flex items-center justify-between rounded-md border border-border bg-elevated px-3 py-2"
            >
              <div className="font-mono text-xs font-semibold text-fg">{p.name}</div>
              <button
                type="button"
                onClick={() => {
                  onApply(p);
                  onToast(`Restored “${p.name}”`);
                  onClose();
                }}
                className="rounded-sm border border-accent/40 px-2 py-1 font-mono text-[10px] text-accent"
              >
                Restore
              </button>
            </li>
          ))}
        </ul>
      )}
    </DrawerShell>
  );
}

/* ─── 10. Capability matrix ─── */

export function CapabilityMatrix({ onClose }: { onClose: () => void }) {
  return (
    <DrawerShell
      title="Harness capability matrix"
      subtitle="Telemetry · model picker · honesty"
      icon={Table2}
      onClose={onClose}
      wide
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] border-collapse font-mono text-[11px]">
          <thead>
            <tr className="border-b border-border text-left text-[10px] text-subtle">
              <th className="py-2 pr-2">Harness</th>
              <th className="py-2 pr-2">Cmd</th>
              <th className="py-2 pr-2">Telemetry</th>
              <th className="py-2 pr-2">Model UI</th>
              <th className="py-2">Notes</th>
            </tr>
          </thead>
          <tbody>
            {HARNESS_REGISTRY.map((h) => (
              <tr key={h.id} className="border-b border-border/50">
                <td className="py-2 pr-2 font-semibold text-fg">{h.label}</td>
                <td className="py-2 pr-2 text-accent">{h.cmd}</td>
                <td className="py-2 pr-2">
                  <span
                    className={
                      h.telemetry === "full"
                        ? "text-success"
                        : h.telemetry === "limited"
                          ? "text-need"
                          : "text-subtle"
                    }
                  >
                    {h.telemetry}
                  </span>
                </td>
                <td className="py-2 pr-2 text-muted">CLI</td>
                <td className="py-2 text-subtle">{h.notes ?? h.strengths}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </DrawerShell>
  );
}

/* ─── 8. Palette v2 ─── */

export type PaletteAction = {
  id: string;
  label: string;
  hint?: string;
  group: string;
  run: () => void;
};

export function PaletteV2({
  open,
  onClose,
  actions,
}: {
  open: boolean;
  onClose: () => void;
  actions: PaletteAction[];
}) {
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return actions;
    return actions.filter(
      (a) =>
        a.label.toLowerCase().includes(needle) ||
        a.group.toLowerCase().includes(needle) ||
        a.id.includes(needle),
    );
  }, [actions, q]);

  useEffect(() => {
    if (open) {
      setQ("");
      setActive(0);
    }
  }, [open]);

  useEffect(() => {
    setActive(0);
  }, [q]);

  if (!open) return null;

  const groups = [...new Set(filtered.map((a) => a.group))];

  return (
    <div
      className="fixed inset-0 z-[70] flex items-start justify-center bg-bg/70 px-4 pt-[10vh]"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-lg border border-border bg-surface shadow-panel"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-border px-3 py-2">
          <Command className="size-4 text-muted" />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setActive((i) => Math.min(filtered.length - 1, i + 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setActive((i) => Math.max(0, i - 1));
              } else if (e.key === "Enter") {
                e.preventDefault();
                filtered[active]?.run();
              } else if (e.key === "Escape") {
                onClose();
              }
            }}
            placeholder="pin · merge · handoff · goto…"
            className="min-w-0 flex-1 bg-transparent font-mono text-sm text-fg placeholder:text-subtle focus:outline-none"
          />
          <kbd className="font-mono text-[10px] text-subtle">⌘K</kbd>
        </div>
        <ul className="max-h-[50dvh] overflow-y-auto p-1">
          {filtered.length === 0 && (
            <li className="px-3 py-4 text-center font-mono text-xs text-muted">No matches</li>
          )}
          {groups.map((g) => (
            <li key={g}>
              <div className="label-caps px-3 py-1.5 text-subtle">{g}</div>
              {filtered
                .filter((a) => a.group === g)
                .map((a) => {
                  const idx = filtered.indexOf(a);
                  return (
                    <button
                      key={a.id}
                      type="button"
                      onClick={a.run}
                      onMouseEnter={() => setActive(idx)}
                      className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm ${
                        idx === active ? "bg-accent-dim text-fg" : "text-muted hover:bg-elevated"
                      }`}
                    >
                      <span>{a.label}</span>
                      {a.hint && (
                        <kbd className="font-mono text-[10px] text-subtle">{a.hint}</kbd>
                      )}
                    </button>
                  );
                })}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export const FEATURE_LAUNCHERS: {
  id: Exclude<FeatureId, null>;
  label: string;
  icon: ComponentType<{ className?: string }>;
}[] = [
  { id: "inbox", label: "Inbox", icon: Bell },
  { id: "team_inbox", label: "Team Q", icon: Users },
  { id: "ownership", label: "Paths", icon: MapIcon },
  { id: "heat", label: "Heat", icon: Flame },
  { id: "recipes", label: "Recipes", icon: FolderTree },
  { id: "runbook", label: "Runbook", icon: BookOpen },
  { id: "diff", label: "Diff/PR", icon: GitPullRequest },
  { id: "telemetry", label: "Telemetry", icon: Activity },
  { id: "timeline", label: "Timeline", icon: History },
  { id: "broadcast", label: "Broadcast", icon: Radio },
  { id: "merge", label: "Merge", icon: GitMerge },
  { id: "handoff", label: "Handoff", icon: Download },
  { id: "presets", label: "Layouts", icon: LayoutTemplate },
  { id: "matrix", label: "Matrix", icon: Table2 },
  { id: "mcp", label: "MCP", icon: Cable },
  { id: "orgmcp", label: "Org MCP", icon: Lock },
  { id: "mission", label: "Mission", icon: Rocket },
];

