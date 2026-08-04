import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  FolderGit2,
  GripVertical,
  Keyboard,
  LayoutGrid,
  Network,
  Pin,
  Plus,
  Radio,
  Search,
  Settings2,
  Shield,
  Terminal,
  X,
} from "lucide-react";
import { DEMO_FLEET, WORKSPACES } from "./data";
import { RolePill, StatusPill, TelemetryChip } from "./badges";
import {
  AttentionInbox,
  BroadcastComposer,
  CapabilityMatrix,
  FEATURE_LAUNCHERS,
  type FeatureId,
  type LayoutPreset,
  HandoffPack,
  LayoutPresetsPanel,
  MergeGate,
  OwnershipMap,
  PaletteV2,
  type PaletteAction,
  RecipeLibrary,
  type StoredRecipe,
  TelemetryDrawer,
} from "./FeaturePanels";
import { AdminConsole } from "./AdminConsole";
import {
  ConflictHeatMap,
  DiffPrPane,
  EntitlementsChip,
  HostBridgeBanner,
  OrgMcpPolicy,
  RunbookRunner,
  SessionTimeline,
  SharedTeamInbox,
  SoftGateModal,
  WelcomeMission,
  loadEntitlements,
  saveEntitlements,
  seedTimelineFromFleet,
  type LocalEntitlements,
  type SoftGateFeature,
} from "./NextPathPanels";
import { canUse, refreshEntitlementsFromApi, setBearer } from "../../lib/entitlementsClient";
import {
  PERSONAS,
  getPersona,
  loadPersona,
  savePersona,
  type PersonaId,
} from "./personas";
import { KeyboardHintsPanel } from "./KeyboardHints";
import { packWorkspace, workspaceTree } from "./layout";
import { McpControlCenter } from "./McpControlCenter";
import { McpPaneInspector } from "./McpPaneInspector";
import { applyMcpSnapshotToPane, loadMcpConfig, snapshotMcpForHarness } from "./mcpConfig";
import { PaneGrid, arrangePanes } from "./PaneGrid";
import type { CloseConfirmResult } from "./ClosePaneDialog";
import { SettingsPanel } from "./SettingsPanel";
import { ThemeDocsPanel } from "./ThemeDocs";
import { ThemeToggle, useTheme } from "./ThemeToggle";
import { WorkspaceWizard } from "./wizard";
import { publishStatus } from "../../lib/statusBus";
import {
  destroyWorktree,
  killPaneAgent,
  registerWorktreeRoot,
  spawnAgent,
  spawnClaude,
  subscribeHostEvents,
} from "../../lib/agent-bridge";
import type { Pane, TabId, Workspace } from "./types";

type ViewMode = "empty" | "fleet";
const DND_MIME = "application/x-harness-pane";

