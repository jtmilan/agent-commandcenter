/**
 * MCP Control Center — single configuration location for all harnesses.
 * Local-first: browser localStorage in this mock; Tauri would map to
 * project `.mcp.json` / ADE spawn inject.
 */

import type { HarnessId } from "./harnesses";
import { HARNESS_REGISTRY, resolveHarness } from "./harnesses";
import type { Pane, Role } from "./types";

export type McpTransport = "stdio" | "sse" | "http";
export type McpServerStatus = "connected" | "degraded" | "missing" | "disabled" | "unknown";

export interface McpServer {
  id: string;
  name: string;
  summary: string;
  transport: McpTransport;
  endpoint: string;
  args?: string[];
  envKeys?: string[];
  tools: string[];
  status: McpServerStatus;
  scope: "global" | "project";
  enabled: boolean;
}

export interface McpPreset {
  id: string;
  name: string;
  summary: string;
  serverIds: string[];
}

export type BindMode = "inherit" | "preset" | "custom";

export interface HarnessMcpBinding {
  harnessId: HarnessId;
  mode: BindMode;
  presetId?: string;
  serverIds: string[];
}

export interface McpConfigState {
  version: 1;
  servers: McpServer[];
  presets: McpPreset[];
  bindings: HarnessMcpBinding[];
  defaultPresetId: string;
}

/** Role-based MCP policy (product safety) */
export interface McpRolePolicy {
  role: Role;
  /** Tool name substrings that must be present on effective servers */
  requireTools: string[];
  /** Tool name substrings forbidden for this role */
  forbidTools: string[];
  /** Server ids that must not be bound */
  forbidServerIds: string[];
}

export const ROLE_MCP_POLICIES: McpRolePolicy[] = [
  {
    role: "coordinator",
    requireTools: ["git_status", "read_file"],
    forbidTools: [],
    forbidServerIds: [],
  },
  {
    role: "builder",
    requireTools: ["read_file", "write_file"],
    forbidTools: [],
    forbidServerIds: [],
  },
  {
    role: "scout",
    requireTools: ["read_file", "list_dir"],
    forbidTools: ["write_file", "create_pr"],
    forbidServerIds: ["mcp-browser"],
  },
  {
    role: "reviewer",
    requireTools: ["read_file", "git_diff"],
    forbidTools: ["write_file"],
    forbidServerIds: ["mcp-browser"],
  },
  {
    role: "none",
    requireTools: [],
    forbidTools: [],
    forbidServerIds: [],
  },
];

export type McpPolicyIssueSeverity = "block" | "warn" | "info";

export interface McpPolicyIssue {
  severity: McpPolicyIssueSeverity;
  code:
    | "missing_required_tool"
    | "forbidden_tool"
    | "forbidden_server"
    | "server_unhealthy"
    | "drift"
    | "empty_binding";
  paneId?: string;
  paneName?: string;
  detail: string;
  remediation: string;
}

const STORAGE_KEY = "hr-ade-mcp-config-v1";

export const DEFAULT_SERVERS: McpServer[] = [
  {
    id: "mcp-fs",
    name: "filesystem",
    summary: "Workspace file read/write within worktree roots",
    transport: "stdio",
    endpoint: "npx",
    args: ["-y", "@modelcontextprotocol/server-filesystem"],
    envKeys: ["MCP_FS_ROOT"],
    tools: ["read_file", "write_file", "list_dir", "search"],
    status: "connected",
    scope: "global",
    enabled: true,
  },
  {
    id: "mcp-git",
    name: "git",
    summary: "Status, diff, log — no force-push by default",
    transport: "stdio",
    endpoint: "uvx",
    args: ["mcp-server-git"],
    tools: ["git_status", "git_diff", "git_log", "git_show"],
    status: "connected",
    scope: "global",
    enabled: true,
  },
  {
    id: "mcp-github",
    name: "github",
    summary: "Issues / PRs via token (env only)",
    transport: "stdio",
    endpoint: "npx",
    args: ["-y", "@modelcontextprotocol/server-github"],
    envKeys: ["GITHUB_TOKEN"],
    tools: ["list_issues", "create_pr", "get_pr"],
    status: "degraded",
    scope: "project",
    enabled: true,
  },
  {
    id: "mcp-browser",
    name: "browser",
    summary: "Optional headless browse — high trust",
    transport: "stdio",
    endpoint: "npx",
    args: ["-y", "@modelcontextprotocol/server-puppeteer"],
    tools: ["navigate", "screenshot", "click"],
    status: "disabled",
    scope: "global",
    enabled: false,
  },
  {
    id: "mcp-memory",
    name: "memory",
    summary: "Local knowledge graph for ADE context tab",
    transport: "stdio",
    endpoint: "npx",
    args: ["-y", "@modelcontextprotocol/server-memory"],
    tools: ["create_entities", "search_nodes"],
    status: "connected",
    scope: "project",
    enabled: true,
  },
  {
    id: "mcp-sqlite",
    name: "sqlite",
    summary: "Read project analytics DB",
    transport: "stdio",
    endpoint: "uvx",
    args: ["mcp-server-sqlite", "--db", "./data/app.db"],
    tools: ["query", "list_tables"],
    status: "missing",
    scope: "project",
    enabled: true,
  },
];

