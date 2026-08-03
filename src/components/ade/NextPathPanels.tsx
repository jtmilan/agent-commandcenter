/**
 * Build-path feature surfaces:
 * Diff/PR · Runbook · Conflict heat map · Session timeline ·
 * Org MCP policy · Shared inbox · Welcome mission · Soft-gate · Host bridge strip
 */
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  BookOpen,
  CheckCircle2,
  Circle,
  Flame,
  GitBranch,
  GitPullRequest,
  History,
  Lock,
  Rocket,
  Shield,
  Users,
  X,
  Zap,
} from "lucide-react";
import {
  canUse,
  grantWelcomeCredits,
  loadEntitlements,
  saveEntitlements,
  spendHandoffCredit,
  type LocalEntitlements,
  type SoftGateFeature,
} from "../../lib/entitlementsClient";
import {
  detectHost,
  destroyWorktree,
  hostBannerText,
  registerWorktreeRoot,
  spawnAgent,
  type HostMode,
} from "../../lib/agent-bridge";
import {
  getStatusHistory,
  publishStatus,
  subscribeStatus,
  type StatusEvent,
} from "../../lib/statusBus";
import { HARNESS_REGISTRY } from "./harnesses";
import type { Pane, Workspace } from "./types";

function Shell({
  title,
  subtitle,
  onClose,
  children,
  wide,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-bg/70 p-0 sm:items-center sm:p-4">
      <div
        className={`flex max-h-[92dvh] w-full flex-col border border-border bg-surface shadow-panel sm:rounded-lg ${
          wide ? "sm:max-w-3xl" : "sm:max-w-xl"
        }`}
      >
        <header className="flex items-start justify-between gap-2 border-b border-border px-4 py-3">
          <div>
            <p className="font-mono text-xs font-semibold text-fg">{title}</p>
            {subtitle && <p className="mt-0.5 text-[11px] text-muted">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-border p-1.5 text-muted hover:text-fg"
            aria-label="Close"
          >
            <X className="size-3.5" />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">{children}</div>
      </div>
    </div>
  );
}

/* ─── Host bridge banner ─── */
export function HostBridgeBanner({
  onSpawnDemo,
  onToast,
}: {
  onSpawnDemo?: () => void;
  onToast: (m: string) => void;
}) {
  const [host, setHost] = useState<HostMode>("web_mock");
  useEffect(() => {
    setHost(detectHost());
  }, []);
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-border bg-elevated/40 px-3 py-1.5 font-mono text-[10px]">
      <Zap className={`size-3 ${host === "tauri" ? "text-success" : "text-need"}`} />
      <span className={host === "tauri" ? "text-success" : "text-muted"}>
        {hostBannerText(host)}
      </span>
      <button
        type="button"
        className="ml-auto rounded border border-border px-2 py-0.5 text-accent hover:bg-accent-dim"
        onClick={async () => {
          registerWorktreeRoot("/Users/demo/projects");
          const job = await spawnAgent({
            paneId: "demo-spawn",
            harness: "claude-code",
            cmd: "claude",
            cwd: "/Users/demo/projects/harness-ready",
            worktree: "/Users/demo/projects/harness-ready/.worktrees/demo",
            role: "builder",
          });
          publishStatus({
            kind: "spawn",
            paneId: job.paneId,
            message: `spawn ${job.status} (${job.host}) job=${job.jobId}`,
            source: job.host === "tauri" ? "pty" : "mock",
          });
          onToast(
            job.host === "web_mock"
              ? "Mock spawn queued — desktop Tauri required for real PTY"
              : `Spawned job ${job.jobId}`,
          );
          onSpawnDemo?.();
        }}
      >
        Test spawn
      </button>
      <button
        type="button"
        className="rounded border border-border px-2 py-0.5 text-muted hover:text-fg"
        onClick={async () => {
          const path = "/Users/demo/projects/harness-ready/.worktrees/demo";
          registerWorktreeRoot("/Users/demo/projects");
          const r = await destroyWorktree(path);
          publishStatus({
            kind: "worktree",
            message: r.ok
              ? `worktree destroy ok: ${path} (${r.host})`
              : `worktree destroy failed: ${r.error}`,
            source: r.host === "tauri" ? "git" : "mock",
          });
          onToast(r.ok ? "Worktree destroy (scoped) ok" : r.error ?? "fail");
        }}
      >
        Test destroy
      </button>
    </div>
  );
}

