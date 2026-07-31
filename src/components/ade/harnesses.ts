/**
 * Canonical harness registry — mirrors harness-ready `ui/src/lib/agentTypes.js`
 * plus capability notes from HANDOFF / P0-ALIGNMENT (state_blind, etc.).
 */
export type HarnessId =
  | "claude-code"
  | "cursor"
  | "opencode"
  | "codex"
  | "commandcode"
  | "pi"
  | "grok"
  | "bash";

export type TelemetryCapability = "full" | "limited" | "none";

export interface HarnessDescriptor {
  id: HarnessId;
  /** Short UI label */
  label: string;
  /** CLI spawned inside the PTY */
  cmd: string;
  /** Alias keys accepted in templates / recipes */
  aliases: string[];
  /** Process metrics / hook telemetry */
  telemetry: TelemetryCapability;
  /** Typical use in recipes */
  strengths: string;
  /** Notes for operators */
  notes?: string;
}

export const HARNESS_REGISTRY: HarnessDescriptor[] = [
  {
    id: "claude-code",
    label: "Claude Code",
    cmd: "claude",
    aliases: ["claude", "claude-code"],
    telemetry: "full",
    strengths: "General coding, coordination, strong tool use",
  },
  {
    id: "cursor",
    label: "Cursor",
    cmd: "cursor-agent",
    aliases: ["cursor"],
    telemetry: "full",
    strengths: "IDE-integrated agent loops, UI-heavy work",
  },
  {
    id: "opencode",
    label: "OpenCode",
    cmd: "opencode",
    aliases: ["opencode"],
    telemetry: "full",
    strengths: "Open OSS coding agent; good scout/builder",
  },
  {
    id: "codex",
    label: "Codex",
    cmd: "codex",
    aliases: ["codex"],
    telemetry: "full",
    strengths: "Review / implementation alternate model path",
  },
  {
    id: "commandcode",
    label: "CommandCode",
    cmd: "commandcode",
    aliases: ["commandcode", "command-code"],
    telemetry: "limited",
    strengths: "Terminal-native harness",
    notes: "Often state_blind — show “telemetry limited”, never zeros",
  },
  {
    id: "pi",
    label: "Pi",
    cmd: "pi",
    aliases: ["pi"],
    telemetry: "limited",
    strengths: "Lightweight terminal agent",
    notes: "Often state_blind",
  },
  {
    id: "grok",
    label: "Grok",
    cmd: "grok",
    aliases: ["grok"],
    telemetry: "limited",
    strengths: "xAI CLI agent",
    notes: "Often state_blind",
  },
  {
    id: "bash",
    label: "Bash",
    cmd: "bash",
    aliases: ["bash", "shell"],
    telemetry: "full",
    strengths: "Raw shell / careful operator work, max gates",
  },
];

export function resolveHarness(input: string): HarnessDescriptor | undefined {
  const key = input.trim().toLowerCase();
  return HARNESS_REGISTRY.find(
    (h) => h.id === key || h.aliases.includes(key) || h.cmd === key,
  );
}

/** Recipe schema (R-ONBOARD) — versionable local playbook, not a video course. */
export type RecipeRole =
  | "none"
  | "coordinator"
  | "builder"
  | "scout"
  | "reviewer";

export interface RecipeAgent {
  harness: string;
  role: RecipeRole;
  /** Advisory owned-path globs (channel B only) */
  ownedPaths?: string[];
  model?: string;
}

export interface Recipe {
  id: string;
  title: string;
  summary: string;
  version: number;
  /** Recommended operator notes — documentation until gate mutation EXISTS */
  recommendedGates?: string[];
  agents: RecipeAgent[];
  firstRunSteps?: string[];
}

/**
 * Product-aligned recipes (R-ONBOARD / F-ONB).
 * Prefill only EXISTS spawn fields: harness, role, repo — not autonomy/priority knobs.
 */