export const DEFAULT_PRESETS: McpPreset[] = [
  {
    id: "preset-coding",
    name: "coding",
    summary: "filesystem + git + memory — default builders",
    serverIds: ["mcp-fs", "mcp-git", "mcp-memory"],
  },
  {
    id: "preset-docs",
    name: "docs-only",
    summary: "filesystem + memory — scouts / reviewers",
    serverIds: ["mcp-fs", "mcp-memory"],
  },
  {
    id: "preset-full",
    name: "full-stack",
    summary: "coding + github (+ browser if enabled)",
    serverIds: ["mcp-fs", "mcp-git", "mcp-github", "mcp-memory", "mcp-browser"],
  },
  {
    id: "preset-none",
    name: "no-network",
    summary: "filesystem only — max caution / bash",
    serverIds: ["mcp-fs"],
  },
];

function defaultBindings(): HarnessMcpBinding[] {
  return HARNESS_REGISTRY.map((h) => {
    let presetId = "preset-coding";
    if (h.id === "bash") presetId = "preset-none";
    if (h.id === "codex") presetId = "preset-docs";
    return {
      harnessId: h.id,
      mode: "preset" as const,
      presetId,
      serverIds: [],
    };
  });
}

export function createDefaultMcpConfig(): McpConfigState {
  return {
    version: 1,
    servers: DEFAULT_SERVERS.map((s) => ({
      ...s,
      tools: [...s.tools],
      args: s.args ? [...s.args] : undefined,
    })),
    presets: DEFAULT_PRESETS.map((p) => ({ ...p, serverIds: [...p.serverIds] })),
    bindings: defaultBindings(),
    defaultPresetId: "preset-coding",
  };
}

export function loadMcpConfig(): McpConfigState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as McpConfigState;
      if (parsed?.version === 1 && Array.isArray(parsed.servers)) {
        const have = new Set(parsed.bindings.map((b) => b.harnessId));
        for (const h of HARNESS_REGISTRY) {
          if (!have.has(h.id)) {
            parsed.bindings.push({
              harnessId: h.id,
              mode: "preset",
              presetId: parsed.defaultPresetId,
              serverIds: [],
            });
          }
        }
        return parsed;
      }
    }
  } catch {
    /* ignore */
  }
  return createDefaultMcpConfig();
}

export function saveMcpConfig(state: McpConfigState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
}

export function exportMcpPack(state: McpConfigState): string {
  return JSON.stringify(
    {
      format: "ade-mcp-pack/v1",
      exportedAt: new Date().toISOString(),
      defaultPresetId: state.defaultPresetId,
      servers: state.servers.map((s) => ({
        id: s.id,
        name: s.name,
        transport: s.transport,
        endpoint: s.endpoint,
        args: s.args,
        envKeys: s.envKeys,
        tools: s.tools,
        scope: s.scope,
        enabled: s.enabled,
        summary: s.summary,
        status: s.status,
      })),
      presets: state.presets,
      bindings: state.bindings,
    },
    null,
    2,
  );
}

/** Map pane harness string → registry id */
export function harnessStringToId(input: string): HarnessId {
  const h = resolveHarness(input);
  return h?.id ?? "claude-code";
}