/* ─── Soft gate ─── */
export function SoftGateModal({
  feature,
  entitlements,
  onEntitlements,
  onClose,
  onToast,
  onProceed,
}: {
  feature: SoftGateFeature;
  entitlements: LocalEntitlements;
  onEntitlements: (e: LocalEntitlements) => void;
  onClose: () => void;
  onToast: (m: string) => void;
  onProceed?: () => void;
}) {
  const gate = canUse(entitlements, feature);
  if (gate.ok) {
    return (
      <Shell title="Capacity gate" onClose={onClose}>
        <p className="text-sm text-fg">You already have access.</p>
        <button
          type="button"
          className="mt-3 rounded-md bg-accent px-3 py-2 font-mono text-[11px] font-semibold text-accent-fg"
          onClick={() => {
            onProceed?.();
            onClose();
          }}
        >
          Continue
        </button>
      </Shell>
    );
  }
  return (
    <Shell
      title="Capacity gate"
      subtitle="Local worktrees always stay; cloud extras soft-gate."
      onClose={onClose}
    >
      <p className="text-sm text-fg">{gate.reason}</p>
      <p className="mt-2 font-mono text-[11px] text-muted">
        Credits · handoffs {entitlements.credits.handoffBalance} · tokens{" "}
        {entitlements.credits.tokenBalance.toLocaleString()} · plan {entitlements.planId}
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        {feature === "handoff" && entitlements.credits.handoffBalance > 0 && (
          <button
            type="button"
            className="rounded-md bg-accent px-3 py-2 font-mono text-[11px] font-semibold text-accent-fg"
            onClick={() => {
              const next = spendHandoffCredit(entitlements, 1);
              onEntitlements(next);
              publishStatus({
                kind: "credit",
                message: "Spent 1 handoff credit",
                source: "operator",
              });
              onToast("Spent 1 handoff credit");
              onProceed?.();
              onClose();
            }}
          >
            Spend 1 handoff credit
          </button>
        )}
        <button
          type="button"
          className="rounded-md border border-accent/40 bg-accent-dim px-3 py-2 font-mono text-[11px] text-accent"
          onClick={() => {
            onToast(`Checkout → upgrade to ${gate.upgrade ?? "pro"} (ade-api)`);
            onClose();
          }}
        >
          Upgrade to {gate.upgrade ?? "pro"}
        </button>
        <button
          type="button"
          className="rounded-md border border-border px-3 py-2 font-mono text-[11px] text-muted"
          onClick={onClose}
        >
          Keep working locally
        </button>
      </div>
    </Shell>
  );
}

/* ─── Diff / PR review ─── */
const DEMO_DIFF = `diff --git a/src/lib/agent-bridge.ts b/src/lib/agent-bridge.ts
@@ -1,6 +1,12 @@
+export function detectHost(): HostMode { ... }
+export async function spawnAgent(req: SpawnRequest) { ... }
 
diff --git a/ui/CommandCenter.tsx b/ui/CommandCenter.tsx
@@ -80,3 +88,12 @@
+  const [persona, setPersona] = useState<PersonaId>(...)
`;