export const PRODUCT_RECIPES: Recipe[] = [
  {
    id: "solo-claude",
    title: "Solo Claude",
    summary: "One builder pane — simplest activation",
    version: 1,
    recommendedGates: ["start with send_input_enabled", "keep mutations gated until trust"],
    agents: [{ harness: "claude", role: "builder" }],
    firstRunSteps: [
      "Open workspace folder",
      "Spawn Claude as builder",
      "Send a scoped first task",
    ],
  },
  {
    id: "review-pair",
    title: "Build + review pair",
    summary: "Claude implements; Codex reviews",
    version: 1,
    recommendedGates: ["reviewer read-heavy", "builder owns ui/src"],
    agents: [
      { harness: "claude", role: "builder", ownedPaths: ["ui/src/**"] },
      { harness: "codex", role: "reviewer", ownedPaths: ["ui/src/**"] },
    ],
    firstRunSteps: [
      "Spawn pair from recipe",
      "Assign PR/diff to reviewer",
      "Builder only merges after review attention clears",
    ],
  },
  {
    id: "review-trio",
    title: "Review trio",
    summary: "Coord · builder · reviewer on separate worktrees",
    version: 1,
    recommendedGates: ["coord cannot own builder paths", "check path collision amber"],
    agents: [
      { harness: "claude", role: "coordinator", ownedPaths: ["docs/**"] },
      { harness: "cursor", role: "builder", ownedPaths: ["ui/src/**"] },
      { harness: "codex", role: "reviewer" },
    ],
    firstRunSteps: [
      "Confirm no path collision warning",
      "Coord writes task list",
      "Builder implements; reviewer on attention queue",
    ],
  },
  {
    id: "scout-first",
    title: "Scout first",
    summary: "Read-only scout maps repo, then builder",
    version: 1,
    recommendedGates: ["scout: mutations off", "builder: after scout returns"],
    agents: [
      { harness: "opencode", role: "scout" },
      { harness: "claude", role: "builder" },
    ],
  },
  {
    id: "solo-bash",
    title: "Solo bash",
    summary: "Single shell pane, max caution",
    version: 1,
    recommendedGates: ["max gates", "no auto-mutations"],
    agents: [{ harness: "bash", role: "none" }],
  },
  {
    id: "state-blind-probe",
    title: "Limited-telemetry probe",
    summary: "Pi / CommandCode / Grok — expect state_blind chips",
    version: 1,
    recommendedGates: ["do not trust zero metrics"],
    agents: [
      { harness: "pi", role: "none" },
      { harness: "commandcode", role: "builder" },
      { harness: "grok", role: "reviewer" },
    ],
    firstRunSteps: [
      "Confirm Monitoring shows telemetry limited, not 0%",
      "Prefer log/attention over CPU charts for these harnesses",
    ],
  },
];

/** Keyboard map: EXISTS today in real app vs proposed (docs/P0-ALIGNMENT §3, V-S9). */
export type KeyHintStatus = "exists" | "proposed" | "mock";

export interface KeyHint {
  keys: string;
  action: string;
  status: KeyHintStatus;
  /** True only if handler is real (no palette-only shortcut) */
  honest: boolean;
  note?: string;
}

export const KEYBOARD_MAP: KeyHint[] = [
  {
    keys: "⌘⇧I",
    action: "Toggle broadcast mode (fan keystrokes to all panes)",
    status: "exists",
    honest: true,
    note: "Not the one-shot BROADCAST button — tooltip bug in TopBar today",
  },
  {
    keys: "⌘G",
    action: "Zoom / maximize selected pane",
    status: "exists",
    honest: true,
    note: "Not “single layout mode” — LayoutToolbar tooltip is wrong today",
  },
  {
    keys: "⌘K / Ctrl+K",
    action: "Command palette over EXISTING handlers",
    status: "proposed",
    honest: true,
    note: "R-PALETTE — each row must show its keybinding; no palette-only actions",
  },
  {
    keys: "Alt+↑ / Alt+↓",
    action: "Cycle workspaces",
    status: "proposed",
    honest: true,
    note: "Claimed in Design Brief; V-S9 says NOT implemented yet",
  },
  {
    keys: "⌘1 / ⌘2 / ⌘3",
    action: "Command · Monitoring · Context tabs",
    status: "proposed",
    honest: true,
  },
  {
    keys: "⌘N",
    action: "New workspace / spawn wizard",
    status: "proposed",
    honest: true,
  },
  {
    keys: "⌘Enter",
    action: "Send reply when needs_input focused",
    status: "proposed",
    honest: true,
  },
  {
    keys: "?",
    action: "Show keyboard hints",
    status: "mock",
    honest: true,
  },
  {
    keys: "Esc",
    action: "Close palette / wizard / hints",
    status: "mock",
    honest: true,
  },
];
