import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  ArrowRightLeft,
  Cable,
  Check,
  ChevronRight,
  Copy,
  GitBranch,
  Maximize2,
  Minimize2,
  Pencil,
  Pin,
  PinOff,
  X,
} from "lucide-react";
import type { Pane, Workspace } from "./types";

type Props = {
  pane: Pane;
  workspaces: Workspace[];
  zoomed?: boolean;
  onRename: (id: string, name: string) => void;
  onMaximize: (id: string) => void;
  onTogglePin: (id: string) => void;
  onMoveToWorkspace: (paneId: string, workspaceId: string) => void;
  onRequestClose: (id: string) => void;
  onCopied: (label: string) => void;
  onOpenMcp?: (paneId: string) => void;
};

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function PaneMenu({
  pane,
  workspaces,
  zoomed,
  onRename,
  onMaximize,
  onTogglePin,
  onMoveToWorkspace,
  onRequestClose,
  onCopied,
  onOpenMcp,
}: Props) {
  const [open, setOpen] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [nameDraft, setNameDraft] = useState(pane.name);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false);
        setMoveOpen(false);
        setRenaming(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        setMoveOpen(false);
        setRenaming(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useEffect(() => {
    if (renaming) {
      setNameDraft(pane.name);
      requestAnimationFrame(() => inputRef.current?.select());
    }
  }, [renaming, pane.name]);

  const otherWs = workspaces.filter((w) => w.id !== pane.workspaceId);
  const mcpCount = pane.mcpServerIds?.length ?? pane.mcpToolNames?.length ?? 0;

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-label="Pane menu"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
          setMoveOpen(false);
          setRenaming(false);
        }}
        className="rounded p-0.5 text-subtle hover:bg-panel hover:text-fg"
      >
        <span className="flex size-4 items-center justify-center font-mono text-[12px] leading-none">
          ⋮
        </span>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-40 mt-1 min-w-[210px] rounded-md border border-border bg-elevated py-1 shadow-panel"
          onClick={(e) => e.stopPropagation()}
        >
          {renaming ? (
            <form
              className="flex items-center gap-1 border-b border-border px-2 py-1.5"
              onSubmit={(e) => {
                e.preventDefault();
                const next = nameDraft.trim();
                if (next) onRename(pane.id, next);
                setRenaming(false);
                setOpen(false);
              }}
            >
              <input
                ref={inputRef}
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                className="min-w-0 flex-1 rounded-sm border border-border bg-surface px-2 py-1 font-mono text-[11px] text-fg focus:border-accent focus:outline-none"
              />
              <button type="submit" className="rounded p-1 text-accent" aria-label="Save">
                <Check className="size-3.5" />
              </button>
            </form>
          ) : (
            <MenuItem
              icon={<Pencil className="size-3.5" />}
              label="Rename"
              onClick={() => setRenaming(true)}
            />
          )}

          <MenuItem
            icon={pane.pinned ? <PinOff className="size-3.5" /> : <Pin className="size-3.5" />}
            label={pane.pinned ? "Unpin" : "Pin left"}
            onClick={() => {
              onTogglePin(pane.id);
              setOpen(false);
            }}
          />

          <MenuItem
            icon={
              zoomed ? <Minimize2 className="size-3.5" /> : <Maximize2 className="size-3.5" />
            }
            label={zoomed ? "Restore" : "Maximize"}
            onClick={() => {
              onMaximize(pane.id);
              setOpen(false);
            }}
          />

          <div className="my-1 h-px bg-border" />

          {onOpenMcp && (
            <MenuItem
              icon={<Cable className="size-3.5" />}
              label="MCP tools"
              hint={mcpCount ? `${pane.mcpServerIds?.length ?? "?"} srv` : "view"}
              onClick={() => {
                onOpenMcp(pane.id);
                setOpen(false);
              }}
            />
          )}

          <MenuItem
            icon={<Copy className="size-3.5" />}
            label="Copy id"
            hint={pane.id.slice(0, 12)}
            onClick={async () => {
              if (await copyText(pane.id)) onCopied("Pane id copied");
              setOpen(false);
            }}
          />
          <MenuItem
            icon={<GitBranch className="size-3.5" />}
            label="Copy branch"
            hint={pane.branch}
            onClick={async () => {
              if (await copyText(pane.branch)) onCopied("Branch copied");
              setOpen(false);
            }}
          />

          <div className="relative">
            <button
              type="button"
              role="menuitem"
              disabled={otherWs.length === 0}
              onClick={() => setMoveOpen((v) => !v)}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[12px] text-fg hover:bg-panel disabled:opacity-40"
            >
              <ArrowRightLeft className="size-3.5 text-accent" />
              <span className="flex-1">Move to workspace</span>
              <ChevronRight className="size-3.5 text-subtle" />
            </button>
            {moveOpen && otherWs.length > 0 && (
              <div
                role="menu"
                className="absolute left-0 top-full z-50 mt-0.5 max-h-48 min-w-[180px] overflow-y-auto rounded-md border border-border bg-elevated py-1 shadow-panel sm:left-full sm:top-0 sm:mt-0 sm:ml-0.5"
              >
                {otherWs.map((ws) => (
                  <button
                    key={ws.id}
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      onMoveToWorkspace(pane.id, ws.id);
                      setOpen(false);
                      setMoveOpen(false);
                    }}
                    className="flex w-full flex-col px-3 py-1.5 text-left hover:bg-panel"
                  >
                    <span className="font-mono text-[12px] text-fg">
                      {ws.parentId ? `↳ ${ws.name}` : ws.name}
                    </span>
                    <span className="truncate font-mono text-[9px] text-subtle">{ws.path}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="my-1 h-px bg-border" />

          <MenuItem
            icon={<X className="size-3.5" />}
            label="Close"
            danger
            onClick={() => {
              onRequestClose(pane.id);
              setOpen(false);
            }}
          />
        </div>
      )}
    </div>
  );
}

function MenuItem({
  icon,
  label,
  hint,
  danger,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  hint?: string;
  danger?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-[12px] hover:bg-panel ${
        danger ? "text-danger" : "text-fg"
      }`}
    >
      <span className={danger ? "text-danger" : "text-accent"}>{icon}</span>
      <span className="flex-1">{label}</span>
      {hint && (
        <span className="max-w-[80px] truncate font-mono text-[9px] text-subtle">{hint}</span>
      )}
    </button>
  );
}
