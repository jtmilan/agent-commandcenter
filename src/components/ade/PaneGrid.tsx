import {
  useCallback,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type DragEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type SetStateAction,
} from "react";
import { GripVertical, LayoutGrid, Pin } from "lucide-react";
import { ClosePaneDialog } from "./ClosePaneDialog";
import { RolePill, StatusPill, TelemetryChip } from "./badges";
import { layoutMathBlurb, packWorkspace } from "./layout";
import { PaneMenu } from "./PaneMenu";
import type { Pane, Role, Workspace } from "./types";

const PANE_MIME = "application/x-pane-slot";
const MIN_WEIGHT = 0.35;

function scrollbackFor(pane: Pane): string[] {
  const role = pane.role === "none" ? "agent" : pane.role;
  const lines = [
    `$ agent attach ${pane.id} --role ${role}`,
    `[${pane.harness}] worktree ${pane.worktree}`,
    `branch ${pane.branch} · telemetry ${pane.telemetry}`,
  ];
  if (pane.role === "coordinator") {
    lines.push("", "Watcher armed: 30s poll.", "• All lanes committed. Integrating…");
  } else if (pane.status === "needs_input") {
    lines.push("", `> needs_input: ${pane.attention ?? "awaiting operator"}`);
  } else if (pane.status === "blocked") {
    lines.push("", `blocked: ${pane.attention ?? pane.lastToolFailure ?? "waiting"}`);
  } else {
    lines.push(
      "",
      `Lane task on ${pane.harness}…`,
      pane.ownedPaths?.length ? `owned: ${pane.ownedPaths.join(", ")}` : "owned: (none)",
      pane.mcpServerIds?.length
        ? `mcp: ${pane.mcpServerIds.length} servers · ${(pane.mcpToolNames ?? []).slice(0, 4).join(", ")}${(pane.mcpToolNames?.length ?? 0) > 4 ? "…" : ""}`
        : "mcp: (binding at spawn)",
      "Worked for 21s · hooks 2/1",

    );
  }
  return lines;
}

function statusBorder(status: Pane["status"]): string {
  if (status === "needs_input") return "border-need/55 ring-1 ring-need/25";
  if (status === "blocked" || status === "error") return "border-danger/45";
  return "border-border";
}

function statusLetter(status: Pane["status"]): string {
  switch (status) {
    case "working":
      return "W";
    case "needs_input":
      return "I";
    case "blocked":
      return "B";
    case "error":
      return "E";
    case "idle":
      return "·";
    case "starting":
      return "S";
    default:
      return "?";
  }
}

export function arrangePanes(panes: Pane[]): { primary: Pane | null; rest: Pane[] } {
  if (panes.length === 0) return { primary: null, rest: [] };
  const coord =
    panes.find((p) => p.pinned) ??
    panes.find((p) => p.role === "coordinator") ??
    panes[0]!;
  return { primary: coord, rest: panes.filter((p) => p.id !== coord.id) };
}

type PaneActions = {
  workspaces: Workspace[];
  onRename: (id: string, name: string) => void;
  onTogglePin: (id: string) => void;
  onMoveToWorkspace: (paneId: string, workspaceId: string) => void;
  onRequestClose: (id: string) => void;
  onToast: (msg: string) => void;
  onOpenMcp?: (paneId: string) => void;
};