export function DiffPrPane({
  panes,
  onClose,
  onToast,
}: {
  panes: Pane[];
  onClose: () => void;
  onToast: (m: string) => void;
}) {
  const reviewers = panes.filter((p) => p.role === "reviewer" || p.role === "coordinator");
  const [file, setFile] = useState("src/lib/agent-bridge.ts");
  return (
    <Shell
      title="Diff / PR review"
      subtitle="Reviewer lane — side-by-side patch + open PR"
      onClose={onClose}
      wide
    >
      <div className="mb-3 flex flex-wrap gap-2">
        {["src/lib/agent-bridge.ts", "ui/CommandCenter.tsx", "docs/BUILD-PATH.md"].map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFile(f)}
            className={`rounded border px-2 py-1 font-mono text-[10px] ${
              file === f ? "border-accent text-accent" : "border-border text-muted"
            }`}
          >
            {f}
          </button>
        ))}
      </div>
      <pre className="overflow-x-auto rounded-lg border border-border bg-elevated p-3 font-mono text-[10px] leading-relaxed text-fg">
        {DEMO_DIFF}
      </pre>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="font-mono text-[10px] text-subtle">
          Reviewers: {reviewers.map((r) => r.name).join(", ") || "none assigned"}
        </span>
        <button
          type="button"
          className="ml-auto inline-flex items-center gap-1 rounded-md bg-accent px-3 py-1.5 font-mono text-[11px] font-semibold text-accent-fg"
          onClick={() => {
            publishStatus({
              kind: "system",
              message: `Open PR draft for ${file}`,
              source: "operator",
            });
            onToast("Would open gh pr create (desktop host)");
          }}
        >
          <GitPullRequest className="size-3.5" /> Open PR
        </button>
      </div>
    </Shell>
  );
}

/* ─── Runbook runner ─── */
type StepStatus = "pending" | "running" | "done" | "paused" | "failed";

interface RunStep {
  id: string;
  label: string;
  status: StepStatus;
}

const DEFAULT_STEPS: RunStep[] = [
  { id: "s1", label: "Spawn coordinator + 2 builders", status: "pending" },
  { id: "s2", label: "Wait for clean git on builder lanes", status: "pending" },
  { id: "s3", label: "Run tests (dry-run mock)", status: "pending" },
  { id: "s4", label: "Merge gate checklist", status: "pending" },
  { id: "s5", label: "Export handoff pack", status: "pending" },
];

export function RunbookRunner({
  entitlements,
  onClose,
  onToast,
  onGate,
}: {
  entitlements: LocalEntitlements;
  onClose: () => void;
  onToast: (m: string) => void;
  onGate: (f: SoftGateFeature, proceed: () => void) => void;
}) {
  const [steps, setSteps] = useState(DEFAULT_STEPS);
  const [running, setRunning] = useState(false);

  const advance = () => {
    setSteps((prev) => {
      const idx = prev.findIndex((s) => s.status === "running" || s.status === "pending");
      if (idx < 0) return prev;
      const next = prev.map((s, i) => {
        if (i < idx) return { ...s, status: "done" as const };
        if (i === idx) return { ...s, status: "done" as const };
        if (i === idx + 1) return { ...s, status: "running" as const };
        return s;
      });
      const done = next.filter((s) => s.status === "done").length;
      publishStatus({
        kind: "runbook",
        message: `Runbook step ${done}/${next.length}`,
        source: "operator",
      });
      if (done >= next.length) {
        setRunning(false);
        onToast("Runbook complete");
      }
      return next;
    });
  };

  const start = () => {
    onGate("runbook", () => {
      setSteps(DEFAULT_STEPS.map((s, i) => ({ ...s, status: i === 0 ? "running" : "pending" })));
      setRunning(true);
      publishStatus({ kind: "runbook", message: "Runbook started", source: "operator" });
      onToast("Runbook started");
    });
  };

  return (
    <Shell title="Runbook runner" subtitle="Ordered playbook with pause/resume" onClose={onClose}>
      <p className="mb-3 text-xs text-muted">
        Plan: {entitlements.planId}. Free users hit soft-gate; Pro+ can run full playbooks.
      </p>
      <ul className="space-y-2">
        {steps.map((s) => (
          <li
            key={s.id}
            className="flex items-center gap-2 rounded-lg border border-border bg-elevated px-3 py-2 font-mono text-[11px]"
          >
            {s.status === "done" ? (
              <CheckCircle2 className="size-3.5 text-success" />
            ) : s.status === "running" ? (
              <Rocket className="size-3.5 animate-pulse text-accent" />
            ) : (
              <Circle className="size-3.5 text-subtle" />
            )}
            <span className="text-fg">{s.label}</span>
            <span className="ml-auto text-subtle">{s.status}</span>
          </li>
        ))}
      </ul>
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={start}
          className="rounded-md bg-accent px-3 py-2 font-mono text-[11px] font-semibold text-accent-fg"
        >
          Start
        </button>
        <button
          type="button"
          disabled={!running}
          onClick={advance}
          className="rounded-md border border-border px-3 py-2 font-mono text-[11px] text-fg disabled:opacity-40"
        >
          Complete step
        </button>
        <button
          type="button"
          onClick={() => {
            setRunning(false);
            setSteps((s) =>
              s.map((x) => (x.status === "running" ? { ...x, status: "paused" } : x)),
            );
            onToast("Runbook paused");
          }}
          className="rounded-md border border-border px-3 py-2 font-mono text-[11px] text-muted"
        >
          Pause
        </button>
      </div>
    </Shell>
  );
}

