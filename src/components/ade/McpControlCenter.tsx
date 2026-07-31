/**
 * MCP Control Center — single config location for all harnesses.
 * Registry · bindings matrix · presets · export pack
 */
import { useMemo, useState } from "react";
import {
  Cable,
  Check,
  ClipboardCopy,
  Download,
  Plus,
  RefreshCw,
  Server,
  Settings2,
  Trash2,
  X,
} from "lucide-react";
import { HARNESS_REGISTRY, type HarnessId } from "./harnesses";
import {
  createDefaultMcpConfig,
  exportMcpPack,
  loadMcpConfig,
  resolveBindingServers,
  saveMcpConfig,
  statusLabel,
  type BindMode,
  type HarnessMcpBinding,
  type McpConfigState,
  type McpPreset,
  type McpServer,
  type McpServerStatus,
  type McpTransport,
} from "./mcpConfig";

type McpTab = "servers" | "bindings" | "presets" | "export";

const STATUS_STYLE: Record<McpServerStatus, string> = {
  connected: "border-success/40 bg-success-dim text-success",
  degraded: "border-need/40 bg-need-dim text-need",
  missing: "border-danger/40 bg-danger-dim text-danger",
  disabled: "border-border bg-elevated text-subtle",
  unknown: "border-border bg-elevated text-muted",
};

const inputClass =
  "w-full rounded-sm border border-border bg-elevated px-2 py-1.5 font-mono text-[11px] text-fg focus:border-accent focus:outline-none";

function StatusChip({ status }: { status: McpServerStatus }) {
  return (
    <span
      className={`inline-flex rounded-sm border px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase ${STATUS_STYLE[status]}`}
    >
      {statusLabel(status)}
    </span>
  );
}

