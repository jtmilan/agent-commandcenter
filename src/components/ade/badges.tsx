import type { PaneStatus, Role, TelemetryState } from "./types";

const statusStyles: Record<PaneStatus, string> = {
  working: "bg-info-dim text-info border-info/30",
  needs_input: "bg-need-dim text-need border-need/40",
  blocked: "bg-need-dim text-need border-need/30",
  error: "bg-danger-dim text-danger border-danger/40",
  idle: "bg-elevated text-muted border-border",
  starting: "bg-elevated text-muted border-border",
};

const roleLabel: Record<Role, string> = {
  coordinator: "coord",
  builder: "builder",
  scout: "scout",
  reviewer: "reviewer",
  none: "—",
};

export function StatusPill({ status }: { status: PaneStatus }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-sm border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ${statusStyles[status]}`}
    >
      <span
        className={`size-1.5 rounded-full ${
          status === "needs_input" || status === "blocked"
            ? "bg-need"
            : status === "error"
              ? "bg-danger"
              : status === "working"
                ? "bg-info"
                : "bg-subtle"
        }`}
        aria-hidden
      />
      {status.replace("_", " ")}
    </span>
  );
}

export function RolePill({ role }: { role: Role }) {
  if (role === "none") {
    return <span className="text-subtle tabular text-[11px]">—</span>;
  }
  return (
    <span className="rounded-sm border border-border bg-elevated px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide text-muted">
      {roleLabel[role]}
    </span>
  );
}

export function TelemetryChip({ state }: { state: TelemetryState }) {
  const map: Record<TelemetryState, { label: string; className: string }> = {
    live: { label: "live · 2s", className: "text-success border-success/30 bg-success-dim" },
    stale: { label: "stale", className: "text-need border-need/30 bg-need-dim" },
    state_blind: {
      label: "telemetry limited",
      className: "text-muted border-border bg-elevated",
    },
    placeholder: {
      label: "placeholder",
      className: "text-need border-need/40 bg-need-dim",
    },
    no_data: {
      label: "no data",
      className: "text-subtle border-border bg-elevated",
    },
  };
  const s = map[state];
  return (
    <span
      className={`inline-flex rounded-sm border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide ${s.className}`}
    >
      {s.label}
    </span>
  );
}