export function resolveBindingServers(
  state: McpConfigState,
  harnessId: HarnessId,
): McpServer[] {
  const binding =
    state.bindings.find((b) => b.harnessId === harnessId) ??
    ({
      harnessId,
      mode: "preset" as const,
      presetId: state.defaultPresetId,
      serverIds: [] as string[],
    } satisfies HarnessMcpBinding);

  let ids: string[] = [];
  if (binding.mode === "custom") {
    ids = binding.serverIds;
  } else if (binding.mode === "inherit") {
    const preset = state.presets.find((p) => p.id === state.defaultPresetId);
    ids = preset?.serverIds ?? [];
  } else {
    const preset = state.presets.find(
      (p) => p.id === (binding.presetId ?? state.defaultPresetId),
    );
    ids = preset?.serverIds ?? [];
  }

  return state.servers.filter((s) => ids.includes(s.id) && s.enabled);
}

export function resolveBindingServersForHarnessName(
  state: McpConfigState,
  harnessName: string,
): McpServer[] {
  return resolveBindingServers(state, harnessStringToId(harnessName));
}

/** Snapshot stored on pane at spawn time */
export interface PaneMcpSnapshot {
  mcpServerIds: string[];
  mcpPresetId?: string;
  mcpMode: BindMode;
  mcpToolNames: string[];
}

export function snapshotMcpForHarness(
  state: McpConfigState,
  harnessName: string,
  override?: { mode?: BindMode; presetId?: string; serverIds?: string[] },
): PaneMcpSnapshot {
  const harnessId = harnessStringToId(harnessName);
  const binding = state.bindings.find((b) => b.harnessId === harnessId);
  const mode = override?.mode ?? binding?.mode ?? "preset";
  const presetId =
    override?.presetId ?? binding?.presetId ?? state.defaultPresetId;

  let servers: McpServer[];
  if (override?.serverIds) {
    servers = state.servers.filter((s) => override.serverIds!.includes(s.id) && s.enabled);
  } else if (mode === "custom" && override?.serverIds == null && binding?.mode === "custom") {
    servers = state.servers.filter((s) => binding.serverIds.includes(s.id) && s.enabled);
  } else {
    // temporary resolve via synthetic state if override preset
    if (override?.presetId || mode === "preset") {
      const synthetic: McpConfigState = {
        ...state,
        bindings: state.bindings.map((b) =>
          b.harnessId === harnessId
            ? { ...b, mode: "preset", presetId: presetId }
            : b,
        ),
      };
      servers = resolveBindingServers(synthetic, harnessId);
    } else {
      servers = resolveBindingServers(state, harnessId);
    }
  }

  const tools = Array.from(new Set(servers.flatMap((s) => s.tools)));
  return {
    mcpServerIds: servers.map((s) => s.id),
    mcpPresetId: mode === "preset" || mode === "inherit" ? presetId : undefined,
    mcpMode: mode,
    mcpToolNames: tools,
  };
}

export function applyMcpSnapshotToPane(pane: Pane, snap: PaneMcpSnapshot): Pane {
  return {
    ...pane,
    mcpServerIds: snap.mcpServerIds,
    mcpPresetId: snap.mcpPresetId,
    mcpMode: snap.mcpMode,
    mcpToolNames: snap.mcpToolNames,
  };
}

/** Effective tools for a pane (snapshot or live config) */
export function paneEffectiveServers(pane: Pane, state?: McpConfigState): McpServer[] {
  const cfg = state ?? loadMcpConfig();
  if (pane.mcpServerIds?.length) {
    return cfg.servers.filter((s) => pane.mcpServerIds!.includes(s.id));
  }
  return resolveBindingServersForHarnessName(cfg, pane.harness);
}

export function paneEffectiveTools(pane: Pane, state?: McpConfigState): string[] {
  if (pane.mcpToolNames?.length) return pane.mcpToolNames;
  return Array.from(new Set(paneEffectiveServers(pane, state).flatMap((s) => s.tools)));
}

/**
 * Evaluate MCP policy for fleet / merge gate.
 * Drift = pane snapshot differs from current harness binding.
 */
