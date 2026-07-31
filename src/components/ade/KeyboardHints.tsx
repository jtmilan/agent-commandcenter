import { Keyboard, X } from "lucide-react";
import { KEYBOARD_MAP, type KeyHintStatus } from "./harnesses";

const statusStyle: Record<KeyHintStatus, string> = {
  exists: "border-success/40 bg-success-dim text-success",
  proposed: "border-need/40 bg-need-dim text-need",
  mock: "border-info/40 bg-info-dim text-info",
};

export function KeyboardHintsPanel({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-bg/70 p-3 sm:items-center"
      role="dialog"
      aria-label="Keyboard shortcuts"
      onClick={onClose}
    >
      <div
        className="max-h-[min(85dvh,560px)] w-full max-w-lg overflow-hidden rounded-xl border border-border bg-surface shadow-panel"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <Keyboard className="size-4 text-accent" aria-hidden />
            <div>
              <h2 className="font-mono text-sm font-semibold text-fg">Keyboard map</h2>
              <p className="text-[11px] text-muted">
                EXISTS · PROPOSED · MOCK — no fake palette-only rows
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-muted hover:bg-elevated hover:text-fg"
            aria-label="Close"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="overflow-y-auto p-3">
          <ul className="space-y-1.5">
            {KEYBOARD_MAP.map((row) => (
              <li
                key={row.keys + row.action}
                className="flex flex-col gap-1 rounded-md border border-border bg-elevated px-3 py-2 sm:flex-row sm:items-start sm:justify-between"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <kbd className="rounded border border-border bg-surface px-1.5 py-0.5 font-mono text-[11px] text-fg">
                      {row.keys}
                    </kbd>
                    <span
                      className={`rounded-sm border px-1 py-0.5 font-mono text-[9px] uppercase tracking-wide ${statusStyle[row.status]}`}
                    >
                      {row.status}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-fg">{row.action}</p>
                  {row.note && (
                    <p className="mt-0.5 text-[11px] text-muted">{row.note}</p>
                  )}
                </div>
              </li>
            ))}
          </ul>

          <p className="mt-3 font-mono text-[10px] leading-relaxed text-subtle">
            Real app today only ships ⌘⇧I + ⌘G (mac meta only). Design Brief mentions Alt+↑/↓
            workspace cycle and ⌘K palette — both still proposed (V-S9). Every palette row must
            map to a real handler.
          </p>
        </div>
      </div>
    </div>
  );
}