/* ─── Live conflict heat map ─── */
export function ConflictHeatMap({
  panes,
  onClose,
  onJump,
}: {
  panes: Pane[];
  onClose: () => void;
  onJump: (id: string) => void;
}) {
  const cells = useMemo(() => {
    const map = new Map<string, { path: string; panes: Pane[]; heat: number }>();
    for (const p of panes) {
      for (const path of p.ownedPaths ?? []) {
        const key = path;
        const cur = map.get(key) ?? { path, panes: [], heat: 0 };
        cur.panes.push(p);
        cur.heat = cur.panes.length + (p.status === "working" ? 1 : 0);
        map.set(key, cur);
      }
    }
    return [...map.values()].sort((a, b) => b.heat - a.heat);
  }, [panes]);

  return (
    <Shell
      title="Conflict heat map"
      subtitle="Who is writing overlapping paths right now"
      onClose={onClose}
      wide
    >
      {cells.length === 0 ? (
        <p className="text-sm text-muted">No path claims — load demo fleet or assign ownedPaths.</p>
      ) : (
        <ul className="space-y-2">
          {cells.map((c) => (
            <li
              key={c.path}
              className={`rounded-lg border px-3 py-2 ${
                c.panes.length > 1
                  ? "border-need/50 bg-need-dim/30"
                  : "border-border bg-elevated"
              }`}
            >
              <div className="flex items-center gap-2">
                <Flame
                  className={`size-3.5 ${c.panes.length > 1 ? "text-need" : "text-subtle"}`}
                />
                <span className="font-mono text-[11px] text-fg">{c.path}</span>
                <span className="ml-auto font-mono text-[10px] text-muted">heat {c.heat}</span>
              </div>
              <div className="mt-1 flex flex-wrap gap-1">
                {c.panes.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => onJump(p.id)}
                    className="rounded border border-border px-1.5 py-0.5 font-mono text-[10px] text-accent"
                  >
                    {p.name} · {p.status}
                  </button>
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Shell>
  );
}

/* ─── Session timeline ─── */
export function SessionTimeline({ onClose }: { onClose: () => void }) {
  const [events, setEvents] = useState<StatusEvent[]>(() => getStatusHistory(80));
  useEffect(() => {
    return subscribeStatus(() => setEvents(getStatusHistory(80)));
  }, []);

  return (
    <Shell
      title="Session timeline"
      subtitle="Scrubable event log for postmortems"
      onClose={onClose}
      wide
    >
      {events.length === 0 ? (
        <p className="text-sm text-muted">
          No events yet — spawn agents, run merge, or complete a mission to fill the log.
        </p>
      ) : (
        <ol className="space-y-1 border-l border-border pl-3">
          {events.map((e) => (
            <li key={e.id} className="relative py-1.5 font-mono text-[10px]">
              <span className="absolute -left-[17px] top-2 size-2 rounded-full bg-accent" />
              <span className="text-subtle">{new Date(e.at).toLocaleTimeString()}</span>
              <span className="mx-1 text-accent">{e.kind}</span>
              <span className="text-fg">{e.message}</span>
              <span className="ml-1 text-subtle">· {e.source}</span>
            </li>
          ))}
        </ol>
      )}
    </Shell>
  );
}

/* ─── Org MCP policy ─── */
const ORG_MCP_KEY = "hr-ade-org-mcp-v1";

export function OrgMcpPolicy({
  entitlements,
  onClose,
  onToast,
  onGate,
}: {
  entitlements: LocalEntitlements;
  onClose: () => void;
  onToast: (m: string) => void;
  onGate: (f: SoftGateFeature, proceed: () => void) => void;
}) {
  const [allowed, setAllowed] = useState<string[]>(() => {
    try {
      const r = localStorage.getItem(ORG_MCP_KEY);
      if (r) return JSON.parse(r) as string[];
    } catch {
      /* */
    }
    return ["filesystem", "git", "github", "memory"];
  });
  const [draft, setDraft] = useState("");

  const save = (next: string[]) => {
    setAllowed(next);
    try {
      localStorage.setItem(ORG_MCP_KEY, JSON.stringify(next));
    } catch {
      /* */
    }
  };

  return (
    <Shell
      title="Org MCP policy"
      subtitle="Approved servers for Team seats — operators cannot bind others"
      onClose={onClose}
    >
      <button
        type="button"
        className="mb-3 rounded-md border border-border px-2 py-1 font-mono text-[10px] text-muted"
        onClick={() =>
          onGate("org_mcp_policy", () => onToast("Org MCP policy unlocked for this session"))
        }
      >
        Check Team entitlement
      </button>
      <ul className="space-y-1">
        {allowed.map((s) => (
          <li
            key={s}
            className="flex items-center justify-between rounded border border-border bg-elevated px-2 py-1.5 font-mono text-[11px]"
          >
            <span className="flex items-center gap-1 text-fg">
              <Lock className="size-3 text-accent" /> {s}
            </span>
            <button
              type="button"
              className="text-need"
              onClick={() => {
                if (!canUse(entitlements, "org_mcp_policy").ok) {
                  onGate("org_mcp_policy", () => {});
                  return;
                }
                save(allowed.filter((x) => x !== s));
                onToast(`Removed ${s} from org allowlist`);
              }}
            >
              remove
            </button>
          </li>
        ))}
      </ul>
      <div className="mt-3 flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="server-id"
          className="flex-1 rounded-md border border-border bg-bg px-2 py-1.5 font-mono text-xs text-fg"
        />
        <button
          type="button"
          className="rounded-md bg-accent px-3 py-1.5 font-mono text-[11px] font-semibold text-accent-fg"
          onClick={() => {
            if (!canUse(entitlements, "org_mcp_policy").ok) {
              onGate("org_mcp_policy", () => {});
              return;
            }
            const id = draft.trim();
            if (!id) return;
            save([...new Set([...allowed, id])]);
            setDraft("");
            onToast(`Allowed MCP: ${id}`);
          }}
        >
          Allow
        </button>
      </div>
    </Shell>
  );
}

/* ─── Shared team inbox ─── */
export function SharedTeamInbox({
  panes,
  workspaces,
  entitlements,
  onJump,
  onClose,
  onToast,
  onGate,
}: {
  panes: Pane[];
  workspaces: Workspace[];
  entitlements: LocalEntitlements;
  onJump: (id: string) => void;
  onClose: () => void;
  onToast: (m: string) => void;
  onGate: (f: SoftGateFeature, proceed: () => void) => void;
}) {
  const items = panes.filter(
    (p) =>
      p.status === "needs_input" ||
      p.status === "blocked" ||
      p.status === "error" ||
      Boolean(p.lastToolFailure),
  );

  return (
    <Shell
      title="Shared attention inbox"
      subtitle="Team seat queue — hand off blocked panes"
      onClose={onClose}
      wide
    >
      {!canUse(entitlements, "shared_inbox").ok && (
        <div className="mb-3 rounded-lg border border-need/40 bg-need-dim/20 px-3 py-2 text-xs text-fg">
          Shared inbox is a Team feature.{" "}
          <button
            type="button"
            className="text-accent underline"
            onClick={() => onGate("shared_inbox", () => onToast("Team inbox unlocked (demo)"))}
          >
            Unlock / upgrade
          </button>
        </div>
      )}
      {items.length === 0 ? (
        <p className="text-sm text-muted">Queue empty — no blocked panes.</p>
      ) : (
        <ul className="space-y-2">
          {items.map((p) => {
            const ws = workspaces.find((w) => w.id === p.workspaceId);
            return (
              <li
                key={p.id}
                className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-elevated px-3 py-2"
              >
                <Users className="size-3.5 text-need" />
                <div className="min-w-0 flex-1">
                  <p className="font-mono text-[11px] text-fg">
                    {p.name} · {p.status}
                  </p>
                  <p className="text-[10px] text-muted">
                    {ws?.name ?? p.workspaceId} · {p.attention ?? p.lastToolFailure ?? "—"}
                  </p>
                </div>
                <button
                  type="button"
                  className="rounded border border-border px-2 py-1 font-mono text-[10px] text-accent"
                  onClick={() => onJump(p.id)}
                >
                  Jump
                </button>
                <button
                  type="button"
                  className="rounded border border-border px-2 py-1 font-mono text-[10px] text-muted"
                  onClick={() => {
                    if (!canUse(entitlements, "shared_inbox").ok) {
                      onGate("shared_inbox", () => {});
                      return;
                    }
                    publishStatus({
                      kind: "system",
                      paneId: p.id,
                      message: `Handed off ${p.name} to teammate seat`,
                      source: "operator",
                    });
                    onToast(`Handoff ${p.name} → teammate (Team)`);
                  }}
                >
                  Hand off
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Shell>
  );
}

/* ─── Welcome mission ─── */
const MISSION_KEY = "hr-ade-welcome-mission-v1";

interface MissionStep {
  id: string;
  label: string;
  done: boolean;
}

export function WelcomeMission({
  panes,
  mode,
  entitlements,
  onEntitlements,
  onLoadDemo,
  onOpenFeature,
  onClose,
  onToast,
}: {
  panes: Pane[];
  mode: string;
  entitlements: LocalEntitlements;
  onEntitlements: (e: LocalEntitlements) => void;
  onLoadDemo: () => void;
  onOpenFeature: (id: string) => void;
  onClose: () => void;
  onToast: (m: string) => void;
}) {
  const [steps, setSteps] = useState<MissionStep[]>(() => {
    try {
      const r = localStorage.getItem(MISSION_KEY);
      if (r) return JSON.parse(r) as MissionStep[];
    } catch {
      /* */
    }
    return [
      { id: "demo", label: "Load a multi-agent fleet (demo)", done: false },
      { id: "merge", label: "Open merge gate dry-run", done: false },
      { id: "handoff", label: "Export a session handoff", done: false },
    ];
  });

  useEffect(() => {
    setSteps((prev) => {
      const next = prev.map((s) => {
        if (s.id === "demo" && (mode === "fleet" || panes.length > 0)) return { ...s, done: true };
        return s;
      });
      try {
        localStorage.setItem(MISSION_KEY, JSON.stringify(next));
      } catch {
        /* */
      }
      return next;
    });
  }, [mode, panes.length]);

  const allDone = steps.every((s) => s.done);
  const claimedKey = "hr-ade-welcome-claimed";

  return (
    <Shell
      title="Welcome mission"
      subtitle="Activate in 3 steps — earn welcome credits"
      onClose={onClose}
    >
      <ul className="space-y-2">
        {steps.map((s) => (
          <li
            key={s.id}
            className="flex items-center gap-2 rounded-lg border border-border bg-elevated px-3 py-2"
          >
            {s.done ? (
              <CheckCircle2 className="size-4 text-success" />
            ) : (
              <Circle className="size-4 text-subtle" />
            )}
            <span className="flex-1 text-sm text-fg">{s.label}</span>
            {!s.done && s.id === "demo" && (
              <button
                type="button"
                className="font-mono text-[10px] text-accent"
                onClick={onLoadDemo}
              >
                Load
              </button>
            )}
            {!s.done && s.id === "merge" && (
              <button
                type="button"
                className="font-mono text-[10px] text-accent"
                onClick={() => {
                  onOpenFeature("merge");
                  setSteps((prev) => {
                    const next = prev.map((x) => (x.id === "merge" ? { ...x, done: true } : x));
                    localStorage.setItem(MISSION_KEY, JSON.stringify(next));
                    return next;
                  });
                }}
              >
                Open
              </button>
            )}
            {!s.done && s.id === "handoff" && (
              <button
                type="button"
                className="font-mono text-[10px] text-accent"
                onClick={() => {
                  onOpenFeature("handoff");
                  setSteps((prev) => {
                    const next = prev.map((x) => (x.id === "handoff" ? { ...x, done: true } : x));
                    localStorage.setItem(MISSION_KEY, JSON.stringify(next));
                    return next;
                  });
                }}
              >
                Open
              </button>
            )}
          </li>
        ))}
      </ul>
      {allDone && (
        <button
          type="button"
          className="mt-4 w-full rounded-md bg-accent px-3 py-2 font-mono text-[11px] font-semibold text-accent-fg"
          onClick={() => {
            if (localStorage.getItem(claimedKey)) {
              onToast("Welcome credits already claimed");
              return;
            }
            const next = grantWelcomeCredits(entitlements);
            onEntitlements(next);
            localStorage.setItem(claimedKey, "1");
            publishStatus({
              kind: "mission",
              message: "Welcome mission complete — credits granted",
              source: "operator",
            });
            onToast("+5 handoffs · +50k tokens welcome credits");
          }}
        >
          Claim welcome credits
        </button>
      )}
    </Shell>
  );
}

/* ─── Entitlements chip ─── */
export function EntitlementsChip({
  entitlements,
  onOpenMission,
}: {
  entitlements: LocalEntitlements;
  onOpenMission: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpenMission}
      className="hidden items-center gap-1 rounded border border-border bg-elevated px-1.5 py-0.5 font-mono text-[9px] text-muted hover:text-fg sm:inline-flex"
      title="Entitlements + welcome mission"
    >
      <Shield className="size-3 text-accent" />
      {entitlements.planId}
      <span className="text-subtle">·</span>
      <GitBranch className="size-2.5" />
      {entitlements.credits.handoffBalance}
    </button>
  );
}

export function seedTimelineFromFleet(panes: Pane[]) {
  if (getStatusHistory(1).length > 0) return;
  publishStatus({
    kind: "system",
    message: "Session started",
    source: "mock",
  });
  for (const p of panes.slice(0, 4)) {
    const harness = HARNESS_REGISTRY.find(
      (h) => h.id === p.harness || h.aliases.includes(p.harness),
    );
    publishStatus({
      kind: "status",
      paneId: p.id,
      workspaceId: p.workspaceId,
      message: `${p.name} ${p.status}`,
      source: harness?.telemetry === "full" ? "hooks" : "state_blind",
      status: p.status,
      telemetry: p.telemetry,
    });
  }
}

export { loadEntitlements, saveEntitlements, type LocalEntitlements, type SoftGateFeature };