export function evaluateMcpPolicies(
  panes: Pane[],
  state?: McpConfigState,
): McpPolicyIssue[] {
  const cfg = state ?? loadMcpConfig();
  const issues: McpPolicyIssue[] = [];

  for (const pane of panes) {
    const servers = paneEffectiveServers(pane, cfg);
    const tools = Array.from(new Set(servers.flatMap((s) => s.tools)));
    const policy =
      ROLE_MCP_POLICIES.find((p) => p.role === pane.role) ??
      ROLE_MCP_POLICIES.find((p) => p.role === "none")!;

    if (servers.length === 0 && pane.role !== "none") {
      issues.push({
        severity: "warn",
        code: "empty_binding",
        paneId: pane.id,
        paneName: pane.name,
        detail: `${pane.name} has zero MCP servers`,
        remediation: "Bind a preset in MCP Control Center or wizard MCP step.",
      });
    }

    for (const req of policy.requireTools) {
      if (!tools.some((t) => t.includes(req) || req.includes(t))) {
        issues.push({
          severity: pane.role === "coordinator" || pane.role === "builder" ? "block" : "warn",
          code: "missing_required_tool",
          paneId: pane.id,
          paneName: pane.name,
          detail: `${pane.name} (${pane.role}) missing required tool ~${req}`,
          remediation: `Add MCP server providing “${req}” for ${pane.role}.`,
        });
      }
    }

    for (const forbid of policy.forbidTools) {
      if (tools.some((t) => t.includes(forbid) || forbid.includes(t))) {
        issues.push({
          severity: "block",
          code: "forbidden_tool",
          paneId: pane.id,
          paneName: pane.name,
          detail: `${pane.name} (${pane.role}) has forbidden tool ~${forbid}`,
          remediation: `Remove write/network MCP from ${pane.role} or change role.`,
        });
      }
    }

    for (const sid of policy.forbidServerIds) {
      if (servers.some((s) => s.id === sid)) {
        issues.push({
          severity: "block",
          code: "forbidden_server",
          paneId: pane.id,
          paneName: pane.name,
          detail: `${pane.name} bound to forbidden server ${sid}`,
          remediation: "Unbind server for this role (scout/reviewer).",
        });
      }
    }

    for (const s of servers) {
      if (s.status === "missing") {
        issues.push({
          severity: "warn",
          code: "server_unhealthy",
          paneId: pane.id,
          paneName: pane.name,
          detail: `${pane.name}: MCP “${s.name}” binary missing`,
          remediation: "Install binary or disable server in Control Center.",
        });
      } else if (s.status === "degraded") {
        issues.push({
          severity: "info",
          code: "server_unhealthy",
          paneId: pane.id,
          paneName: pane.name,
          detail: `${pane.name}: MCP “${s.name}” degraded`,
          remediation: "Check env keys / auth; do not treat as fully live.",
        });
      }
    }

    // Drift: snapshot vs live binding
    if (pane.mcpServerIds?.length) {
      const live = resolveBindingServersForHarnessName(cfg, pane.harness).map((s) => s.id).sort();
      const snap = [...pane.mcpServerIds].sort();
      if (live.join() !== snap.join()) {
        issues.push({
          severity: "warn",
          code: "drift",
          paneId: pane.id,
          paneName: pane.name,
          detail: `${pane.name} MCP snapshot ≠ current harness binding`,
          remediation: "Re-spawn pane or accept drift until next session.",
        });
      }
    }
  }

  return issues;
}

export function statusLabel(s: McpServerStatus): string {
  switch (s) {
    case "connected":
      return "connected";
    case "degraded":
      return "degraded";
    case "missing":
      return "binary missing";
    case "disabled":
      return "disabled";
    default:
      return "unknown";
  }
}

/** Markdown snippet for handoff */
export function buildMcpHandoffSection(panes: Pane[], state?: McpConfigState): string {
  const cfg = state ?? loadMcpConfig();
  const lines: string[] = [
    `## MCP pack summary`,
    ``,
    `| Harness default | Mode | Preset |`,
    `|-----------------|------|--------|`,
  ];
  for (const b of cfg.bindings) {
    const h = HARNESS_REGISTRY.find((x) => x.id === b.harnessId);
    lines.push(
      `| ${h?.label ?? b.harnessId} | ${b.mode} | ${b.presetId ?? "—"} |`,
    );
  }
  lines.push(``);
  lines.push(`### Per-pane MCP`);
  lines.push(``);
  for (const p of panes) {
    const servers = paneEffectiveServers(p, cfg);
    lines.push(
      `- **${p.name}** (${p.harness}): ${servers.map((s) => s.name).join(", ") || "_none_"}`,
    );
  }
  lines.push(``);
  const issues = evaluateMcpPolicies(panes, cfg).filter((i) => i.severity !== "info");
  if (issues.length) {
    lines.push(`### MCP policy issues`);
    lines.push(``);
    for (const i of issues.slice(0, 12)) {
      lines.push(`- [${i.severity}] ${i.detail}`);
    }
    lines.push(``);
  }
  return lines.join("\n");
}
