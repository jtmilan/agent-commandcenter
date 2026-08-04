import { useState } from "react";
import { AlertTriangle, FolderX, GitBranch, Loader2, X } from "lucide-react";
import type { Pane } from "./types";

export type CloseConfirmResult = {
  ok: boolean;
  message: string;
  destroyed?: boolean;
  error?: string;
};

type Props = {
  pane: Pane | null;
  open: boolean;
  onCancel: () => void;
  /** Kill agent + path-scoped worktree destroy. Return result for toast. */
  onConfirm: (paneId: string) => void | Promise<CloseConfirmResult | void>;
};

export function ClosePaneDialog({ pane, open, onCancel, onConfirm }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open || !pane) return null;

  const dirty = pane.gitClean === false;
  const worktree = pane.worktree;

  const handleConfirm = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await onConfirm(pane.id);
      if (result && result.ok === false) {
        setError(result.error ?? result.message ?? "Destroy failed");
        setBusy(false);
        return;
      }
      setBusy(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-bg/80 px-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="close-pane-title"
      onClick={busy ? undefined : onCancel}
    >
      <div
        className="w-full max-w-md overflow-hidden rounded-lg border border-danger/40 bg-surface shadow-panel"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-start gap-3 border-b border-border px-4 py-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-md border border-danger/40 bg-danger-dim">
            <AlertTriangle className="size-4 text-danger" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 id="close-pane-title" className="font-mono text-sm font-semibold text-fg">
              Close harness pane?
            </h2>
            <p className="mt-0.5 font-mono text-[11px] uppercase text-muted">{pane.name}</p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="rounded p-1 text-subtle hover:text-fg disabled:opacity-40"
            aria-label="Cancel"
          >
            <X className="size-4" />
          </button>
        </header>

        <div className="space-y-3 px-4 py-4 text-sm">
          <p className="leading-relaxed text-muted">
            Exiting this pane will{" "}
            <strong className="text-danger">destroy the worktree folder</strong> and can{" "}
            <strong className="text-fg">result in data loss</strong> for uncommitted or
            un-pushed work. The host will kill the agent job first, then run path-scoped
            worktree remove.
          </p>

          <div className="rounded-md border border-border bg-elevated px-3 py-2 font-mono text-[11px]">
            <div className="flex items-start gap-2 text-muted">
              <FolderX className="mt-0.5 size-3.5 shrink-0 text-danger" />
              <div className="min-w-0">
                <div className="text-[9px] uppercase tracking-wide text-subtle">
                  Worktree to remove
                </div>
                <div className="mt-0.5 break-all text-fg">{worktree}</div>
              </div>
            </div>
            <div className="mt-2 flex items-center gap-2 border-t border-border/80 pt-2 text-muted">
              <GitBranch className="size-3.5 shrink-0 text-accent" />
              <span>
                branch <span className="text-fg">{pane.branch}</span>
                {dirty && (
                  <span className="ml-2 rounded-sm bg-need-dim px-1.5 py-0.5 text-[9px] font-semibold text-need">
                    dirty working tree
                  </span>
                )}
                {pane.gitClean && (
                  <span className="ml-2 rounded-sm bg-success-dim px-1.5 py-0.5 text-[9px] text-success">
                    clean
                  </span>
                )}
              </span>
            </div>
          </div>

          {dirty && (
            <p className="rounded-md border border-need/30 bg-need-dim/40 px-3 py-2 font-mono text-[11px] text-need">
              Uncommitted changes will be deleted with the worktree. Commit or stash first if
              you need them.
            </p>
          )}

          {error && (
            <p className="rounded-md border border-danger/40 bg-danger-dim/30 px-3 py-2 font-mono text-[11px] text-danger">
              {error}
            </p>
          )}
        </div>

        <footer className="flex flex-col-reverse gap-2 border-t border-border bg-elevated/40 px-4 py-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="rounded-md border border-border bg-surface px-3 py-2 text-sm text-fg hover:bg-panel disabled:opacity-40"
          >
            Keep pane open
          </button>
          <button
            type="button"
            onClick={() => void handleConfirm()}
            disabled={busy}
            className="inline-flex items-center justify-center gap-2 rounded-md border border-danger/50 bg-danger-dim px-3 py-2 text-sm font-semibold text-danger hover:bg-danger/20 disabled:opacity-60"
          >
            {busy ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <FolderX className="size-3.5" />
            )}
            {busy ? "Destroying…" : "Destroy worktree & close"}
          </button>
        </footer>
      </div>
    </div>
  );
}
