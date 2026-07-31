/**
 * Per-pane MCP inspector — tools, servers, policy, deep-link to Control Center.
 */
import { Cable, ExternalLink, Shield, X } from "lucide-react";
import {
  evaluateMcpPolicies,
  loadMcpConfig,
  paneEffectiveServers,
  paneEffectiveTools,
  statusLabel,
} from "./mcpConfig";
import type { Pane } from "./types";

export function McpPaneInspector({
  pane,
  onClose,
  onOpenControlCenter,
}: {
  pane: Pane;
  onClose: () => void;
  onOpenControlCenter: () => void;
}) {
  const cfg = loadMcpConfig();
  const servers = paneEffectiveServers(pane, cfg);
  const tools = paneEffectiveTools(pane, cfg);
  const issues = evaluateMcpPolicies([pane], cfg);

  return (
    <div
      className="fixed inset-0 z-[65] flex items-end justify-center bg-bg/60 p-3 sm:items-center"
      onClick={onClose}
      role="dialog"
      aria-label={`MCP for ${pane.name}`}
    >
      <div
        className="max-h-[min(85dvh,560px)] w-full max-w-md overflow-hidden rounded-xl border border-border bg-surface shadow-panel"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-start gap-2 border-b border-border px-4 py-3">
          <Cable className="mt-0.5 size-4 text-accent" />
          <div className="min-w-0 flex-1">
            <h2 className="font-mono text-sm font-semibold text-fg">
              MCP · {pane.name}
            </h2>
            <p className="font-mono text-[10px] text-muted">
              {pane.harness} · {pane.role} · mode {pane.mcpMode ?? "live-binding"}
              {pane.mcpPresetId ? ` · ${pane.mcpPresetId}` : ""}
            </p>
          </div>
          <button type="button" onClick={onClose} className="text-muted hover:text-fg" aria-label="Close">
            <X className="size-4" />
          </button>
        </header>

        <div className="max-h-[60dvh] space-y-4 overflow-y-auto p-4">
          <section>
            <h3 className="label-caps mb-2">Active servers</h3>
            {servers.length === 0 ? (
              <p className="font-mono text-[11px] text-subtle">None bound</p>
            ) : (
              <ul className="space-y-1.5">
                {servers.map((s) => (
                  <li
                    key={s.id}
                    className="flex items-center justify-between rounded-md border border-border bg-elevated px-2 py-1.5 font-mono text-[11px]"
                  >
                    <span className="text-fg">{s.name}</span>
                    <span
                      className={
                        s.status === "connected"
                          ? "text-success"
                          : s.status === "degraded"
                            ? "text-need"
                            : s.status === "missing"
                              ? "text-danger"
                              : "text-subtle"
                      }
                    >
                      {statusLabel(s.status)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <h3 className="label-caps mb-2">Tools ({tools.length})</h3>
            <div className="flex flex-wrap gap-1">
              {tools.length === 0 ? (
                <span className="text-[11px] text-subtle">—</span>
              ) : (
                tools.map((t) => (
                  <span
                    key={t}
                    className="rounded-sm border border-border bg-elevated px-1.5 py-0.5 font-mono text-[10px] text-muted"
                  >
                    {t}
                  </span>
                ))
              )}
            </div>
          </section>

          <section>
            <h3 className="label-caps mb-2 flex items-center gap-1">
              <Shield className="size-3" /> Role policy
            </h3>
            {issues.length === 0 ? (
              <p className="rounded-md border border-success/30 bg-success-dim/20 px-2 py-1.5 font-mono text-[11px] text-success">
                No MCP policy issues
              </p>
            ) : (
              <ul className="space-y-1">
                {issues.map((i, idx) => (
                  <li
                    key={idx}
                    className={`rounded-md border px-2 py-1.5 font-mono text-[10px] ${
                      i.severity === "block"
                        ? "border-danger/40 bg-danger-dim/20 text-danger"
                        : i.severity === "warn"
                          ? "border-need/40 bg-need-dim/20 text-need"
                          : "border-border text-muted"
                    }`}
                  >
                    [{i.severity}] {i.detail}
                  </li>
                ))}
              </ul>
            )}
          </section>

          {pane.lastToolFailure && (
            <section className="rounded-md border border-danger/30 bg-danger-dim/15 px-2 py-2 font-mono text-[11px] text-danger">
              Last tool failure: {pane.lastToolFailure}
            </section>
          )}
        </div>

        <footer className="border-t border-border p-3">
          <button
            type="button"
            onClick={() => {
              onOpenControlCenter();
              onClose();
            }}
            className="flex w-full items-center justify-center gap-2 rounded-md border border-accent/40 bg-accent-dim py-2 font-mono text-[11px] font-semibold text-accent"
          >
            <ExternalLink className="size-3.5" /> Open MCP Control Center
          </button>
        </footer>
      </div>
    </div>
  );
}
