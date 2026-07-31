/**
 * Session handoff pack — refined markdown format (v2)
 */

import { evaluateMergeGate, collectConflicts } from "./mergeGate";
import { buildMcpHandoffSection } from "./mcpConfig";
import type { Pane, Workspace } from "./types";

export interface HandoffOptions {
  note?: string;
  focusWorkspaceId?: string;
  includeMergePlan?: boolean;
  includeConflicts?: boolean;
  includeMcp?: boolean;
  sessionId?: string;
}

function wsName(workspaces: Workspace[], id: string) {
  return workspaces.find((w) => w.id === id)?.name ?? id;
}

function statusEmoji(status: Pane["status"]): string {
  switch (status) {
    case "needs_input":
      return "🟡";
    case "blocked":
    case "error":
      return "🔴";
    case "working":
      return "🟢";
    case "idle":
      return "⚪";
    case "starting":
      return "🔵";
    default:
      return "·";
  }
}

export function buildHandoffMarkdown(
  workspaces: Workspace[],
  panes: Pane[],
  opts: HandoffOptions | string = {},
): string {
  const options: HandoffOptions = typeof opts === "string" ? { note: opts } : opts ?? {};

  const {
    note,
    focusWorkspaceId,
    includeMergePlan = true,
    includeConflicts = true,
    includeMcp = true,
    sessionId = `handoff-${Date.now().toString(36)}`,
  } = options;

  const now = new Date();
  const iso = now.toISOString();
  const local = now.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });

  const scope = focusWorkspaceId
    ? panes.filter((p) => p.workspaceId === focusWorkspaceId)
    : panes;

  const focusWs = focusWorkspaceId
    ? workspaces.find((w) => w.id === focusWorkspaceId)
    : undefined;

  const gate = evaluateMergeGate(scope.length ? scope : panes, {
    workspace: focusWs ?? null,
  });
  const conflicts = includeConflicts ? collectConflicts(scope.length ? scope : panes) : [];

  const needs = (scope.length ? scope : panes).filter(
    (p) =>
      p.status === "needs_input" ||
      p.status === "blocked" ||
      p.status === "error" ||
      Boolean(p.lastToolFailure),
  );

  const lines: string[] = [];

  lines.push(`# Session handoff`);
  lines.push(``);
  lines.push(`| | |`);
  lines.push(`|---|---|`);
  lines.push(`| **Generated** | ${local} (\`${iso}\`) |`);
  lines.push(`| **Pack id** | \`${sessionId}\` |`);
  lines.push(`| **Format** | handoff-md/v2 |`);
  lines.push(`| **Panes** | ${panes.length} total · ${scope.length} in gate scope |`);
  if (focusWs) {
    lines.push(`| **Focus workspace** | ${focusWs.name} (\`${focusWs.path}\`) |`);
  }
  lines.push(
    `| **Merge gate** | ${gate.canMergeDryRun ? "✅ PASS (dry-run)" : "🛑 BLOCKED"} |`,
  );
  lines.push(``);

  if (note?.trim()) {
    lines.push(`> **Operator note:** ${note.trim()}`);
    lines.push(``);
  } else {
    lines.push(`> Generated from Agent Command Center — review attention before resume.`);
    lines.push(``);
  }

  lines.push(`## 1. Attention queue`);
  lines.push(``);
  if (needs.length === 0) {
    lines.push(`_No open attention._`);
    lines.push(``);
  } else {
    lines.push(`Clear these before merge or long idle:`);
    lines.push(``);
    for (const p of needs) {
      const detail = p.attention ?? p.lastToolFailure ?? p.status;
      lines.push(
        `- [ ] ${statusEmoji(p.status)} **${p.name}** (\`${p.role}\` · ${p.harness}) — ${detail}`,
      );
      lines.push(`  - workspace: ${wsName(workspaces, p.workspaceId)} · branch \`${p.branch}\``);
    }
    lines.push(``);
  }

  lines.push(`## 2. Fleet by workspace`);
  lines.push(``);

  for (const ws of workspaces) {
    const wsPanes = panes.filter((p) => p.workspaceId === ws.id);
    if (!wsPanes.length) continue;
    const title = ws.parentId ? `### ↳ ${ws.name}` : `### ${ws.name}`;
    lines.push(title);
    lines.push(``);
    lines.push(`\`${ws.path}\`${ws.lane ? ` · lane **${ws.lane}**` : ""}`);
    lines.push(``);
    lines.push(
      `| Pane | Role | Harness | Status | Branch | Worktree | Owns | MCP | Telemetry |`,
    );
    lines.push(
      `|------|------|---------|--------|--------|----------|------|-----|-----------|`,
    );
    for (const p of wsPanes) {
      const owns = p.ownedPaths?.length ? p.ownedPaths.join(", ") : "—";
      const mcp = p.mcpServerIds?.length
        ? `${p.mcpServerIds.length} srv`
        : p.mcpMode ?? "—";
      const tel =
        p.telemetry === "state_blind" || p.telemetry === "no_data"
          ? `\`${p.telemetry}\` ⚠️`
          : `\`${p.telemetry}\``;
      lines.push(
        `| **${p.name}** | ${p.role} | ${p.harness} | ${statusEmoji(p.status)} ${p.status} | \`${p.branch}\` | \`${p.worktree}\` | \`${owns}\` | ${mcp} | ${tel} |`,
      );
    }
    lines.push(``);
  }

  if (includeConflicts) {
    lines.push(`## 3. Multi-agent conflicts`);
    lines.push(``);
    const actionable = conflicts.filter((c) => c.kind !== "telemetry");
    if (actionable.length === 0) {
      lines.push(`_No path / branch / role / dirty / MCP conflicts in scope._`);
      lines.push(``);
    } else {
      for (const c of conflicts) {
        if (c.kind === "path") {
          lines.push(`### Path · \`${c.path}\``);
          lines.push(
            `- Owners: ${c.owners.map((o) => `**${o.name}** (${o.role})`).join(", ")}`,
          );
          lines.push(`- Resolve: ${c.resolveHint}`);
          lines.push(``);
        } else if (c.kind === "branch") {
          lines.push(`### Branch · \`${c.branch}\``);
          lines.push(
            `- Panes: ${c.panes.map((p) => `**${p.name}** (\`${p.worktree}\`)`).join(", ")}`,
          );
          lines.push(`- Resolve: ${c.resolveHint}`);
          lines.push(``);
        } else if (c.kind === "attention") {
          lines.push(`### Attention · ${c.name}`);
          lines.push(`- ${c.status}: ${c.detail}`);
          lines.push(`- Resolve: ${c.resolveHint}`);
          lines.push(``);
        } else if (c.kind === "dirty") {
          lines.push(`### Dirty · ${c.name}`);
          lines.push(`- \`${c.branch}\` @ \`${c.worktree}\``);
          lines.push(`- Resolve: ${c.resolveHint}`);
          lines.push(``);
        } else if (c.kind === "role") {
          lines.push(`### Role · ${c.issue}`);
          if (c.panes.length) {
            lines.push(`- ${c.panes.map((p) => p.name).join(", ")}`);
          }
          lines.push(`- Resolve: ${c.resolveHint}`);
          lines.push(``);
        } else if (c.kind === "mcp") {
          lines.push(`### MCP · ${c.issue.code}`);
          lines.push(`- ${c.issue.detail}`);
          lines.push(`- Resolve: ${c.resolveHint}`);
          lines.push(``);
        }
      }
    }
  }

  if (includeMcp) {
    lines.push(buildMcpHandoffSection(scope.length ? scope : panes));
  }

  lines.push(`## 4. Merge gate snapshot`);
  lines.push(``);
  lines.push(gate.dryRunSummary);
  lines.push(``);
  lines.push(`| Check | Sev | Result | Detail |`);
  lines.push(`|-------|-----|--------|--------|`);
  for (const ch of gate.checks) {
    const mark = ch.ok ? "✅" : ch.severity === "block" ? "🛑" : ch.severity === "warn" ? "⚠️" : "ℹ️";
    lines.push(
      `| ${ch.label} | ${ch.severity} | ${mark} | ${ch.detail.replace(/\|/g, "/")} |`,
    );
  }
  lines.push(``);

  if (includeMergePlan) {
    lines.push(`## 5. Proposed merge order`);
    lines.push(``);
    if (gate.canMergeDryRun) {
      gate.mergePlan.forEach((step, i) => {
        lines.push(`${i + 1}. ${step}`);
      });
    } else {
      lines.push(`_Plan withheld until block checks pass._`);
      lines.push(``);
      lines.push(`Intended order (informational):`);
      gate.mergePlan.forEach((step, i) => {
        lines.push(`${i + 1}. ${step}`);
      });
    }
    lines.push(``);
  }

  lines.push(`## 6. Next operator checklist`);
  lines.push(``);
  lines.push(`- [ ] Restore workspaces / open handoff project path`);
  lines.push(`- [ ] Import MCP pack if bindings changed`);
  lines.push(`- [ ] Clear **Attention queue** (section 1)`);
  lines.push(`- [ ] Resolve **Conflicts** (section 3) or accept risk`);
  lines.push(`- [ ] Re-run **Merge gate** until PASS dry-run`);
  lines.push(`- [ ] Execute ordered merges (section 5) only after PASS`);
  lines.push(`- [ ] Run tests / cargo gates; report to coord`);
  lines.push(`- [ ] Keep worktrees until merge confirmed (close = destroy)`);
  lines.push(``);

  lines.push(`## 7. Restore hints`);
  lines.push(``);
  lines.push("```");
  lines.push(`# Workspaces in this pack`);
  for (const ws of workspaces) {
    const n = panes.filter((p) => p.workspaceId === ws.id).length;
    if (!n) continue;
    lines.push(`${ws.path}  # ${ws.name} · ${n} panes`);
  }
  lines.push("```");
  lines.push(``);
  lines.push(`---`);
  lines.push(`*handoff-md/v2 · ADE does not mutate git; dry-run only.*`);

  return lines.join("\n");
}
