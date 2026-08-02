export type PaneStatus =
  | "working"
  | "needs_input"
  | "blocked"
  | "error"
  | "idle"
  | "starting";

export type TelemetryState = "live" | "stale" | "state_blind" | "placeholder" | "no_data";

export type TabId = "command" | "monitoring" | "context" | "admin";

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
  pinned?: boolean;
  mcpServerIds?: string[];
  mcpPresetId?: string;
  mcpMode?: "inherit" | "preset" | "custom";
  mcpToolNames?: string[];
}

export interface Workspace {
  id: string;
  name: string;
  path: string;
  harnesses: string[];
  parentId?: string;
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
