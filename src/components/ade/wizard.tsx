import { useMemo, useState } from "react";
import {
  Cable,
  Check,
  ChevronLeft,
  FolderOpen,
  Grid3X3,
  Plus,
  Sparkles,
  Terminal,
  Trash2,
  X,
} from "lucide-react";
import {
  loadMcpConfig,
  resolveBindingServersForHarnessName,
  snapshotMcpForHarness,
  type BindMode,
} from "./mcpConfig";
import type { Pane, Role, Workspace } from "./types";

const HARNESSES = [
  "claude",
  "codex",
  "cursor",
  "opencode",
  "commandcode",
  "pi",
  "grok",
  "bash",
] as const;

const ROLES: { id: Role; label: string; hint: string }[] = [
  { id: "none", label: "None", hint: "No advisory role" },
  { id: "coordinator", label: "Coord", hint: "Plans & delegates" },
  { id: "builder", label: "Build", hint: "Implements changes" },
  { id: "scout", label: "Scout", hint: "Read-only explore" },
  { id: "reviewer", label: "Review", hint: "Critiques output" },
];

const COUNT_PRESETS = [1, 2, 3, 4, 6, 9] as const;

type Recipe = {
  id: string;
  title: string;
  summary: string;
  agents: { harness: string; role: Role }[];
};

const RECIPES: Recipe[] = [
  {
    id: "solo",
    title: "Solo Claude",
    summary: "One builder pane",
    agents: [{ harness: "claude", role: "builder" }],
  },
  {
    id: "pair",
    title: "Pair",
    summary: "Claude build + Codex review",
    agents: [
      { harness: "claude", role: "builder" },
      { harness: "codex", role: "reviewer" },
    ],
  },
  {
    id: "trio",
    title: "Review trio",
    summary: "Coord · build · review",
    agents: [
      { harness: "claude", role: "coordinator" },
      { harness: "cursor", role: "builder" },
      { harness: "codex", role: "reviewer" },
    ],
  },
  {
    id: "scout-build",
    title: "Scout first",
    summary: "Explore then implement",
    agents: [
      { harness: "opencode", role: "scout" },
      { harness: "claude", role: "builder" },
    ],
  },
];

const RECENT_FOLDERS = [
  "/Users/jeffrymilan/Personal/harness-ready",
  "/Users/jeffrymilan/Personal/agent-teams",
  "/Users/jeffrymilan/Personal/politics-tracker",
  "/Users/jeffrymilan/Memory",
  "/Users/jeffrymilan/Personal/glint",
  "/Users/jeffrymilan/flywheel-ver",
];

type AgentSlot = {
  id: string;
  harness: string;
  role: Role;
  model: string;
  mcpMode: BindMode;
  mcpPresetId: string;
};

type WizardResult = {
  workspace: Workspace;
  panes: Pane[];
  initialPrompt?: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  onCreate: (result: WizardResult) => void;
};

function folderName(path: string) {
  const parts = path.replace(/\/+$/, "").split("/");
  return parts[parts.length - 1] || "workspace";
}

function gridDims(n: number): { cols: number; rows: number } {
  if (n <= 1) return { cols: 1, rows: 1 };
  if (n === 2) return { cols: 2, rows: 1 };
  if (n <= 4) return { cols: 2, rows: 2 };
  if (n <= 6) return { cols: 3, rows: 2 };
  return { cols: 3, rows: 3 };
}

function defaultSlotMcp(harness: string): Pick<AgentSlot, "mcpMode" | "mcpPresetId"> {
  const cfg = loadMcpConfig();
  const fromHarness = harness === "bash" ? "preset-none" : harness === "codex" ? "preset-docs" : cfg.defaultPresetId;
  return { mcpMode: "preset", mcpPresetId: fromHarness };
}