function isTypingTarget(el: EventTarget | null) {
  if (!(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable;
}

function defaultOrder(panes: Pane[]): string[] {
  const { primary, rest } = arrangePanes(panes);
  return [primary, ...rest].filter(Boolean).map((p) => p!.id);
}

export function CommandCenter() {
  const {
    preference: themePref,
    setPreference: setThemePref,
    resolved: themeResolved,
    mounted: themeMounted,
  } = useTheme();
  const [tab, setTab] = useState<TabId>("command");
  const [mode, setMode] = useState<ViewMode>("empty");
  const [workspaces, setWorkspaces] = useState<Workspace[]>(() =>
    WORKSPACES.map((w) => ({ ...w, harnesses: [...w.harnesses] })),
  );
  const [panes, setPanes] = useState<Pane[]>([]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState(WORKSPACES[0]?.id ?? "");
  const [selected, setSelected] = useState<string | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [hintsOpen, setHintsOpen] = useState(false);
  const [feature, setFeature] = useState<FeatureId>(null);
  const [mcpInspectId, setMcpInspectId] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [persona, setPersona] = useState<PersonaId>(() =>
    typeof window !== "undefined" ? loadPersona() : "operator",
  );
  const personaMeta = getPersona(persona);
  const [entitlements, setEntitlements] = useState<LocalEntitlements>(() =>
    typeof window !== "undefined" ? loadEntitlements() : loadEntitlements(),
  );
  const [softGate, setSoftGate] = useState<{
    feature: SoftGateFeature;
    proceed?: () => void;
  } | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);

  const [toast, setToast] = useState<string | null>(null);
  const [orders, setOrders] = useState<Record<string, string[]>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(WORKSPACES.map((w) => [w.id, true])),
  );

  const allPanes = mode === "fleet" ? panes : [];
  const tree = useMemo(() => workspaceTree(workspaces), [workspaces]);
  const activeWorkspace =
    workspaces.find((w) => w.id === activeWorkspaceId) ?? workspaces[0] ?? null;

  const panesInWorkspace = useMemo(
    () => allPanes.filter((p) => p.workspaceId === activeWorkspaceId),
    [allPanes, activeWorkspaceId],
  );

  const orderForWs = useMemo(() => {
    const saved = orders[activeWorkspaceId];
    if (saved?.length) {
      const ids = new Set(panesInWorkspace.map((p) => p.id));
      return [
        ...saved.filter((id) => ids.has(id)),
        ...panesInWorkspace.filter((p) => !saved.includes(p.id)).map((p) => p.id),
      ];
    }
    return defaultOrder(panesInWorkspace);
  }, [orders, activeWorkspaceId, panesInWorkspace]);

  const layoutPreview = useMemo(
    () => packWorkspace(panesInWorkspace, orderForWs, selected),
    [panesInWorkspace, orderForWs, selected],
  );

  const needsYou = useMemo(
    () =>
      allPanes.filter(
        (p) =>
          p.status === "needs_input" ||
          p.status === "blocked" ||
          p.status === "error" ||
          Boolean(p.lastToolFailure),
      ),
    [allPanes],
  );

  const flash = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2600);
  }, []);

  // Host events → pane status chips (needs_input / tool_fail / exit / spawn)
  useEffect(() => {
    return subscribeHostEvents((ev) => {
      if (!ev.paneId) return;
      setPanes((prev) =>
        prev.map((p) => {
          if (p.id !== ev.paneId) return p;
          if (ev.kind === "needs_input") {
            return {
              ...p,
              status: "needs_input",
              attention: ev.message,
              telemetry: p.harness.includes("claude") ? "live" : p.telemetry,
            };
          }
          if (ev.kind === "tool_fail") {
            return {
              ...p,
              status: "error",
              lastToolFailure: ev.message,
            };
          }
          if (ev.kind === "spawn_running" || ev.kind === "spawn_starting") {
            return {
              ...p,
              status: ev.kind === "spawn_running" ? "working" : "starting",
              telemetry: p.harness.includes("claude") ? "live" : p.telemetry,
            };
          }
          if (ev.kind === "spawn_error") {
            return { ...p, status: "error", lastToolFailure: ev.message };
          }
          if (ev.kind === "exit") {
            return { ...p, status: "idle" };
          }
          return p;
        }),
      );
    });
  }, []);

  // Soft-gates: refresh signed entitlements from ade-api (demo fallback)
  useEffect(() => {
    setBearer(persona === "admin" ? "admin" : persona === "viewer" ? "viewer" : "operator");
    void refreshEntitlementsFromApi().then((e) => {
      setEntitlements(e);
      saveEntitlements(e);
    });
    const onFocus = () => {
      void refreshEntitlementsFromApi().then((e) => {
        setEntitlements(e);
        saveEntitlements(e);
      });
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [persona]);

  const requestGate = useCallback(
    (feature: SoftGateFeature, proceed: () => void) => {
      const gate = canUse(entitlements, feature);
      if (gate.ok) {
        proceed();
        return;
      }
      setSoftGate({ feature, proceed });
    },
    [entitlements],
  );

  const selectWorkspace = (id: string) => {
    setActiveWorkspaceId(id);
    const wsPanes = allPanes.filter((p) => p.workspaceId === id);
    const ord = orders[id]?.length ? orders[id]! : defaultOrder(wsPanes);
    setSelected(ord[0] ?? wsPanes[0]?.id ?? null);
    setExpanded((e) => ({ ...e, [id]: true }));
    if (!orders[id]?.length && wsPanes.length) {
      setOrders((o) => ({ ...o, [id]: defaultOrder(wsPanes) }));
    }
  };

  const jumpToPane = useCallback(
    (paneId: string) => {
      const pane = panes.find((p) => p.id === paneId);
      if (!pane) return;
      setMode("fleet");
      setTab("command");
      setActiveWorkspaceId(pane.workspaceId);
      setSelected(paneId);
      setFeature(null);
      setPaletteOpen(false);
      flash(`Jumped to ${pane.name}`);
    },
    [panes, flash],
  );

  const setPinned = useCallback(
    (id: string, pinned: boolean) => {
      setPanes((prev) => prev.map((p) => (p.id === id ? { ...p, pinned } : p)));
      const pane = panes.find((p) => p.id === id);
      flash(pinned ? `Pinned ${pane?.name ?? id}` : `Unpinned ${pane?.name ?? id}`);
    },
    [panes, flash],
  );

  const togglePin = useCallback(
    (id: string) => {
      const pane = panes.find((p) => p.id === id);
      setPinned(id, !pane?.pinned);
    },
    [panes, setPinned],
  );

  const loadDemo = useCallback(
    (wsId?: string) => {
      const cfg = loadMcpConfig();
      const next = DEMO_FLEET.map((p) => {
        const snap = snapshotMcpForHarness(cfg, p.harness);
        return applyMcpSnapshotToPane({ ...p }, snap);
      });
      setPanes(next);
      setWorkspaces(WORKSPACES.map((w) => ({ ...w, harnesses: [...w.harnesses] })));
      setMode("fleet");
      const target = wsId ?? "ws-harness";
      setActiveWorkspaceId(target);
      setOrders(
        Object.fromEntries(
          WORKSPACES.map((w) => {
            const ps = next.filter((p) => p.workspaceId === w.id);
            return [w.id, defaultOrder(ps)];
          }),
        ),
      );
      setSelected(defaultOrder(next.filter((p) => p.workspaceId === target))[0] ?? null);
      setExpanded(Object.fromEntries(WORKSPACES.map((w) => [w.id, true])));
      for (const w of WORKSPACES) registerWorktreeRoot(w.path);
      seedTimelineFromFleet(next);
      publishStatus({
        kind: "system",
        message: "Demo fleet loaded",
        source: "mock",
      });
      void (async () => {
        for (const p of next) {
          const root = WORKSPACES.find((w) => w.id === p.workspaceId)?.path ?? p.worktree;
          registerWorktreeRoot(root);
          if (p.harness.includes("claude") || p.harness === "claude-code") {
            await spawnClaude({
              paneId: p.id,
              cwd: root,
              worktree: p.worktree,
              role: p.role,
              workspaceId: p.workspaceId,
            });
          } else {
            await spawnAgent({
              paneId: p.id,
              harness: p.harness,
              cwd: root,
              worktree: p.worktree,
              role: p.role,
              workspaceId: p.workspaceId,
            });
          }
        }
        flash("Demo fleet loaded · spawn jobs queued");
      })();
    },
    [flash],
  );

  const movePaneToWorkspace = (paneId: string, targetWorkspaceId: string) => {
    const pane = panes.find((p) => p.id === paneId);
    if (!pane || pane.workspaceId === targetWorkspaceId) {
      setDropTargetId(null);
      return;
    }
    setPanes((prev) =>
      prev.map((p) => (p.id === paneId ? { ...p, workspaceId: targetWorkspaceId } : p)),
    );
    setOrders((o) => ({
      ...o,
      [pane.workspaceId]: (o[pane.workspaceId] ?? []).filter((id) => id !== paneId),
      [targetWorkspaceId]: [...(o[targetWorkspaceId] ?? []), paneId],
    }));
    setActiveWorkspaceId(targetWorkspaceId);
    setSelected(paneId);
    setDropTargetId(null);
    flash(`Moved ${pane.name}`);
  };

  const promoteStack = (paneId: string) => {
    setOrders((o) => {
      const pinIds = panesInWorkspace.filter((p) => p.pinned).map((p) => p.id);
      const cur = o[activeWorkspaceId] ?? panesInWorkspace.map((p) => p.id);
      const without = cur.filter((id) => id !== paneId && !pinIds.includes(id));
      return { ...o, [activeWorkspaceId]: [...pinIds, paneId, ...without] };
    });
  };

  const renamePane = (id: string, name: string) => {
    setPanes((prev) => prev.map((p) => (p.id === id ? { ...p, name } : p)));
    flash(`Renamed → ${name}`);
  };

  const closePane = async (id: string): Promise<CloseConfirmResult> => {
    const pane = panes.find((p) => p.id === id);
    if (!pane) {
      return { ok: false, message: "Pane not found", error: "not_found" };
    }

    await killPaneAgent(id);

    if (pane.worktree) {
      const root =
        workspaces.find((w) => w.id === pane.workspaceId)?.path ??
        pane.worktree.replace(/\/\.worktrees\/.*$/, "") ??
        "";
      if (root) registerWorktreeRoot(root);
      registerWorktreeRoot(pane.worktree.replace(/\/\.worktrees\/.*$/, "") || root);
      const r = await destroyWorktree(pane.worktree, { force: true, paneId: id });
      publishStatus({
        kind: "worktree",
        paneId: id,
        message: r.ok
          ? `Destroyed worktree ${pane.worktree} (${r.host})`
          : `Worktree destroy blocked: ${r.error}`,
        source: r.host === "tauri" ? "git" : "mock",
      });
      if (!r.ok) {
        return {
          ok: false,
          message: r.error ?? "destroy failed",
          error: r.error,
          destroyed: false,
        };
      }
    }

    setPanes((prev) => prev.filter((p) => p.id !== id));
    setOrders((o) => {
      const next: Record<string, string[]> = {};
      for (const [ws, ids] of Object.entries(o)) next[ws] = ids.filter((x) => x !== id);
      return next;
    });
    if (selected === id) {
      setSelected(panesInWorkspace.find((p) => p.id !== id)?.id ?? null);
    }

    const message = `Destroyed worktree ${pane.worktree} · closed ${pane.name}`;
    flash(message);
    return { ok: true, message, destroyed: true };
  };

  const replyToPane = (paneId: string, text: string) => {
    setPanes((prev) =>
      prev.map((p) =>
        p.id === paneId
          ? { ...p, status: "working", attention: undefined, queueDepth: 0 }
          : p,
      ),
    );
    flash(`Replied to ${panes.find((p) => p.id === paneId)?.name ?? paneId}`);
  };

  const applyPreset = (preset: LayoutPreset) => {
    const ws = workspaces.find((w) => w.path === preset.workspacePath);
    if (ws) {
      setActiveWorkspaceId(ws.id);
      setOrders((o) => ({ ...o, [ws.id]: preset.order }));
      setPanes((prev) =>
        prev.map((p) =>
          p.workspaceId === ws.id
            ? { ...p, pinned: preset.pinnedIds.includes(p.id) }
            : p,
        ),
      );
    }
  };

  const spawnRecipe = (recipe: StoredRecipe) => {
    if (mode !== "fleet") loadDemo();
    flash(`Recipe "${recipe.title}" — spawn mock`);
    setFeature(null);
  };

  const applyPanesPatch = (next: Pane[]) => {
    const byId = new Map(next.map((p) => [p.id, p]));
    setPanes((prev) =>
      prev.map((p) => {
        const u = byId.get(p.id);
        return u ? { ...p, ownedPaths: u.ownedPaths, role: u.role } : p;
      }),
    );
  };

  const paletteActions: PaletteAction[] = useMemo(() => {
    const acts: PaletteAction[] = [
      {
        id: "demo",
        label: "Open demo fleet",
        group: "Session",
        run: () => {
          loadDemo();
          setPaletteOpen(false);
        },
      },
      {
        id: "wizard",
        label: "New agent wizard",
        hint: "⌘N",
        group: "Session",
        run: () => {
          setWizardOpen(true);
          setPaletteOpen(false);
        },
      },
      {
        id: "theme-dark",
        label: "Theme: Dark",
        group: "Appearance",
        run: () => {
          setThemePref("dark");
          setPaletteOpen(false);
          flash("Theme → dark");
        },
      },
      {
        id: "theme-light",
        label: "Theme: Light",
        group: "Appearance",
        run: () => {
          setThemePref("light");
          setPaletteOpen(false);
          flash("Theme → light");
        },
      },
      {
        id: "theme-system",
        label: "Theme: System",
        group: "Appearance",
        run: () => {
          setThemePref("system");
          setPaletteOpen(false);
          flash("Theme → system");
        },
      },
      {
        id: "settings",
        label: "Open settings",
        hint: "⌘,",
        group: "Session",
        run: () => {
          setSettingsOpen(true);
          setPaletteOpen(false);
        },
      },
      {
        id: "keys",
        label: "Keyboard hints",
        hint: "?",
        group: "Session",
        run: () => {
          setHintsOpen(true);
          setPaletteOpen(false);
        },
      },
    ];
    for (const f of FEATURE_LAUNCHERS) {
      acts.push({
        id: `feat-${f.id}`,
        label: f.label,
        group: "Features",
        run: () => {
          if (mode !== "fleet" && f.id !== "matrix" && f.id !== "recipes" && f.id !== "mcp")
            loadDemo();
          setFeature(f.id);
          setPaletteOpen(false);
        },
      });
    }
    acts.push({
      id: "attention-next",
      label: "Focus next attention",
      hint: "⌘⇧A",
      group: "Fleet",
      run: () => {
        const next = needsYou[0];
        if (next) jumpToPane(next.id);
        else flash("No attention items");
        setPaletteOpen(false);
      },
    });
    if (selected) {
      acts.push({
        id: "pin-sel",
        label: "Toggle pin selected",
        hint: "⌘P",
        group: "Fleet",
        run: () => {
          togglePin(selected);
          setPaletteOpen(false);
        },
      });
    }
    for (const ws of workspaces) {
      acts.push({
        id: `ws-${ws.id}`,
        label: `Goto workspace: ${ws.name}`,
        group: "Workspaces",
        run: () => {
          if (mode !== "fleet") loadDemo();
          selectWorkspace(ws.id);
          setPaletteOpen(false);
        },
      });
    }
    return acts;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, needsYou, selected, workspaces, loadDemo, jumpToPane, togglePin, flash, setThemePref]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target) && e.key !== "Escape") return;
      const mod = e.metaKey || e.ctrlKey;
      if (e.key === "?" && !mod) {
        e.preventDefault();
        setHintsOpen((v) => !v);
        return;
      }
      if (e.key === "Escape") {
        setHintsOpen(false);
        setPaletteOpen(false);
        setWizardOpen(false);
        setFeature(null);
        setMcpInspectId(null);
        setSettingsOpen(false);
        return;
      }
      if (mod && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
      if (mod && e.key === ",") {
        e.preventDefault();
        setSettingsOpen(true);
      }
      if (mod && e.key.toLowerCase() === "n") {
        e.preventDefault();
        setWizardOpen(true);
      }
      if (mod && e.shiftKey && e.key.toLowerCase() === "a") {
        e.preventDefault();
        const next = needsYou[0];
        if (next) jumpToPane(next.id);
        else {
          setFeature("inbox");
          if (mode !== "fleet") loadDemo();
        }
      }
      if (mod && e.key.toLowerCase() === "b") {
        e.preventDefault();
        if (mode !== "fleet") loadDemo();
        setFeature("broadcast");
      }
      if (mod && (e.key === "1" || e.key === "2" || e.key === "3")) {
        e.preventDefault();
        setTab(e.key === "1" ? "command" : e.key === "2" ? "monitoring" : "context");
      }
      if (mod && e.key.toLowerCase() === "p" && selected) {
        e.preventDefault();
        togglePin(selected);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected, togglePin, needsYou, jumpToPane, mode, loadDemo]);

  return (
    <div className="app-grid relative flex h-dvh min-h-0 flex-col overflow-hidden text-fg">
      <div className="app-scan absolute inset-0 z-0 opacity-40" aria-hidden />

      <header className="relative z-10 flex h-11 shrink-0 items-center gap-2 border-b border-border bg-surface/95 px-3">
        <div className="flex items-center gap-2">
          <div className="flex size-6 items-center justify-center rounded-sm border border-border bg-elevated">
            <Terminal className="size-3.5 text-accent" />
          </div>
          <div className="leading-tight">
            <div className="font-mono text-[11px] font-semibold">AGENT COMMAND CENTER</div>
            <div className="label-caps text-[9px] text-subtle">
              theme {themePref}
              {themeMounted && themePref === "system" ? ` · ${themeResolved}` : ""}
            </div>
          </div>
        </div>

        <nav className="ml-2 flex gap-0.5 rounded-md border border-border bg-elevated p-0.5 sm:ml-4">
          {(
            [
              { id: "command" as const, label: "Command", icon: LayoutGrid },
              { id: "monitoring" as const, label: "Monitoring", icon: Activity },
              { id: "context" as const, label: "Context", icon: Network },
              ...(persona === "admin"
                ? [{ id: "admin" as const, label: "Admin", icon: Shield }]
                : []),
            ] as const
          ).map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id as TabId)}
              className={`flex items-center gap-1.5 rounded-sm px-2.5 py-1 text-xs ${
                tab === id ? "bg-panel text-fg" : "text-muted hover:text-fg"
              }`}
            >
              <Icon className="size-3.5" />
              <span className="hidden sm:inline">{label}</span>
            </button>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-1.5">
          {mode === "fleet" && (
            <span className="hidden font-mono text-[10px] text-accent lg:inline">
              cost {layoutPreview.surfaceCost}/{panesInWorkspace.length || 0}
            </span>
          )}
          <EntitlementsChip
            entitlements={entitlements}
            onOpenMission={() => setFeature("mission")}
          />
          <label className="hidden items-center gap-1 sm:flex" title="Console persona">
            <span className="label-caps text-[9px] text-subtle">persona</span>
            <select
              value={persona}
              onChange={(e) => {
                const next = e.target.value as PersonaId;
                setPersona(next);
                savePersona(next);
                if (next === "admin") setTab("admin");
                else if (tab === "admin") setTab("command");
                flash(`Persona → ${getPersona(next).label}`);
              }}
              className="rounded-sm border border-border bg-elevated px-1.5 py-1 font-mono text-[10px] text-fg"
              aria-label="Persona"
            >
              {PERSONAS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>
          <span className="hidden font-mono text-[9px] text-subtle md:inline">
            {personaMeta.email}
          </span>
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            className="rounded-sm border border-border bg-elevated px-2 py-1 text-muted hover:text-fg"
            aria-label="Settings"
            title="Settings (⌘,)"
          >
            <Settings2 className="size-3.5" />
          </button>
          <ThemeToggle preference={themePref} onChange={setThemePref} compact />
          <button
            type="button"
            onClick={() => {
              if (mode !== "fleet") loadDemo();
              setFeature("inbox");
            }}
            className="relative rounded-sm border border-border bg-elevated px-2 py-1 text-muted hover:text-fg"
          >
            <AlertTriangle className="size-3.5" />
            {needsYou.length > 0 && (
              <span className="absolute -right-1 -top-1 flex size-3.5 items-center justify-center rounded-full bg-need font-mono text-[8px] text-bg">
                {needsYou.length}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setHintsOpen(true)}
            className="rounded-sm border border-border bg-elevated px-2 py-1 font-mono text-[11px] text-muted"
          >
            <Keyboard className="inline size-3" /> ?
          </button>
          <button
            type="button"
            onClick={() => setWizardOpen(true)}
            className="inline-flex items-center gap-1 rounded-sm border border-accent/40 bg-accent-dim px-2 py-1 font-mono text-[11px] text-accent"
          >
            <Plus className="size-3" />
            <span className="hidden sm:inline">NEW</span>
          </button>
          <button
            type="button"
            onClick={() => setPaletteOpen(true)}
            className="rounded-sm border border-border px-2 py-1 text-muted"
          >
            <Search className="size-3" />
          </button>
        </div>
      </header>

      <HostBridgeBanner onToast={flash} />

      <div className="relative z-10 flex shrink-0 items-center gap-1 overflow-x-auto border-b border-border bg-elevated/50 px-2 py-1">
        <span className="label-caps mr-1 shrink-0">Features</span>
        {FEATURE_LAUNCHERS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => {
              if (
                mode !== "fleet" &&
                id !== "matrix" &&
                id !== "recipes" &&
                id !== "mcp" &&
                id !== "mission" &&
                id !== "timeline"
              )
                loadDemo();
              if (id === "handoff") {
                requestGate("handoff", () => setFeature("handoff"));
                return;
              }
              if (id === "broadcast") {
                requestGate("broadcast", () => setFeature("broadcast"));
                return;
              }
              if (id === "runbook") {
                requestGate("runbook", () => setFeature("runbook"));
                return;
              }
              setFeature(id);
            }}
            className={`inline-flex shrink-0 items-center gap-1 rounded-sm border px-2 py-1 font-mono text-[10px] ${
              feature === id
                ? "border-accent bg-accent-dim text-accent"
                : "border-border bg-surface text-muted hover:text-fg"
            }`}
          >
            <Icon className="size-3" />
            {label}
            {id === "inbox" && needsYou.length > 0 && (
              <span className="text-need">{needsYou.length}</span>
            )}
          </button>
        ))}
      </div>

      {mode === "fleet" && tab === "command" && (
        <div className="relative z-10 flex shrink-0 items-center gap-1.5 overflow-x-auto border-b border-border bg-elevated/30 px-3 py-1.5">
          <span className="label-caps mr-1">Tree</span>
          {tree.map(({ root, children }) => {
            const rootCount = allPanes.filter((p) => p.workspaceId === root.id).length;
            const childCount = children.reduce(
              (n, c) => n + allPanes.filter((p) => p.workspaceId === c.id).length,
              0,
            );
            return (
              <div key={root.id} className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  onClick={() => selectWorkspace(root.id)}
                  className={`rounded-sm border px-2 py-1 font-mono text-[11px] ${
                    root.id === activeWorkspaceId
                      ? "border-accent bg-accent-dim text-accent"
                      : "border-border bg-surface text-muted hover:text-fg"
                  }`}
                >
                  {root.name}
                  <span className="ml-1 text-subtle">{rootCount + childCount}</span>
                </button>
                {children.map((c) => {
                  const n = allPanes.filter((p) => p.workspaceId === c.id).length;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => selectWorkspace(c.id)}
                      className={`rounded-sm border px-2 py-1 font-mono text-[10px] ${
                        c.id === activeWorkspaceId
                          ? "border-accent/60 bg-accent-dim/60 text-accent"
                          : "border-border/80 text-subtle hover:text-fg"
                      }`}
                    >
                      ↳ {c.lane ?? c.name}
                      <span className="ml-1">{n}</span>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}

      <div className="relative z-10 flex min-h-0 flex-1">
        {tab === "admin" && persona === "admin" && (
          <div className="min-h-0 flex-1 overflow-hidden">
            <AdminConsole onToast={flash} />
          </div>
        )}
        {tab === "command" && (
          <CommandView
            mode={mode}
            workspaces={workspaces}
            tree={tree}
            activeWorkspace={activeWorkspace}
            activeWorkspaceId={activeWorkspaceId}
            allPanes={allPanes}
            panesInWorkspace={panesInWorkspace}
            order={orderForWs}
            selected={selected}
            expanded={expanded}
            dropTargetId={dropTargetId}
            layoutSummary={layoutPreview.summary}
            themePref={themePref}
            onTheme={setThemePref}
            onToggleExpand={(id) =>
              setExpanded((e) => ({ ...e, [id]: !(e[id] ?? true) }))
            }
            onSelectWorkspace={selectWorkspace}
            onSelectPane={setSelected}
            onOpenWizard={() => setWizardOpen(true)}
            onLoadDemo={() => loadDemo()}
            onClearDemo={() => {
              setMode("empty");
              setPanes([]);
              setOrders({});
              setSelected(null);
            }}
            onDropTarget={setDropTargetId}
            onMovePane={movePaneToWorkspace}
            onReorder={(next) => setOrders((o) => ({ ...o, [activeWorkspaceId]: next }))}
            onRename={renamePane}
            onTogglePin={togglePin}
            onEnsurePin={(id) => setPinned(id, true)}
            onClose={closePane}
            onToast={flash}
            onPromoteStack={promoteStack}
            onOpenMcp={(id) => setMcpInspectId(id)}
            onOpenFeature={(id) => {
              if (mode !== "fleet") loadDemo();
              setFeature(id);
            }}
          />
        )}
        {tab === "monitoring" && (
          <MonitoringView
            workspaces={workspaces}
            panes={allPanes}
            mode={mode}
            onOpenTelemetry={() => setFeature("telemetry")}
          />
        )}
        {tab === "context" && (
          <div className="min-h-0 flex-1 overflow-auto p-4 sm:p-6">
            <div className="mx-auto max-w-3xl space-y-6">
              <div>
                <h2 className="font-mono text-lg font-semibold">Tokens · contrast · themes</h2>
                <p className="mt-1 text-xs text-muted">
                  CSS custom properties, WCAG audit, copyable theme toggle.
                </p>
                <button
                  type="button"
                  onClick={() => loadDemo()}
                  className="mt-3 rounded-sm border border-accent/40 bg-accent-dim px-3 py-1.5 font-mono text-[11px] text-accent"
                >
                  Load demo
                </button>
              </div>
              <ThemeDocsPanel
                preference={themePref}
                resolved={themeResolved}
                onTheme={setThemePref}
              />
              <section className="rounded-md border border-border bg-surface p-4">
                <h3 className="label-caps mb-2">Quick links</h3>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setFeature("mcp")}
                    className="rounded-sm border border-accent/40 bg-accent-dim px-2 py-1 font-mono text-[10px] text-accent"
                  >
                    MCP
                  </button>
                  <button
                    type="button"
                    onClick={() => setFeature("merge")}
                    className="rounded-sm border border-border px-2 py-1 font-mono text-[10px] text-muted"
                  >
                    Merge
                  </button>
                  <button
                    type="button"
                    onClick={() => setFeature("handoff")}
                    className="rounded-sm border border-border px-2 py-1 font-mono text-[10px] text-muted"
                  >
                    Handoff
                  </button>
                </div>
              </section>
            </div>
          </div>
        )}
      </div>

      {toast && (
        <div className="absolute bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-md border border-accent/40 bg-surface px-3 py-2 font-mono text-[11px] shadow-panel">
          {toast}
        </div>
      )}

      <PaletteV2 open={paletteOpen} onClose={() => setPaletteOpen(false)} actions={paletteActions} />

      {feature === "inbox" && (
        <AttentionInbox
          panes={allPanes}
          workspaces={workspaces}
          onJump={jumpToPane}
          onReply={replyToPane}
          onClose={() => setFeature(null)}
        />
      )}
      {feature === "ownership" && (
        <OwnershipMap
          panes={allPanes}
          onClose={() => setFeature(null)}
          onApplyPanes={applyPanesPatch}
          onToast={flash}
        />
      )}
      {feature === "recipes" && (
        <RecipeLibrary onSpawn={spawnRecipe} onClose={() => setFeature(null)} onToast={flash} />
      )}
      {feature === "telemetry" && (
        <TelemetryDrawer panes={allPanes} onClose={() => setFeature(null)} />
      )}
      {feature === "broadcast" && (
        <BroadcastComposer
          panes={allPanes}
          onSend={(ids, msg) => {
            for (const id of ids) replyToPane(id, `[broadcast] ${msg}`);
          }}
          onClose={() => setFeature(null)}
          onToast={flash}
        />
      )}
      {feature === "merge" && (
        <MergeGate
          panes={allPanes}
          workspace={activeWorkspace}
          onClose={() => setFeature(null)}
          onToast={flash}
          onApplyPanes={applyPanesPatch}
          onJump={jumpToPane}
        />
      )}
      {feature === "handoff" && (
        <HandoffPack
          workspaces={workspaces}
          panes={allPanes}
          focusWorkspaceId={activeWorkspaceId}
          onClose={() => setFeature(null)}
          onToast={flash}
        />
      )}
      {feature === "presets" && (
        <LayoutPresetsPanel
          workspace={activeWorkspace}
          order={orderForWs}
          panes={panesInWorkspace}
          onApply={applyPreset}
          onClose={() => setFeature(null)}
          onToast={flash}
        />
      )}
      {feature === "matrix" && <CapabilityMatrix onClose={() => setFeature(null)} />}
      {feature === "mcp" && (
        <McpControlCenter onClose={() => setFeature(null)} onToast={flash} />
      )}
      {feature === "diff" && (
        <DiffPrPane panes={allPanes} onClose={() => setFeature(null)} onToast={flash} />
      )}
      {feature === "runbook" && (
        <RunbookRunner
          entitlements={entitlements}
          onClose={() => setFeature(null)}
          onToast={flash}
          onGate={requestGate}
        />
      )}
      {feature === "heat" && (
        <ConflictHeatMap
          panes={allPanes}
          onClose={() => setFeature(null)}
          onJump={jumpToPane}
        />
      )}
      {feature === "timeline" && <SessionTimeline onClose={() => setFeature(null)} />}
      {feature === "orgmcp" && (
        <OrgMcpPolicy
          entitlements={entitlements}
          onClose={() => setFeature(null)}
          onToast={flash}
          onGate={requestGate}
        />
      )}
      {feature === "team_inbox" && (
        <SharedTeamInbox
          panes={allPanes}
          workspaces={workspaces}
          entitlements={entitlements}
          onJump={jumpToPane}
          onClose={() => setFeature(null)}
          onToast={flash}
          onGate={requestGate}
        />
      )}
      {feature === "mission" && (
        <WelcomeMission
          panes={allPanes}
          mode={mode}
          entitlements={entitlements}
          onEntitlements={(e) => {
            setEntitlements(e);
            saveEntitlements(e);
          }}
          onLoadDemo={() => loadDemo()}
          onOpenFeature={(id) => setFeature(id as FeatureId)}
          onClose={() => setFeature(null)}
          onToast={flash}
        />
      )}

      {softGate && (
        <SoftGateModal
          feature={softGate.feature}
          entitlements={entitlements}
          onEntitlements={(e) => {
            setEntitlements(e);
            saveEntitlements(e);
          }}
          onClose={() => setSoftGate(null)}
          onToast={flash}
          onProceed={softGate.proceed}
        />
      )}

      {mcpInspectId &&
        (() => {
          const pane = panes.find((p) => p.id === mcpInspectId);
          if (!pane) return null;
          return (
            <McpPaneInspector
              pane={pane}
              onClose={() => setMcpInspectId(null)}
              onOpenControlCenter={() => {
                setMcpInspectId(null);
                setFeature("mcp");
              }}
            />
          );
        })()}

      <WorkspaceWizard
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        onCreate={({ workspace, panes: newPanes }) => {
          const existing = workspaces.find((w) => w.path === workspace.path && !w.parentId);
          const targetId = existing?.id ?? workspace.id;
          setWorkspaces((prev) => {
            if (prev.some((w) => w.id === targetId)) {
              return prev.map((w) =>
                w.id === targetId
                  ? {
                      ...w,
                      name: workspace.name,
                      harnesses: Array.from(new Set([...w.harnesses, ...workspace.harnesses])),
                    }
                  : w,
              );
            }
            return [...prev, { ...workspace, id: targetId }];
          });
          const remapped = newPanes.map((pane, i) => ({
            ...pane,
            workspaceId: targetId,
            pinned: i === 0 && pane.role === "coordinator" ? true : pane.pinned,
          }));
          setPanes((prev) => [...prev.filter((p) => p.workspaceId !== targetId), ...remapped]);
          if (remapped.length) {
            setMode("fleet");
            setOrders((o) => ({ ...o, [targetId]: defaultOrder(remapped) }));
          }
          setActiveWorkspaceId(targetId);
          setSelected(defaultOrder(remapped)[0] ?? null);
          setWizardOpen(false);
          flash(`Workspace ${workspace.name} ready`);
        }}
      />
      <SettingsPanel
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        themePref={themePref}
        onTheme={setThemePref}
        onToast={flash}
      />
      <KeyboardHintsPanel open={hintsOpen} onClose={() => setHintsOpen(false)} />
    </div>
  );
}

function CommandView(props: {
  mode: ViewMode;
  workspaces: Workspace[];
  tree: ReturnType<typeof workspaceTree>;
  activeWorkspace: Workspace | null;
  activeWorkspaceId: string;
  allPanes: Pane[];
  panesInWorkspace: Pane[];
  order: string[];
  selected: string | null;
  expanded: Record<string, boolean>;
  dropTargetId: string | null;
  layoutSummary: string;
  themePref: "dark" | "light" | "system";
  onTheme: (p: "dark" | "light" | "system") => void;
  onToggleExpand: (id: string) => void;
  onSelectWorkspace: (id: string) => void;
  onSelectPane: (id: string) => void;
  onOpenWizard: () => void;
  onLoadDemo: () => void;
  onClearDemo: () => void;
  onDropTarget: (id: string | null) => void;
  onMovePane: (paneId: string, wsId: string) => void;
  onReorder: (order: string[]) => void;
  onRename: (id: string, name: string) => void;
  onTogglePin: (id: string) => void;
  onEnsurePin: (id: string) => void;
  onClose: (id: string) => void;
  onToast: (msg: string) => void;
  onPromoteStack: (id: string) => void;
  onOpenMcp?: (id: string) => void;
  onOpenFeature: (id: Exclude<FeatureId, null>) => void;
}) {
  const p = props;

  if (p.mode === "empty") {
    return (
      <main className="flex flex-1 flex-col justify-center p-6 sm:p-10">
        <div className="mx-auto max-w-2xl">
          <p className="label-caps text-accent">Tokens · AA contrast · themes</p>
          <h1 className="mt-1 font-mono text-2xl font-semibold sm:text-3xl">
            Dark, light, or system
          </h1>
          <p className="mt-2 text-sm text-muted">
            Header toggle, Context tab docs, or ⌘K Appearance. Open Context for contrast audit and
            copyable snippet.
          </p>
          <div className="mt-4">
            <ThemeToggle preference={p.themePref} onChange={p.onTheme} />
          </div>
          <button
            type="button"
            onClick={p.onLoadDemo}
            className="mt-6 inline-flex items-center gap-2 rounded-md bg-accent px-4 py-2.5 text-sm font-semibold text-accent-fg"
          >
            <Radio className="size-4" />
            Open demo
          </button>
          <div className="mt-6 flex flex-wrap gap-1.5">
            {FEATURE_LAUNCHERS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => p.onOpenFeature(id)}
                className="inline-flex items-center gap-1 rounded-sm border border-border bg-elevated px-2 py-1 font-mono text-[10px] text-muted hover:border-accent/40 hover:text-fg"
              >
                <Icon className="size-3" />
                {label}
              </button>
            ))}
          </div>
        </div>
      </main>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
      <aside className="flex max-h-48 w-full shrink-0 flex-col border-b border-border bg-surface/90 lg:max-h-none lg:w-60 lg:border-b-0 lg:border-r">
        <div className="flex items-center justify-between border-b border-border px-2 py-1.5">
          <span className="label-caps">Directory</span>
          <button type="button" onClick={p.onOpenWizard} className="text-muted hover:text-fg">
            <Plus className="size-3.5" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-1.5">
          {p.tree.map(({ root, children }) => (
            <WorkspaceNode
              key={root.id}
              root={root}
              childrenWs={children}
              allPanes={p.allPanes}
              activeWorkspaceId={p.activeWorkspaceId}
              selected={p.selected}
              expanded={p.expanded}
              dropTargetId={p.dropTargetId}
              onToggleExpand={p.onToggleExpand}
              onSelectWorkspace={p.onSelectWorkspace}
              onSelectPane={p.onSelectPane}
              onDropTarget={p.onDropTarget}
              onMovePane={p.onMovePane}
              onTogglePin={p.onTogglePin}
            />
          ))}
        </div>
        <div className="border-t border-border p-1.5">
          <p className="mb-1 px-1 font-mono text-[9px] text-subtle">{p.layoutSummary}</p>
          <button
            type="button"
            onClick={p.onClearDemo}
            className="flex w-full items-center justify-center gap-1 rounded-sm border border-border py-1 font-mono text-[10px] text-muted"
          >
            <X className="size-3" /> Close fleet
          </button>
        </div>
      </aside>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        {p.activeWorkspace && (
          <div className="flex flex-wrap items-center gap-2 border-b border-border bg-surface/50 px-3 py-1.5">
            <FolderGit2 className="size-3.5 text-accent" />
            <span className="font-mono text-xs font-semibold">
              {p.activeWorkspace.parentId ? "↳ " : ""}
              {p.activeWorkspace.name}
            </span>
            <span className="label-caps">{p.panesInWorkspace.length} panes</span>
          </div>
        )}
        <PaneGrid
          panes={p.panesInWorkspace}
          selectedId={p.selected}
          onSelect={p.onSelectPane}
          order={p.order}
          onReorder={p.onReorder}
          workspaces={p.workspaces}
          onRename={p.onRename}
          onTogglePin={p.onTogglePin}
          onEnsurePin={p.onEnsurePin}
          onMoveToWorkspace={p.onMovePane}
          onClose={p.onClose}
          onToast={p.onToast}
          onPromoteStack={p.onPromoteStack}
          onOpenMcp={p.onOpenMcp}
        />
      </div>
    </div>
  );
}

function WorkspaceNode({
  root,
  childrenWs,
  allPanes,
  activeWorkspaceId,
  selected,
  expanded,
  dropTargetId,
  onToggleExpand,
  onSelectWorkspace,
  onSelectPane,
  onDropTarget,
  onMovePane,
  onTogglePin,
}: {
  root: Workspace;
  childrenWs: Workspace[];
  allPanes: Pane[];
  activeWorkspaceId: string;
  selected: string | null;
  expanded: Record<string, boolean>;
  dropTargetId: string | null;
  onToggleExpand: (id: string) => void;
  onSelectWorkspace: (id: string) => void;
  onSelectPane: (id: string) => void;
  onDropTarget: (id: string | null) => void;
  onMovePane: (paneId: string, wsId: string) => void;
  onTogglePin: (id: string) => void;
}) {
  const nodes = [root, ...childrenWs];
  return (
    <div className="mb-2">
      {nodes.map((node) => {
        const panes = allPanes.filter((p) => p.workspaceId === node.id);
        const on = node.id === activeWorkspaceId;
        const isOpen = expanded[node.id] ?? true;
        const isChild = Boolean(node.parentId);
        return (
          <div
            key={node.id}
            onDragOver={(e) => {
              e.preventDefault();
              onDropTarget(node.id);
            }}
            onDrop={(e) => {
              e.preventDefault();
              const id =
                e.dataTransfer.getData(DND_MIME) || e.dataTransfer.getData("text/plain");
              if (id) onMovePane(id, node.id);
              onDropTarget(null);
            }}
            className={`mb-0.5 rounded-md border ${
              dropTargetId === node.id
                ? "border-accent ring-1 ring-accent/40"
                : on
                  ? "border-accent/35 bg-accent-dim/15"
                  : "border-transparent"
            } ${isChild ? "ml-3" : ""}`}
          >
            <div className="flex items-center">
              <button
                type="button"
                onClick={() => onToggleExpand(node.id)}
                className="px-1 text-muted"
              >
                {isOpen ? (
                  <ChevronDown className="size-3" />
                ) : (
                  <ChevronRight className="size-3" />
                )}
              </button>
              <button
                type="button"
                onClick={() => onSelectWorkspace(node.id)}
                className="flex min-w-0 flex-1 items-center gap-1 py-1.5 pr-1.5 text-left"
              >
                <FolderGit2 className={`size-3 ${on ? "text-accent" : "text-muted"}`} />
                <span className="truncate font-mono text-[11px] font-semibold">
                  {isChild ? node.lane ?? node.name : node.name}
                </span>
                <span className="ml-auto font-mono text-[10px] text-subtle">{panes.length}</span>
              </button>
            </div>
            {isOpen &&
              panes.map((pane) => (
                <div
                  key={pane.id}
                  className={`flex w-full items-center gap-1 px-2 py-1 font-mono text-[10px] ${
                    selected === pane.id ? "bg-accent-dim/40 text-fg" : "text-muted"
                  }`}
                >
                  <button
                    type="button"
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData(DND_MIME, pane.id);
                      e.dataTransfer.setData("text/plain", pane.id);
                    }}
                    onClick={() => {
                      onSelectWorkspace(node.id);
                      onSelectPane(pane.id);
                    }}
                    className="flex min-w-0 flex-1 items-center gap-1 text-left hover:text-fg"
                  >
                    <GripVertical className="size-2.5 shrink-0 text-subtle" />
                    <span className="truncate uppercase">{pane.name}</span>
                    <RolePill role={pane.role} />
                  </button>
                  <button
                    type="button"
                    title={pane.pinned ? "Unpin" : "Pin"}
                    onClick={() => onTogglePin(pane.id)}
                    className={`rounded p-0.5 ${pane.pinned ? "text-accent" : "text-subtle"}`}
                  >
                    <Pin className="size-3" />
                  </button>
                </div>
              ))}
          </div>
        );
      })}
    </div>
  );
}