function useEdgeResize(

  weights: Record<string, number>,
  setWeights: Dispatch<SetStateAction<Record<string, number>>>,
) {
  return useCallback(
    (
      e: ReactPointerEvent,
      aId: string,
      bId: string | null,
      axis: "x" | "y",
      containerSize: number,
    ) => {
      e.preventDefault();
      e.stopPropagation();
      if (!bId || containerSize <= 0) return;
      const start = axis === "x" ? e.clientX : e.clientY;
      const wa = weights[aId] ?? 1;
      const wb = weights[bId] ?? 1;
      const total = wa + wb;

      const move = (ev: globalThis.PointerEvent) => {
        const delta = (axis === "x" ? ev.clientX : ev.clientY) - start;
        const frac = delta / containerSize;
        let na = Math.min(total - MIN_WEIGHT, Math.max(MIN_WEIGHT, wa + frac * total));
        let nb = total - na;
        if (nb < MIN_WEIGHT) {
          nb = MIN_WEIGHT;
          na = total - nb;
        }
        setWeights((w) => ({ ...w, [aId]: na, [bId]: nb }));
      };
      const up = () => {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
    },
    [weights, setWeights],
  );
}

function AgentPaneCard({
  pane,
  selected,
  pinReason,
  onSelect,
  onDropOn,
  compact,
  zoomed,
  onToggleZoom,
  actions,
}: {
  pane: Pane;
  selected: boolean;
  pinReason?: string;
  onSelect: () => void;
  onDropOn: (targetId: string, sourceId: string) => void;
  compact?: boolean;
  zoomed?: boolean;
  onToggleZoom?: () => void;
  actions: PaneActions;
}) {
  const lines = useMemo(() => scrollbackFor(pane), [pane]);
  const [dragOver, setDragOver] = useState(false);

  return (
    <article
      draggable
      onDragStart={(e) => {
        if ((e.target as HTMLElement).dataset?.resize) {
          e.preventDefault();
          return;
        }
        e.dataTransfer.setData(PANE_MIME, pane.id);
        e.dataTransfer.setData("text/plain", pane.id);
        e.dataTransfer.effectAllowed = "move";
      }}
      onDragOver={(e: DragEvent) => {
        if (
          !e.dataTransfer.types.includes(PANE_MIME) &&
          !e.dataTransfer.types.includes("text/plain")
        ) {
          return;
        }
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        const id =
          e.dataTransfer.getData(PANE_MIME) || e.dataTransfer.getData("text/plain");
        if (id && id !== pane.id) onDropOn(pane.id, id);
      }}
      onClick={onSelect}
      className={`relative flex h-full min-h-0 flex-col overflow-hidden rounded-md border bg-surface shadow-panel ${statusBorder(
        pane.status,
      )} ${selected ? "ring-1 ring-accent/40" : ""} ${dragOver ? "ring-2 ring-accent/60" : ""}`}
    >
      <header className="flex shrink-0 items-center gap-1.5 border-b border-border bg-elevated/80 px-2 py-1.5">
        <GripVertical className="size-3.5 shrink-0 cursor-grab text-subtle" />
        <span
          className={`flex size-4 shrink-0 items-center justify-center rounded-sm font-mono text-[9px] font-bold ${
            pane.status === "needs_input"
              ? "bg-need-dim text-need"
              : pane.status === "working"
                ? "bg-accent-dim text-accent"
                : "bg-panel text-subtle"
          }`}
        >
          {statusLetter(pane.status)}
        </span>
        <span className="min-w-0 truncate font-mono text-[11px] font-semibold uppercase text-fg">
          {pane.name}
        </span>
        <span className="hidden font-mono text-[9px] uppercase text-subtle sm:inline">
          {pane.harness}
        </span>
        <RolePill role={pane.role as Role} />
        {(pane.pinned || pinReason) && (
          <span
            className="inline-flex items-center gap-0.5 rounded-sm border border-accent/30 bg-accent-dim px-1 font-mono text-[9px] text-accent"
            title={pinReason}
          >
            <Pin className="size-2.5" />
            {pane.pinned ? "pin" : "auto"}
          </span>
        )}
        <span className="ml-auto flex items-center gap-0.5">
          <TelemetryChip state={pane.telemetry} />
          <span className="font-mono text-[10px] text-subtle">({statusLetter(pane.status)})</span>
          <PaneMenu
            pane={pane}
            workspaces={actions.workspaces}
            zoomed={zoomed}
            onRename={actions.onRename}
            onMaximize={() => onToggleZoom?.()}
            onTogglePin={actions.onTogglePin}
            onMoveToWorkspace={actions.onMoveToWorkspace}
            onRequestClose={actions.onRequestClose}
            onCopied={actions.onToast}
            onOpenMcp={actions.onOpenMcp}
          />
        </span>
      </header>

      <div
        className={`min-h-0 flex-1 overflow-auto bg-bg/80 px-2.5 py-2 font-mono leading-relaxed text-muted ${
          compact ? "text-[10px]" : "text-[11px]"
        }`}
      >
        {lines.map((line, i) => (
          <div
            key={i}
            className={
              line.startsWith(">")
                ? "text-need"
                : line.startsWith("•")
                  ? "text-fg/90"
                  : line.startsWith("$")
                    ? "text-subtle"
                    : ""
            }
          >
            {line || "\u00a0"}
          </div>
        ))}
        <div className="mt-2 text-accent">
          ▌ <span className="animate-pulse text-subtle">_</span>
        </div>
      </div>

      <footer className="shrink-0 border-t border-border bg-elevated/50 px-2 py-1">
        {pane.status === "needs_input" || pane.status === "blocked" ? (
          <div className="flex gap-1.5">
            <input
              onClick={(e) => e.stopPropagation()}
              placeholder="Reply…"
              className="min-w-0 flex-1 rounded-sm border border-border bg-surface px-2 py-1 font-mono text-[10px] text-fg focus:border-accent focus:outline-none"
            />
            <button
              type="button"
              onClick={(e) => e.stopPropagation()}
              className="rounded-sm bg-accent px-2 py-1 font-mono text-[10px] font-semibold text-accent-fg"
            >
              Send
            </button>
          </div>
        ) : (
          <div className="flex justify-between font-mono text-[9px] text-subtle">
            <span>
              {pane.harness} · {pane.branch}
            </span>
            <span className="hidden sm:inline">drag edges to resize</span>
          </div>
        )}
      </footer>
    </article>
  );
}

function ResizableSlot({
  paneId,
  weight,
  nextId,
  axis,
  onEdgeResize,
  children,
}: {
  paneId: string;
  weight: number;
  nextId: string | null;
  axis: "x" | "y";
  onEdgeResize: (
    e: ReactPointerEvent,
    aId: string,
    bId: string | null,
    axis: "x" | "y",
    containerSize: number,
  ) => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);

  return (
    <div ref={ref} className="relative min-h-0 min-w-0" style={{ flex: `${weight} 1 0%` }}>
      <div className="h-full min-h-[100px]">{children}</div>
      {nextId && (
        <div
          data-resize="1"
          role="separator"
          aria-orientation={axis === "x" ? "vertical" : "horizontal"}
          aria-label="Resize pane"
          onPointerDown={(e) => {
            const el = ref.current;
            if (!el) return;
            const rect = el.getBoundingClientRect();
            const siblingSize = axis === "x" ? rect.width : rect.height;
            // Pair size ≈ this slot + estimated next of equal weight
            const pair = siblingSize * 2;
            onEdgeResize(e, paneId, nextId, axis, pair);
          }}
          className={
            axis === "x"
              ? "absolute inset-y-0 right-0 z-20 w-1.5 translate-x-1/2 cursor-col-resize hover:bg-accent/40 active:bg-accent/60"
              : "absolute inset-x-0 bottom-0 z-20 h-1.5 translate-y-1/2 cursor-row-resize hover:bg-accent/40 active:bg-accent/60"
          }
        />
      )}
    </div>
  );
}

export function PaneGrid({
  panes,
  selectedId,
  onSelect,
  order,
  onReorder,
  workspaces,
  onRename,
  onTogglePin,
  onEnsurePin,
  onMoveToWorkspace,
  onClose,
  onToast,
  onPromoteStack,
  onOpenMcp,
}: {
  panes: Pane[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  order: string[];
  onReorder: (nextOrder: string[]) => void;
  workspaces: Workspace[];
  onRename: (id: string, name: string) => void;
  onTogglePin: (id: string) => void;
  onEnsurePin: (id: string) => void;
  onMoveToWorkspace: (paneId: string, workspaceId: string) => void;
  onClose: (id: string) => void;
  onToast: (msg: string) => void;
  onPromoteStack: (paneId: string) => void;
  onOpenMcp?: (paneId: string) => void;
}) {
  const [splitPct, setSplitPct] = useState(40);
  const [draggingSplit, setDraggingSplit] = useState(false);
  const [zoomedId, setZoomedId] = useState<string | null>(null);
  const [weights, setWeights] = useState<Record<string, number>>({});
  const [pendingCloseId, setPendingCloseId] = useState<string | null>(null);
  const shellRef = useRef<HTMLDivElement>(null);

  const onEdgeResize = useEdgeResize(weights, setWeights);
  const weightOf = (id: string) => weights[id] ?? 1;

  const actions: PaneActions = {
    workspaces,
    onRename,
    onTogglePin,
    onMoveToWorkspace,
    onRequestClose: setPendingCloseId,
    onToast,
    onOpenMcp,
  };

  const layout = useMemo(
    () => packWorkspace(panes, order, selectedId),
    [panes, order, selectedId],
  );

  const pinPanes = layout.pins.map((s) => s.pane);
  const focusPanes = layout.focus.map((s) => s.pane);
  const stackSlots = layout.stack;
  const pendingPane = panes.find((p) => p.id === pendingCloseId) ?? null;

  const autoArrange = () => {
    const pins = panes.filter((p) => p.pinned || p.role === "coordinator");
    const attention = panes.filter(
      (p) =>
        !pins.includes(p) &&
        (p.status === "needs_input" || p.status === "blocked" || p.status === "error"),
    );
    const rest = panes.filter((p) => !pins.includes(p) && !attention.includes(p));
    onReorder([...pins, ...attention, ...rest].map((p) => p.id));
    setWeights({});
    setSplitPct(40);
    setZoomedId(null);
    onToast("Auto-arranged — equal sizes · pins left · attention first");
  };

  const swapFocus = useCallback(
    (targetId: string, sourceId: string) => {
      const allIds = panes.map((p) => p.id);
      const ordered = [
        ...order.filter((id) => allIds.includes(id)),
        ...allIds.filter((id) => !order.includes(id)),
      ];
      const a = ordered.indexOf(sourceId);
      const b = ordered.indexOf(targetId);
      if (a < 0 || b < 0) return;
      const next = [...ordered];
      [next[a], next[b]] = [next[b]!, next[a]!];
      onReorder(next);
    },
    [order, onReorder, panes],
  );

  const onSplitPointer = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      const shell = shellRef.current;
      if (!shell) return;
      setDraggingSplit(true);
      const startX = e.clientX;
      const startPct = splitPct;
      const width = shell.getBoundingClientRect().width;
      const move = (ev: globalThis.PointerEvent) => {
        setSplitPct(Math.min(65, Math.max(26, startPct + ((ev.clientX - startX) / width) * 100)));
      };
      const up = () => {
        setDraggingSplit(false);
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
    },
    [splitPct],
  );

  const closeDialog = (
    <ClosePaneDialog
      open={Boolean(pendingCloseId)}
      pane={pendingPane}
      onCancel={() => setPendingCloseId(null)}
      onConfirm={(id) => {
        const p = panes.find((x) => x.id === id);
        setPendingCloseId(null);
        setZoomedId(null);
        onClose(id);
        onToast(
          p
            ? `Destroyed worktree ${p.worktree} · closed ${p.name}`
            : "Worktree destroyed · pane closed",
        );
      }}
    />
  );

  if (panes.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <p className="font-mono text-sm text-muted">No open harness panes</p>
      </div>
    );
  }

  if (zoomedId) {
    const z = panes.find((p) => p.id === zoomedId) ?? panes[0]!;
    return (
      <>
        <div className="flex min-h-0 flex-1 flex-col p-2">
          <div className="mb-2 flex gap-2">
            <button
              type="button"
              onClick={autoArrange}
              className="inline-flex items-center gap-1.5 rounded-sm border border-accent/40 bg-accent-dim px-2 py-1 font-mono text-[10px] text-accent"
            >
              <LayoutGrid className="size-3" />
              Auto-arrange
            </button>
          </div>
          <AgentPaneCard
            pane={z}
            selected
            pinReason={z.pinned ? "user-pin" : undefined}
            onSelect={() => onSelect(z.id)}
            onDropOn={() => {}}
            zoomed
            onToggleZoom={() => setZoomedId(null)}
            actions={actions}
          />
        </div>
        {closeDialog}
      </>
    );
  }

  const focusRows: Pane[][] = [];
  for (let i = 0; i < focusPanes.length; i += 2) {
    focusRows.push(focusPanes.slice(i, i + 2));
  }

  return (
    <>
      <div ref={shellRef} className="flex min-h-0 min-w-0 flex-1 flex-col">
        <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border bg-surface/60 px-2 py-1">
          <span className="label-caps">Open panes</span>
          <span className="font-mono text-[10px] text-accent">{layout.summary}</span>
          <span className="hidden font-mono text-[10px] text-subtle xl:inline">
            {layoutMathBlurb(panes.length, layout.surfaceCost)}
          </span>
          <button
            type="button"
            onClick={autoArrange}
            className="ml-auto inline-flex items-center gap-1.5 rounded-sm border border-accent/40 bg-accent-dim px-2.5 py-1 font-mono text-[10px] font-semibold text-accent hover:bg-accent/20"
            title="Equal weights · pins left · attention-first order"
          >
            <LayoutGrid className="size-3" />
            Auto-arrange
          </button>
        </div>

        <div className={`flex min-h-0 flex-1 ${draggingSplit ? "select-none" : ""}`}>
          <div
            className="flex min-h-0 min-w-0 flex-col gap-0 p-2 pr-0"
            style={{ width: pinPanes.length ? `${splitPct}%` : "0%" }}
          >
            {pinPanes.map((pane, i) => {
              const next = pinPanes[i + 1] ?? null;
              const slot = layout.pins.find((s) => s.pane.id === pane.id);
              return (
                <ResizableSlot
                  key={pane.id}
                  paneId={pane.id}
                  weight={weightOf(pane.id)}
                  nextId={next?.id ?? null}
                  axis="y"
                  onEdgeResize={onEdgeResize}
                >
                  <AgentPaneCard
                    pane={pane}
                    selected={selectedId === pane.id}
                    pinReason={slot?.reason}
                    onSelect={() => onSelect(pane.id)}
                    onDropOn={(_, source) => {
                      onEnsurePin(source);
                      onSelect(source);
                    }}
                    onToggleZoom={() => setZoomedId(pane.id)}
                    actions={actions}
                    compact={pinPanes.length > 1}
                  />
                </ResizableSlot>
              );
            })}
          </div>

          {pinPanes.length > 0 && (
            <div
              role="separator"
              aria-label="Resize pin column"
              onPointerDown={onSplitPointer}
              className={`group flex w-2 shrink-0 cursor-col-resize justify-center ${
                draggingSplit ? "bg-accent/20" : "hover:bg-accent/10"
              }`}
            >
              <div className="my-3 w-0.5 rounded-full bg-border group-hover:bg-accent/50" />
            </div>
          )}

          <div className="flex min-h-0 min-w-0 flex-1 flex-col p-2 pl-0">
            <div className="flex min-h-0 flex-1 flex-col gap-0">
              {focusPanes.length === 0 ? (
                <div className="flex flex-1 items-center justify-center rounded-md border border-dashed border-border font-mono text-[11px] text-subtle">
                  Focus empty — promote from stack
                </div>
              ) : (
                focusRows.map((row, ri) => {
                  const rowLead = row[0]!;
                  const nextRow = focusRows[ri + 1];
                  const nextRowLead = nextRow?.[0]?.id ?? null;
                  return (
                    <ResizableSlot
                      key={row.map((p) => p.id).join("-")}
                      paneId={`row:${rowLead.id}`}
                      weight={weightOf(`row:${rowLead.id}`)}
                      nextId={nextRowLead ? `row:${nextRowLead}` : null}
                      axis="y"
                      onEdgeResize={onEdgeResize}
                    >
                      <div className="flex h-full min-h-[110px] gap-0">
                        {row.map((pane, ci) => {
                          const nextInRow = row[ci + 1] ?? null;
                          return (
                            <ResizableSlot
                              key={pane.id}
                              paneId={pane.id}
                              weight={weightOf(pane.id)}
                              nextId={nextInRow?.id ?? null}
                              axis="x"
                              onEdgeResize={onEdgeResize}
                            >
                              <div className="h-full pr-1">
                                <AgentPaneCard
                                  pane={pane}
                                  selected={selectedId === pane.id}
                                  compact={focusPanes.length > 2}
                                  onSelect={() => onSelect(pane.id)}
                                  onDropOn={swapFocus}
                                  onToggleZoom={() => setZoomedId(pane.id)}
                                  actions={actions}
                                />
                              </div>
                            </ResizableSlot>
                          );
                        })}
                      </div>
                    </ResizableSlot>
                  );
                })
              )}
            </div>

            {stackSlots.length > 0 && (
              <div className="mt-2 shrink-0 rounded-md border border-border bg-elevated/60 px-2 py-1.5">
                <div className="mb-1 flex items-center justify-between">
                  <span className="label-caps">Stack · overflow</span>
                  <span className="font-mono text-[9px] text-subtle">
                    {stackSlots.length} collapsed · click to promote
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {stackSlots.map((s) => (
                    <button
                      key={s.pane.id}
                      type="button"
                      onClick={() => {
                        onPromoteStack(s.pane.id);
                        onSelect(s.pane.id);
                        onToast(`Promoted ${s.pane.name} → focus`);
                      }}
                      className="inline-flex items-center gap-1.5 rounded-sm border border-border bg-surface px-2 py-1 font-mono text-[10px] text-muted hover:border-accent/40 hover:text-fg"
                    >
                      <span
                        className={`size-1.5 rounded-full ${
                          s.pane.status === "working"
                            ? "bg-accent"
                            : s.pane.status === "needs_input"
                              ? "bg-need"
                              : "bg-subtle"
                        }`}
                      />
                      <span className="uppercase">{s.pane.name}</span>
                      <StatusPill status={s.pane.status} />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      {closeDialog}
    </>
  );
}