export function McpControlCenter({
  onClose,
  onToast,
}: {
  onClose: () => void;
  onToast: (m: string) => void;
}) {
  const [cfg, setCfg] = useState<McpConfigState>(() => loadMcpConfig());
  const [tab, setTab] = useState<McpTab>("servers");
  const [selectedServerId, setSelectedServerId] = useState<string | null>(
    () => loadMcpConfig().servers[0]?.id ?? null,
  );
  const [selectedHarness, setSelectedHarness] = useState<HarnessId>("claude-code");

  const persist = (next: McpConfigState) => {
    setCfg(next);
    saveMcpConfig(next);
  };

  const selected = cfg.servers.find((s) => s.id === selectedServerId) ?? null;
  const binding = cfg.bindings.find((b) => b.harnessId === selectedHarness);
  const effective = useMemo(
    () => resolveBindingServers(cfg, selectedHarness),
    [cfg, selectedHarness],
  );

  const connectedCount = cfg.servers.filter((s) => s.enabled && s.status === "connected").length;
  const issueCount = cfg.servers.filter(
    (s) => s.enabled && (s.status === "degraded" || s.status === "missing"),
  ).length;

  const updateServer = (id: string, patch: Partial<McpServer>) => {
    persist({
      ...cfg,
      servers: cfg.servers.map((s) => (s.id === id ? { ...s, ...patch } : s)),
    });
  };

  const updateBinding = (harnessId: HarnessId, patch: Partial<HarnessMcpBinding>) => {
    persist({
      ...cfg,
      bindings: cfg.bindings.map((b) => (b.harnessId === harnessId ? { ...b, ...patch } : b)),
    });
  };

  const toggleServerOnHarness = (harnessId: HarnessId, serverId: string) => {
    const b = cfg.bindings.find((x) => x.harnessId === harnessId);
    if (!b) return;
    let ids: string[];
    if (b.mode === "custom") {
      ids = [...b.serverIds];
    } else {
      ids = resolveBindingServers(cfg, harnessId).map((s) => s.id);
    }
    if (ids.includes(serverId)) ids = ids.filter((x) => x !== serverId);
    else ids = [...ids, serverId];
    updateBinding(harnessId, { mode: "custom", serverIds: ids });
  };

  const addServer = () => {
    const id = `mcp-custom-${Date.now().toString(36)}`;
    const server: McpServer = {
      id,
      name: "custom-server",
      summary: "New MCP server — edit endpoint before spawn",
      transport: "stdio",
      endpoint: "npx",
      args: ["-y", "your-mcp-package"],
      tools: [],
      status: "unknown",
      scope: "project",
      enabled: true,
    };
    persist({ ...cfg, servers: [...cfg.servers, server] });
    setSelectedServerId(id);
    onToast("Added custom MCP server");
  };

  const removeServer = (id: string) => {
    const nextServers = cfg.servers.filter((s) => s.id !== id);
    persist({
      ...cfg,
      servers: nextServers,
      presets: cfg.presets.map((p) => ({
        ...p,
        serverIds: p.serverIds.filter((x) => x !== id),
      })),
      bindings: cfg.bindings.map((b) => ({
        ...b,
        serverIds: b.serverIds.filter((x) => x !== id),
      })),
    });
    if (selectedServerId === id) setSelectedServerId(nextServers[0]?.id ?? null);
    onToast("Removed server from registry");
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex justify-end bg-bg/50"
      onClick={onClose}
      role="dialog"
      aria-modal
      aria-label="MCP Control Center"
    >
      <div
        className="flex h-full w-full max-w-3xl flex-col border-l border-border bg-surface shadow-panel"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex shrink-0 items-start gap-3 border-b border-border px-4 py-3">
          <div className="flex size-8 items-center justify-center rounded-md border border-accent/40 bg-accent-dim">
            <Cable className="size-4 text-accent" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="font-mono text-sm font-semibold text-fg">MCP Control Center</h2>
            <p className="text-[11px] text-muted">
              Single config for all harnesses · local store · spawn inject
            </p>
            <div className="mt-1.5 flex flex-wrap gap-2 font-mono text-[10px]">
              <span className="text-success">{connectedCount} connected</span>
              {issueCount > 0 && <span className="text-need">{issueCount} issue(s)</span>}
              <span className="text-subtle">{cfg.servers.length} servers</span>
              <span className="text-subtle">{HARNESS_REGISTRY.length} harnesses</span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-muted hover:text-fg"
            aria-label="Close"
          >
            <X className="size-4" />
          </button>
        </header>

        <div className="flex shrink-0 gap-1 overflow-x-auto border-b border-border px-3 py-1.5">
          {(
            [
              ["servers", "Servers", Server],
              ["bindings", "Harness matrix", Settings2],
              ["presets", "Presets", Check],
              ["export", "Export", Download],
            ] as const
          ).map(([id, label, Icon]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`inline-flex shrink-0 items-center gap-1 rounded-sm border px-2.5 py-1 font-mono text-[10px] ${
                tab === id
                  ? "border-accent bg-accent-dim text-accent"
                  : "border-border text-muted hover:text-fg"
              }`}
            >
              <Icon className="size-3" />
              {label}
            </button>
          ))}
        </div>

        <div className="min-h-0 flex-1 overflow-hidden">
          {tab === "servers" && (
            <div className="flex h-full min-h-0 flex-col sm:flex-row">
              <div className="flex max-h-48 w-full shrink-0 flex-col border-b border-border sm:max-h-none sm:w-56 sm:border-b-0 sm:border-r">
                <div className="flex items-center justify-between border-b border-border px-2 py-1.5">
                  <span className="label-caps">Registry</span>
                  <button
                    type="button"
                    onClick={addServer}
                    className="rounded p-1 text-accent hover:bg-accent-dim"
                    title="Add server"
                  >
                    <Plus className="size-3.5" />
                  </button>
                </div>
                <ul className="min-h-0 flex-1 overflow-y-auto p-1">
                  {cfg.servers.map((s) => (
                    <li key={s.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedServerId(s.id)}
                        className={`flex w-full flex-col gap-0.5 rounded-md px-2 py-2 text-left ${
                          selectedServerId === s.id
                            ? "bg-accent-dim/40"
                            : "hover:bg-elevated"
                        }`}
                      >
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`size-1.5 shrink-0 rounded-full ${
                              !s.enabled
                                ? "bg-subtle"
                                : s.status === "connected"
                                  ? "bg-success"
                                  : s.status === "degraded"
                                    ? "bg-need"
                                    : s.status === "missing"
                                      ? "bg-danger"
                                      : "bg-subtle"
                            }`}
                          />
                          <span className="truncate font-mono text-[11px] font-semibold text-fg">
                            {s.name}
                          </span>
                        </div>
                        <span className="pl-3 font-mono text-[9px] text-subtle">
                          {s.scope} · {s.transport}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto p-4">
                {!selected ? (
                  <p className="text-sm text-muted">Select a server</p>
                ) : (
                  <ServerEditor
                    server={selected}
                    onChange={(patch) => updateServer(selected.id, patch)}
                    onRemove={() => removeServer(selected.id)}
                    onProbe={() => {
                      if (!selected.enabled) {
                        onToast("Enable server before probe");
                        return;
                      }
                      onToast(
                        selected.status === "missing"
                          ? `Probe: ${selected.endpoint} not found (honest)`
                          : `Probe: ${selected.name} → ${statusLabel(selected.status)}`,
                      );
                    }}
                  />
                )}
              </div>
            </div>
          )}

          {tab === "bindings" && (
            <div className="flex h-full min-h-0 flex-col overflow-hidden">
              <div className="shrink-0 border-b border-border px-4 py-2">
                <p className="font-mono text-[11px] text-muted">
                  Click cells to toggle (switches binding to{" "}
                  <span className="text-accent">custom</span>). Select a row for mode / preset.
                </p>
              </div>
              <div className="min-h-0 flex-1 overflow-auto p-3">
                <BindingsMatrix
                  cfg={cfg}
                  onToggle={toggleServerOnHarness}
                  onSelectHarness={setSelectedHarness}
                  selectedHarness={selectedHarness}
                />
              </div>
              <div className="shrink-0 border-t border-border bg-elevated/40 p-3">
                <HarnessBindingDetail
                  harnessId={selectedHarness}
                  binding={binding}
                  presets={cfg.presets}
                  effective={effective}
                  defaultPresetId={cfg.defaultPresetId}
                  onMode={(mode) => updateBinding(selectedHarness, { mode })}
                  onPreset={(presetId) =>
                    updateBinding(selectedHarness, { mode: "preset", presetId })
                  }
                />
              </div>
            </div>
          )}

          {tab === "presets" && (
            <div className="h-full overflow-y-auto p-4">
              <p className="mb-3 font-mono text-[11px] text-muted">
                Default spawn preset:{" "}
                <span className="text-accent">
                  {cfg.presets.find((p) => p.id === cfg.defaultPresetId)?.name}
                </span>
              </p>
              <ul className="space-y-2">
                {cfg.presets.map((p) => (
                  <PresetCard
                    key={p.id}
                    preset={p}
                    servers={cfg.servers}
                    isDefault={cfg.defaultPresetId === p.id}
                    onSetDefault={() => {
                      persist({ ...cfg, defaultPresetId: p.id });
                      onToast(`Default preset → ${p.name}`);
                    }}
                    onToggleServer={(serverId) => {
                      const ids = p.serverIds.includes(serverId)
                        ? p.serverIds.filter((x) => x !== serverId)
                        : [...p.serverIds, serverId];
                      persist({
                        ...cfg,
                        presets: cfg.presets.map((x) =>
                          x.id === p.id ? { ...x, serverIds: ids } : x,
                        ),
                      });
                    }}
                  />
                ))}
              </ul>
            </div>
          )}

          {tab === "export" && (
            <ExportPanel
              cfg={cfg}
              onToast={onToast}
              onImport={(next) => {
                persist(next);
                setSelectedServerId(next.servers[0]?.id ?? null);
                onToast("Imported MCP pack");
              }}
              onReset={() => {
                const d = createDefaultMcpConfig();
                persist(d);
                setSelectedServerId(d.servers[0]?.id ?? null);
                onToast("Reset to ADE defaults");
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function ServerEditor({
  server,
  onChange,
  onRemove,
  onProbe,
}: {
  server: McpServer;
  onChange: (patch: Partial<McpServer>) => void;
  onRemove: () => void;
  onProbe: () => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-mono text-base font-semibold text-fg">{server.name}</h3>
        <StatusChip status={server.enabled ? server.status : "disabled"} />
        <span className="label-caps">{server.scope}</span>
      </div>
      <p className="text-xs text-muted">{server.summary}</p>

      <label className="flex items-center gap-2 font-mono text-[11px] text-fg">
        <input
          type="checkbox"
          checked={server.enabled}
          onChange={(e) =>
            onChange({
              enabled: e.target.checked,
              status: e.target.checked
                ? server.status === "disabled"
                  ? "unknown"
                  : server.status
                : "disabled",
            })
          }
        />
        Enabled for spawn inject
      </label>

      <label className="block">
        <span className="label-caps mb-1 block">Name</span>
        <input
          value={server.name}
          onChange={(e) => onChange({ name: e.target.value })}
          className={inputClass}
        />
      </label>
      <label className="block">
        <span className="label-caps mb-1 block">Summary</span>
        <input
          value={server.summary}
          onChange={(e) => onChange({ summary: e.target.value })}
          className={inputClass}
        />
      </label>
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="block">
          <span className="label-caps mb-1 block">Transport</span>
          <select
            value={server.transport}
            onChange={(e) => onChange({ transport: e.target.value as McpTransport })}
            className={inputClass}
          >
            <option value="stdio">stdio</option>
            <option value="sse">sse</option>
            <option value="http">http</option>
          </select>
        </label>
        <label className="block">
          <span className="label-caps mb-1 block">Scope</span>
          <select
            value={server.scope}
            onChange={(e) =>
              onChange({ scope: e.target.value as "global" | "project" })
            }
            className={inputClass}
          >
            <option value="global">global</option>
            <option value="project">project</option>
          </select>
        </label>
      </div>
      <label className="block">
        <span className="label-caps mb-1 block">
          {server.transport === "stdio" ? "Command" : "URL"}
        </span>
        <input
          value={server.endpoint}
          onChange={(e) => onChange({ endpoint: e.target.value })}
          className={inputClass}
        />
      </label>
      {server.transport === "stdio" && (
        <label className="block">
          <span className="label-caps mb-1 block">Args (space-separated)</span>
          <input
            value={(server.args ?? []).join(" ")}
            onChange={(e) =>
              onChange({ args: e.target.value.split(/\s+/).filter(Boolean) })
            }
            className={inputClass}
          />
        </label>
      )}
      <label className="block">
        <span className="label-caps mb-1 block">Env keys (no secrets stored)</span>
        <input
          value={(server.envKeys ?? []).join(", ")}
          onChange={(e) =>
            onChange({
              envKeys: e.target.value
                .split(",")
                .map((x) => x.trim())
                .filter(Boolean),
            })
          }
          className={inputClass}
          placeholder="GITHUB_TOKEN, MCP_FS_ROOT"
        />
      </label>
      <label className="block">
        <span className="label-caps mb-1 block">Tools (comma-separated)</span>
        <input
          value={server.tools.join(", ")}
          onChange={(e) =>
            onChange({
              tools: e.target.value
                .split(",")
                .map((x) => x.trim())
                .filter(Boolean),
            })
          }
          className={inputClass}
        />
      </label>

      <div className="flex flex-wrap gap-2 pt-1">
        <button
          type="button"
          onClick={onProbe}
          className="inline-flex items-center gap-1 rounded-sm border border-border px-2 py-1.5 font-mono text-[10px] text-muted hover:text-fg"
        >
          <RefreshCw className="size-3" /> Probe status
        </button>
        <button
          type="button"
          onClick={onRemove}
          className="inline-flex items-center gap-1 rounded-sm border border-danger/40 px-2 py-1.5 font-mono text-[10px] text-danger"
        >
          <Trash2 className="size-3" /> Remove
        </button>
      </div>

      {server.tools.length > 0 && (
        <div>
          <p className="label-caps mb-1.5">Tool surface</p>
          <div className="flex flex-wrap gap-1">
            {server.tools.map((t) => (
              <span
                key={t}
                className="rounded-sm border border-border bg-elevated px-1.5 py-0.5 font-mono text-[10px] text-muted"
              >
                {t}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function BindingsMatrix({
  cfg,
  onToggle,
  onSelectHarness,
  selectedHarness,
}: {
  cfg: McpConfigState;
  onToggle: (harnessId: HarnessId, serverId: string) => void;
  onSelectHarness: (id: HarnessId) => void;
  selectedHarness: HarnessId;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] border-collapse font-mono text-[10px]">
        <thead>
          <tr className="border-b border-border text-left text-subtle">
            <th className="sticky left-0 z-10 bg-surface py-2 pr-3">Harness</th>
            {cfg.servers.map((s) => (
              <th key={s.id} className="px-1 py-2 text-center" title={s.summary}>
                <div className="mx-auto max-w-[4.5rem] truncate">{s.name}</div>
              </th>
            ))}
            <th className="py-2 pl-2">Mode</th>
          </tr>
        </thead>
        <tbody>
          {HARNESS_REGISTRY.map((h) => {
            const bound = new Set(resolveBindingServers(cfg, h.id).map((s) => s.id));
            const b = cfg.bindings.find((x) => x.harnessId === h.id);
            const sel = selectedHarness === h.id;
            return (
              <tr
                key={h.id}
                className={`border-b border-border/50 ${sel ? "bg-accent-dim/20" : ""}`}
              >
                <td className="sticky left-0 z-10 bg-surface py-1.5 pr-3">
                  <button
                    type="button"
                    onClick={() => onSelectHarness(h.id)}
                    className="text-left font-semibold text-fg hover:text-accent"
                  >
                    {h.label}
                  </button>
                  {h.telemetry === "limited" && (
                    <div className="text-[8px] text-need">limited telemetry</div>
                  )}
                </td>
                {cfg.servers.map((s) => {
                  const on = bound.has(s.id);
                  const blocked = !s.enabled;
                  return (
                    <td key={s.id} className="px-1 py-1 text-center">
                      <button
                        type="button"
                        disabled={blocked}
                        onClick={() => onToggle(h.id, s.id)}
                        title={
                          blocked
                            ? "Server disabled"
                            : on
                              ? `Unbind ${s.name}`
                              : `Bind ${s.name}`
                        }
                        className={`inline-flex size-6 items-center justify-center rounded-sm border ${
                          on
                            ? "border-accent/50 bg-accent-dim text-accent"
                            : "border-border text-subtle"
                        } disabled:opacity-30`}
                      >
                        {on ? <Check className="size-3" /> : null}
                      </button>
                    </td>
                  );
                })}
                <td className="py-1.5 pl-2 text-subtle">{b?.mode ?? "preset"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function HarnessBindingDetail({
  harnessId,
  binding,
  presets,
  effective,
  defaultPresetId,
  onMode,
  onPreset,
}: {
  harnessId: HarnessId;
  binding?: HarnessMcpBinding;
  presets: McpPreset[];
  effective: McpServer[];
  defaultPresetId: string;
  onMode: (m: BindMode) => void;
  onPreset: (id: string) => void;
}) {
  const h = HARNESS_REGISTRY.find((x) => x.id === harnessId);
  return (
    <div>
      <div className="mb-2 font-mono text-xs font-semibold text-fg">
        {h?.label ?? harnessId}{" "}
        <span className="font-normal text-subtle">· effective MCP at spawn</span>
      </div>
      <div className="mb-2 flex flex-wrap gap-1">
        {(["inherit", "preset", "custom"] as BindMode[]).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => onMode(m)}
            className={`rounded-sm border px-2 py-0.5 font-mono text-[10px] ${
              (binding?.mode ?? "preset") === m
                ? "border-accent bg-accent-dim text-accent"
                : "border-border text-muted"
            }`}
          >
            {m}
            {m === "inherit"
              ? ` (${presets.find((p) => p.id === defaultPresetId)?.name})`
              : ""}
          </button>
        ))}
      </div>
      {(binding?.mode ?? "preset") === "preset" && (
        <div className="mb-2 flex flex-wrap gap-1">
          {presets.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => onPreset(p.id)}
              className={`rounded-sm border px-2 py-0.5 font-mono text-[10px] ${
                binding?.presetId === p.id
                  ? "border-accent/60 text-accent"
                  : "border-border text-muted"
              }`}
            >
              {p.name}
            </button>
          ))}
        </div>
      )}
      <div className="flex flex-wrap gap-1">
        {effective.length === 0 ? (
          <span className="font-mono text-[10px] text-subtle">No MCP servers bound</span>
        ) : (
          effective.map((s) => (
            <span
              key={s.id}
              className="inline-flex items-center gap-1 rounded-sm border border-border bg-surface px-1.5 py-0.5 font-mono text-[10px] text-muted"
            >
              {s.name}
              <StatusChip status={s.status} />
            </span>
          ))
        )}
      </div>
    </div>
  );
}

function PresetCard({
  preset,
  servers,
  isDefault,
  onSetDefault,
  onToggleServer,
}: {
  preset: McpPreset;
  servers: McpServer[];
  isDefault: boolean;
  onSetDefault: () => void;
  onToggleServer: (id: string) => void;
}) {
  return (
    <li className="rounded-md border border-border bg-elevated p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-xs font-semibold text-fg">{preset.name}</span>
        {isDefault && (
          <span className="rounded-sm border border-accent/40 bg-accent-dim px-1.5 py-0.5 font-mono text-[9px] text-accent">
            default
          </span>
        )}
        {!isDefault && (
          <button
            type="button"
            onClick={onSetDefault}
            className="font-mono text-[10px] text-muted hover:text-accent"
          >
            Set default
          </button>
        )}
      </div>
      <p className="mt-1 text-[11px] text-muted">{preset.summary}</p>
      <div className="mt-2 flex flex-wrap gap-1">
        {servers.map((s) => {
          const on = preset.serverIds.includes(s.id);
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => onToggleServer(s.id)}
              className={`rounded-sm border px-2 py-0.5 font-mono text-[10px] ${
                on
                  ? "border-accent/40 bg-accent-dim text-accent"
                  : "border-border text-subtle"
              }`}
            >
              {s.name}
            </button>
          );
        })}
      </div>
    </li>
  );
}

function ExportPanel({
  cfg,
  onToast,
  onImport,
  onReset,
}: {
  cfg: McpConfigState;
  onToast: (m: string) => void;
  onImport: (s: McpConfigState) => void;
  onReset: () => void;
}) {
  const pack = useMemo(() => exportMcpPack(cfg), [cfg]);
  const [importText, setImportText] = useState("");

  return (
    <div className="h-full overflow-y-auto p-4">
      <p className="mb-2 font-mono text-[11px] text-muted">
        Format <code className="text-accent">ade-mcp-pack/v1</code> — servers, presets, harness
        bindings. Secrets never included (env keys only).
      </p>
      <pre className="max-h-[40dvh] overflow-auto rounded-md border border-border bg-bg p-3 font-mono text-[10px] leading-relaxed text-muted">
        {pack}
      </pre>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(pack);
              onToast("MCP pack copied");
            } catch {
              onToast("Copy failed");
            }
          }}
          className="inline-flex items-center gap-1 rounded-md bg-accent px-3 py-1.5 font-mono text-[11px] font-semibold text-accent-fg"
        >
          <ClipboardCopy className="size-3.5" /> Copy pack JSON
        </button>
        <button
          type="button"
          onClick={onReset}
          className="rounded-md border border-border px-3 py-1.5 font-mono text-[11px] text-muted"
        >
          Reset defaults
        </button>
      </div>

      <div className="mt-6">
        <p className="label-caps mb-1">Import pack</p>
        <textarea
          value={importText}
          onChange={(e) => setImportText(e.target.value)}
          rows={5}
          placeholder="Paste ade-mcp-pack/v1 JSON…"
          className="w-full rounded-md border border-border bg-elevated px-3 py-2 font-mono text-[10px] text-fg focus:border-accent focus:outline-none"
        />
        <button
          type="button"
          onClick={() => {
            try {
              const parsed = JSON.parse(importText) as {
                servers?: McpServer[];
                presets?: McpPreset[];
                bindings?: HarnessMcpBinding[];
                defaultPresetId?: string;
              };
              if (!parsed.servers?.length) throw new Error("no servers");
              const base = createDefaultMcpConfig();
              onImport({
                version: 1,
                servers: parsed.servers.map((s) => ({
                  id: s.id,
                  name: s.name,
                  summary: s.summary ?? s.name,
                  transport: s.transport ?? "stdio",
                  endpoint: s.endpoint ?? "",
                  args: s.args,
                  envKeys: s.envKeys,
                  tools: s.tools ?? [],
                  status: s.status ?? "unknown",
                  scope: s.scope ?? "project",
                  enabled: s.enabled ?? true,
                })),
                presets: parsed.presets?.length ? parsed.presets : base.presets,
                bindings: parsed.bindings?.length ? parsed.bindings : base.bindings,
                defaultPresetId: parsed.defaultPresetId ?? base.defaultPresetId,
              });
              setImportText("");
            } catch {
              onToast("Invalid MCP pack JSON");
            }
          }}
          className="mt-2 rounded-sm border border-accent/40 bg-accent-dim px-3 py-1.5 font-mono text-[11px] text-accent"
        >
          Import
        </button>
      </div>
    </div>
  );
}