function MonitoringView({
  workspaces,
  panes,
  mode,
  onOpenTelemetry,
}: {
  workspaces: Workspace[];
  panes: Pane[];
  mode: ViewMode;
  onOpenTelemetry: () => void;
}) {
  return (
    <div className="min-h-0 flex-1 overflow-auto p-6">
      <div className="flex items-center justify-between">
        <h2 className="font-mono text-lg font-semibold">Fleet health</h2>
        <button
          type="button"
          onClick={onOpenTelemetry}
          className="rounded-sm border border-border px-2 py-1 font-mono text-[10px] text-accent"
        >
          Honest telemetry →
        </button>
      </div>
      {mode !== "fleet" ? (
        <p className="mt-8 text-center text-sm text-muted">No fleet</p>
      ) : (
        workspaces.map((ws) => {
          const rows = panes.filter((p) => p.workspaceId === ws.id);
          if (!rows.length) return null;
          return (
            <div key={ws.id} className="mt-3 rounded-md border border-border bg-surface">
              <div className="border-b border-border px-3 py-2 font-mono text-xs font-semibold">
                {ws.parentId ? "↳ " : ""}
                {ws.name}
              </div>
              {rows.map((pane) => (
                <div
                  key={pane.id}
                  className="flex flex-wrap items-center gap-2 border-b border-border/50 px-3 py-2 text-xs"
                >
                  {pane.pinned && <Pin className="size-3 text-accent" />}
                  <span className="font-mono uppercase">{pane.name}</span>
                  <RolePill role={pane.role} />
                  <StatusPill status={pane.status} />
                  <TelemetryChip state={pane.telemetry} />
                </div>
              ))}
            </div>
          );
        })
      )}
    </div>
  );
}
