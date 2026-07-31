export type PaneStatus =
  | "working"
  | "needs_input"
  | "blocked"
  | "error"
  | "idle"
  | "starting";

export type TelemetryState = "live" | "stale" | "state_blind" | "placeholder" | "no_data";

export type TabId = "command" | "monitoring" | "context";

export type Role = "coordinator" | "builder" | "scout" | "reviewer" | "none";

export interface Pane {
  id: string;
  workspaceId: string;
  name: string;
  harness: string;
  role: Role;
  status: PaneStatus;
  branch: string;
  worktree: string;
  attention?: string;
  ownedPaths?: string[];
  cpu?: number | null;
  memMb?: number | null;
  lastToolFailure?: string | null;
  queueDepth?: number;
  telemetry: TelemetryState;
  gitClean?: boolean;
  /** User pin — stays in left pin column under sub-linear pack */
  pinned?: boolean;
  /** MCP snapshot at spawn — from Control Center bindings */
  mcpServerIds?: string[];
  mcpPresetId?: string;
  mcpMode?: "inherit" | "preset" | "custom";
  mcpToolNames?: string[];
}

export interface Workspace {
  id: string;
  name: string;
  path: string;
  /** Harness kinds available / configured for this workspace */
  harnesses: string[];
  /** Optional parent for workspace tree (sub-linear workspace hierarchy) */
  parentId?: string;
  /** Short lane/label for sub-workspaces */
  lane?: string;
}

export interface Recipe {
  id: string;
  title: string;
  summary: string;
  harnesses: string[];
  agents: number;
  workspaceHint?: string;
}