export function WorkspaceWizard({ open, onClose, onCreate }: Props) {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [name, setName] = useState("");
  const [folder, setFolder] = useState(RECENT_FOLDERS[0] ?? "");
  const [slots, setSlots] = useState<AgentSlot[]>(() =>
    RECIPES[2]!.agents.map((a, i) => ({
      id: `s-${i}`,
      harness: a.harness,
      role: a.role,
      model: "",
      ...defaultSlotMcp(a.harness),
    })),
  );
  const [selectedSlot, setSelectedSlot] = useState(0);
  const [prompt, setPrompt] = useState("");
  const [recipeId, setRecipeId] = useState<string | null>("trio");
  const [globalMcpPreset, setGlobalMcpPreset] = useState(() => loadMcpConfig().defaultPresetId);

  const mcpCfg = useMemo(() => loadMcpConfig(), [step, slots, globalMcpPreset]);

  if (!open) return null;

  const displayName = name.trim() || folderName(folder);
  const count = slots.length;
  const dims = gridDims(count);
  const active = slots[selectedSlot] ?? slots[0];

  const applyRecipe = (r: Recipe) => {
    setRecipeId(r.id);
    setSlots(
      r.agents.map((a, i) => ({
        id: `s-${i}-${r.id}`,
        harness: a.harness,
        role: a.role,
        model: "",
        ...defaultSlotMcp(a.harness),
      })),
    );
    setSelectedSlot(0);
  };

  const setCount = (n: number) => {
    setRecipeId(null);
    setSlots((prev) => {
      if (n === prev.length) return prev;
      if (n < prev.length) return prev.slice(0, n);
      const next = [...prev];
      while (next.length < n) {
        next.push({
          id: `s-${Date.now()}-${next.length}`,
          harness: "claude",
          role: "none",
          model: "",
          ...defaultSlotMcp("claude"),
        });
      }
      return next;
    });
    setSelectedSlot((s) => Math.min(s, n - 1));
  };

  const updateSlot = (index: number, patch: Partial<AgentSlot>) => {
    setRecipeId(null);
    setSlots((prev) => prev.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  };

  const removeSlot = (index: number) => {
    if (slots.length <= 1) return;
    setRecipeId(null);
    setSlots((prev) => prev.filter((_, i) => i !== index));
    setSelectedSlot((s) => Math.max(0, Math.min(s, slots.length - 2)));
  };

  const applyGlobalPresetToAll = () => {
    setSlots((prev) =>
      prev.map((s) => ({
        ...s,
        mcpMode: "preset",
        mcpPresetId: globalMcpPreset,
      })),
    );
  };

  const create = () => {
    const id = `ws-${Date.now()}`;
    const harnesses = Array.from(new Set(slots.map((s) => s.harness)));
    const workspace: Workspace = {
      id,
      name: displayName,
      path: folder,
      harnesses,
    };
    const cfg = loadMcpConfig();
    const panes: Pane[] = slots.map((s, i) => {
      const snap = snapshotMcpForHarness(cfg, s.harness, {
        mode: s.mcpMode,
        presetId: s.mcpPresetId,
      });
      return {
        id: `p-${id}-${i}`,
        workspaceId: id,
        name: `${s.harness}-${s.role === "none" ? i + 1 : s.role}`,
        harness: s.harness,
        role: s.role,
        status: i === 0 ? "working" : "idle",
        branch: "main",
        worktree: `.agent-teams-worktrees/${s.harness}-${i + 1}`,
        telemetry: "live",
        gitClean: true,
        cpu: 2 + i,
        memMb: 180 + i * 40,
        queueDepth: 0,
        lastToolFailure: null,
        ...snap,
      };
    });
    onCreate({
      workspace,
      panes,
      initialPrompt: prompt.trim() || undefined,
    });
  };

  const canNext =
    step === 1
      ? folder.trim().length > 0
      : step === 2
        ? slots.length >= 1
        : step === 3
          ? slots.every((s) => s.harness)
          : true;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-bg/75 p-3 backdrop-blur-sm sm:p-6"
      role="dialog"
      aria-modal
      aria-labelledby="wizard-title"
    >
      <div className="flex max-h-[min(92dvh,720px)] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-panel">
        <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div>
            <h2 id="wizard-title" className="text-base font-semibold tracking-tight text-fg">
              {step === 1 && "Set up your workspace"}
              {step === 2 && "Choose a layout"}
              {step === 3 && "Configure agents"}
              {step === 4 && "MCP for spawn"}
            </h2>
            <p className="mt-0.5 text-xs text-muted">
              {step === 1 && "Pick a folder — harnesses attach to this project."}
              {step === 2 && "How many terminals, or jump in with a recipe."}
              {step === 3 && "Click a slot, then set harness and role."}
              {step === 4 && "Preview tools each pane receives — one config source."}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-muted hover:bg-elevated hover:text-fg"
            aria-label="Close wizard"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto border-b border-border px-5 py-3">
          {(
            [
              { n: 1 as const, label: "Start" },
              { n: 2 as const, label: "Layout" },
              { n: 3 as const, label: "Agents" },
              { n: 4 as const, label: "MCP" },
            ] as const
          ).map((s, i) => {
            const done = step > s.n;
            const current = step === s.n;
            return (
              <div key={s.n} className="flex shrink-0 items-center gap-2">
                {i > 0 && (
                  <div
                    className={`h-px w-4 sm:w-8 ${done || current ? "bg-accent/50" : "bg-border"}`}
                  />
                )}
                <button
                  type="button"
                  disabled={s.n > step}
                  onClick={() => s.n < step && setStep(s.n)}
                  className={`flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide ${
                    current
                      ? "bg-accent text-accent-fg"
                      : done
                        ? "bg-accent-dim text-accent"
                        : "bg-elevated text-subtle"
                  }`}
                >
                  {done ? <Check className="size-3" /> : <span>{s.n}</span>}
                  <span className="hidden sm:inline">{s.label}</span>
                </button>
              </div>
            );
          })}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <label className="label-caps" htmlFor="ws-name">
                  Name
                </label>
                <input
                  id="ws-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={`defaults to “${folderName(folder)}”`}
                  className="mt-1 w-full rounded-md border border-border bg-elevated px-3 py-2.5 font-mono text-sm text-fg placeholder:text-subtle focus:border-accent focus:outline-none"
                />
              </div>
              <div>
                <label className="label-caps" htmlFor="ws-folder">
                  Working folder
                </label>
                <div className="mt-1 flex gap-2">
                  <input
                    id="ws-folder"
                    value={folder}
                    onChange={(e) => setFolder(e.target.value)}
                    className="min-w-0 flex-1 rounded-md border border-border bg-elevated px-3 py-2.5 font-mono text-sm text-fg focus:border-accent focus:outline-none"
                  />
                  <button
                    type="button"
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-border bg-elevated px-3 py-2 text-xs font-medium text-muted hover:text-fg"
                    title="Native folder picker in real app"
                  >
                    <FolderOpen className="size-3.5" />
                    Browse
                  </button>
                </div>
              </div>
              <div>
                <div className="label-caps mb-2">Recent</div>
                <div className="flex flex-wrap gap-1.5">
                  {RECENT_FOLDERS.map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setFolder(p)}
                      className={`rounded-full border px-2.5 py-1 font-mono text-[11px] ${
                        folder === p
                          ? "border-accent bg-accent-dim text-accent"
                          : "border-border text-muted hover:text-fg"
                      }`}
                    >
                      {folderName(p)}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-5">
              <div>
                <div className="label-caps mb-2">Pane count</div>
                <div className="flex flex-wrap gap-1.5">
                  {COUNT_PRESETS.map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setCount(n)}
                      className={`min-w-[2.5rem] rounded-md border px-2 py-1.5 font-mono text-sm ${
                        count === n
                          ? "border-accent bg-accent-dim text-accent"
                          : "border-border text-muted"
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
              <div
                className="grid gap-1 rounded-lg border border-border bg-elevated p-2"
                style={{
                  gridTemplateColumns: `repeat(${dims.cols}, minmax(0, 1fr))`,
                }}
              >
                {slots.map((s, i) => (
                  <div
                    key={s.id}
                    className="flex aspect-[4/3] flex-col justify-between rounded-md border border-border bg-surface p-2"
                  >
                    <Grid3X3 className="size-3 text-subtle" />
                    <span className="font-mono text-[10px] text-muted">
                      {s.harness}/{s.role}
                    </span>
                  </div>
                ))}
              </div>
              <div>
                <div className="label-caps mb-2 flex items-center gap-1">
                  <Sparkles className="size-3" /> Recipes
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {RECIPES.map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => applyRecipe(r)}
                      className={`rounded-md border p-3 text-left ${
                        recipeId === r.id
                          ? "border-accent bg-accent-dim/40"
                          : "border-border bg-elevated hover:border-accent/40"
                      }`}
                    >
                      <div className="font-mono text-xs font-semibold text-fg">{r.title}</div>
                      <p className="mt-0.5 text-[11px] text-muted">{r.summary}</p>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="grid gap-4 sm:grid-cols-[1fr_1.1fr]">
              <div>
                <div className="label-caps mb-2">Slots</div>
                <ul className="space-y-1">
                  {slots.map((s, i) => (
                    <li key={s.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedSlot(i)}
                        className={`flex w-full items-center gap-2 rounded-md border px-2 py-2 text-left font-mono text-[11px] ${
                          selectedSlot === i
                            ? "border-accent bg-accent-dim/40 text-fg"
                            : "border-border text-muted"
                        }`}
                      >
                        <Terminal className="size-3.5 shrink-0" />
                        <span className="truncate">
                          {i + 1}. {s.harness} · {s.role}
                        </span>
                        {slots.length > 1 && (
                          <button
                            type="button"
                            className="ml-auto text-subtle hover:text-danger"
                            onClick={(e) => {
                              e.stopPropagation();
                              removeSlot(i);
                            }}
                          >
                            <Trash2 className="size-3" />
                          </button>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  onClick={() => setCount(slots.length + 1)}
                  className="mt-2 inline-flex items-center gap-1 font-mono text-[11px] text-accent"
                >
                  <Plus className="size-3" /> Add agent
                </button>
              </div>
              {active && (
                <div className="rounded-md border border-border bg-elevated p-3">
                  <div className="label-caps mb-2">Inspector · slot {selectedSlot + 1}</div>
                  <div className="label-caps mb-1">Harness</div>
                  <div className="mb-3 flex flex-wrap gap-1">
                    {HARNESSES.map((h) => (
                      <button
                        key={h}
                        type="button"
                        onClick={() =>
                          updateSlot(selectedSlot, { harness: h, ...defaultSlotMcp(h) })
                        }
                        className={`rounded-sm border px-2 py-0.5 font-mono text-[10px] ${
                          active.harness === h
                            ? "border-accent bg-accent-dim text-accent"
                            : "border-border text-muted"
                        }`}
                      >
                        {h}
                      </button>
                    ))}
                  </div>
                  <div className="label-caps mb-1">Role</div>
                  <div className="flex flex-wrap gap-1">
                    {ROLES.map((r) => (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => updateSlot(selectedSlot, { role: r.id })}
                        className={`rounded-sm border px-2 py-0.5 font-mono text-[10px] ${
                          active.role === r.id
                            ? "border-accent bg-accent-dim text-accent"
                            : "border-border text-muted"
                        }`}
                        title={r.hint}
                      >
                        {r.label}
                      </button>
                    ))}
                  </div>
                  <label className="mt-3 block">
                    <span className="label-caps">First prompt (optional)</span>
                    <textarea
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                      rows={3}
                      className="mt-1 w-full rounded-md border border-border bg-surface px-2 py-1.5 font-mono text-[11px] text-fg focus:border-accent focus:outline-none"
                      placeholder="Shared kickoff for new panes…"
                    />
                  </label>
                </div>
              )}
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2 rounded-md border border-accent/30 bg-accent-dim/20 px-3 py-2">
                <Cable className="size-4 text-accent" />
                <div className="min-w-0 flex-1 font-mono text-[11px] text-muted">
                  From <span className="text-accent">MCP Control Center</span> · override per
                  slot below
                </div>
              </div>

              <div>
                <div className="label-caps mb-1.5">Apply preset to all slots</div>
                <div className="flex flex-wrap gap-1.5">
                  {mcpCfg.presets.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setGlobalMcpPreset(p.id)}
                      className={`rounded-sm border px-2 py-1 font-mono text-[10px] ${
                        globalMcpPreset === p.id
                          ? "border-accent bg-accent-dim text-accent"
                          : "border-border text-muted"
                      }`}
                    >
                      {p.name}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={applyGlobalPresetToAll}
                    className="rounded-sm border border-accent/40 px-2 py-1 font-mono text-[10px] text-accent"
                  >
                    Apply to all
                  </button>
                </div>
              </div>

              <ul className="space-y-2">
                {slots.map((s, i) => {
                  const snap = snapshotMcpForHarness(mcpCfg, s.harness, {
                    mode: s.mcpMode,
                    presetId: s.mcpPresetId,
                  });
                  const live = resolveBindingServersForHarnessName(mcpCfg, s.harness);
                  return (
                    <li
                      key={s.id}
                      className="rounded-md border border-border bg-elevated p-3"
                    >
                      <div className="flex flex-wrap items-center gap-2 font-mono text-[11px]">
                        <span className="font-semibold text-fg">
                          {i + 1}. {s.harness}
                        </span>
                        <span className="text-subtle">{s.role}</span>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {(["inherit", "preset"] as BindMode[]).map((m) => (
                          <button
                            key={m}
                            type="button"
                            onClick={() => updateSlot(i, { mcpMode: m })}
                            className={`rounded-sm border px-1.5 py-0.5 font-mono text-[9px] ${
                              s.mcpMode === m
                                ? "border-accent text-accent"
                                : "border-border text-muted"
                            }`}
                          >
                            {m}
                          </button>
                        ))}
                        {s.mcpMode === "preset" &&
                          mcpCfg.presets.map((p) => (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() =>
                                updateSlot(i, { mcpMode: "preset", mcpPresetId: p.id })
                              }
                              className={`rounded-sm border px-1.5 py-0.5 font-mono text-[9px] ${
                                s.mcpPresetId === p.id
                                  ? "border-accent/50 bg-accent-dim text-accent"
                                  : "border-border text-subtle"
                              }`}
                            >
                              {p.name}
                            </button>
                          ))}
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1">
                        <span className="label-caps w-full">Will receive</span>
                        {snap.mcpServerIds.length === 0 ? (
                          <span className="font-mono text-[10px] text-subtle">no MCP</span>
                        ) : (
                          snap.mcpServerIds.map((id) => {
                            const srv = mcpCfg.servers.find((x) => x.id === id);
                            return (
                              <span
                                key={id}
                                className="rounded-sm border border-border bg-surface px-1.5 py-0.5 font-mono text-[10px] text-muted"
                              >
                                {srv?.name ?? id}
                              </span>
                            );
                          })
                        )}
                      </div>
                      {snap.mcpToolNames.length > 0 && (
                        <p className="mt-1 font-mono text-[9px] text-subtle">
                          tools: {snap.mcpToolNames.slice(0, 8).join(", ")}
                          {snap.mcpToolNames.length > 8 ? "…" : ""}
                        </p>
                      )}
                      {live.length !== snap.mcpServerIds.length && (
                        <p className="mt-1 font-mono text-[9px] text-need">
                          Override differs from harness default binding
                        </p>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-border px-5 py-3">
          <button
            type="button"
            onClick={() => (step === 1 ? onClose() : setStep((s) => (s - 1) as 1 | 2 | 3 | 4))}
            className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-1.5 font-mono text-xs text-muted hover:text-fg"
          >
            <ChevronLeft className="size-3.5" />
            {step === 1 ? "Cancel" : "Back"}
          </button>
          {step < 4 ? (
            <button
              type="button"
              disabled={!canNext}
              onClick={() => setStep((s) => (s + 1) as 1 | 2 | 3 | 4)}
              className="rounded-md bg-accent px-4 py-1.5 font-mono text-xs font-semibold text-accent-fg disabled:opacity-40"
            >
              Continue
            </button>
          ) : (
            <button
              type="button"
              onClick={create}
              className="rounded-md bg-accent px-4 py-1.5 font-mono text-xs font-semibold text-accent-fg"
            >
              Create workspace
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
