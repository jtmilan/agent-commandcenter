/**
 * Admin console — same ADE chrome, admin persona surface.
 * Maps to ade-api /v1/admin/* (users, coupons, campaigns, credits, events).
 */
import { useMemo, useState } from "react";
import { Activity, Gift, Megaphone, Plus, Shield, Users, Wallet } from "lucide-react";

type AdminTab = "overview" | "users" | "coupons" | "campaigns" | "credits" | "events";

interface AdminUser {
  id: string;
  email: string;
  role: string;
  planId: string;
  status: string;
  credits: { tokenBalance: number; handoffBalance: number };
}

const SEED_USERS: AdminUser[] = [
  { id: "user_admin", email: "admin@ade.local", role: "admin", planId: "team", status: "active", credits: { tokenBalance: 50_000_000, handoffBalance: 2000 } },
  { id: "user_demo", email: "jeffry@example.com", role: "operator", planId: "pro", status: "active", credits: { tokenBalance: 8_760_000, handoffBalance: 188 } },
  { id: "user_viewer", email: "viewer@ade.local", role: "viewer", planId: "free", status: "none", credits: { tokenBalance: 500_000, handoffBalance: 5 } },
];

const SEED_COUPONS = [
  { code: "LAUNCH50", label: "50% off + 20 handoffs", active: true, redemptions: 12, maxRedemptions: 1000, percentOff: 50, bonusHandoffs: 20 },
  { code: "TRIAL14", label: "14-day Pro trial", active: true, redemptions: 40, maxRedemptions: 5000, bonusHandoffs: 10 },
  { code: "WELCOME", label: "Welcome credits", active: true, redemptions: 200, maxRedemptions: 100_000, bonusHandoffs: 5 },
];

const SEED_CAMPAIGNS = [
  { id: "camp_august_launch", title: "Launch week: invite a teammate", body: "Both get handoff credits after wizard.", placement: "billing_banner", active: true, segment: "all" },
  { id: "camp_upgrade_soft", title: "Need more panes?", body: "Pro unlocks 24 panes + MCP pack.", placement: "soft_gate", active: true, segment: "free" },
];

export function AdminConsole({ onToast }: { onToast: (m: string) => void }) {
  const [tab, setTab] = useState<AdminTab>("overview");
  const [users, setUsers] = useState(SEED_USERS);
  const [coupons, setCoupons] = useState(SEED_COUPONS);
  const [campaigns, setCampaigns] = useState(SEED_CAMPAIGNS);
  const [newCode, setNewCode] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [grantUserId, setGrantUserId] = useState("user_demo");
  const [grantAmount, setGrantAmount] = useState(10);

  const overview = useMemo(() => {
    const byPlan: Record<string, number> = {};
    const byRole: Record<string, number> = {};
    for (const u of users) {
      byPlan[u.planId] = (byPlan[u.planId] ?? 0) + 1;
      byRole[u.role] = (byRole[u.role] ?? 0) + 1;
    }
    return { users: users.length, byPlan, byRole, coupons: coupons.length, campaigns: campaigns.length };
  }, [users, coupons, campaigns]);

  const tabs: { id: AdminTab; label: string; icon: typeof Users }[] = [
    { id: "overview", label: "Overview", icon: Activity },
    { id: "users", label: "Users", icon: Users },
    { id: "coupons", label: "Coupons", icon: Gift },
    { id: "campaigns", label: "Campaigns", icon: Megaphone },
    { id: "credits", label: "Credits", icon: Wallet },
    { id: "events", label: "Events", icon: Shield },
  ];

  return (
    <div className="flex h-full min-h-0 flex-col bg-bg">
      <header className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
        <Shield className="size-4 text-accent" />
        <div>
          <p className="font-mono text-xs font-semibold text-fg">Admin console</p>
          <p className="font-mono text-[10px] text-subtle">Same ADE shell · persona admin · ade-api /v1/admin/*</p>
        </div>
      </header>

      <div className="flex gap-1 overflow-x-auto border-b border-border px-2 py-1">
        {tabs.map((t) => (
          <button key={t.id} type="button" onClick={() => setTab(t.id)}
            className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 font-mono text-[11px] ${
              tab === t.id ? "bg-panel font-semibold text-fg" : "text-muted hover:bg-elevated hover:text-fg"
            }`}>
            <t.icon className="size-3" />{t.label}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {tab === "overview" && (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Stat label="Users" value={String(overview.users)} />
            <Stat label="Coupons" value={String(overview.coupons)} />
            <Stat label="Campaigns" value={String(overview.campaigns)} />
            <Stat label="By plan" value={Object.entries(overview.byPlan).map(([k, v]) => `${k}:${v}`).join(" · ")} />
            <Stat label="By role" value={Object.entries(overview.byRole).map(([k, v]) => `${k}:${v}`).join(" · ")} />
            <Stat label="API" value="GET /v1/admin/overview" />
          </div>
        )}

        {tab === "users" && (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full min-w-[520px] text-left font-mono text-[11px]">
              <thead className="border-b border-border bg-elevated text-subtle">
                <tr>
                  <th className="px-3 py-2">Email</th>
                  <th className="px-3 py-2">Role</th>
                  <th className="px-3 py-2">Plan</th>
                  <th className="px-3 py-2">Handoffs</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-b border-border/60">
                    <td className="px-3 py-2 text-fg">{u.email}</td>
                    <td className="px-3 py-2">
                      <select value={u.role} onChange={(e) => {
                        setUsers((list) => list.map((x) => x.id === u.id ? { ...x, role: e.target.value } : x));
                        onToast(`Mock PATCH /v1/admin/users/${u.id} role=${e.target.value}`);
                      }} className="rounded border border-border bg-bg px-1 py-0.5 text-fg">
                        <option value="admin">admin</option>
                        <option value="operator">operator</option>
                        <option value="viewer">viewer</option>
                      </select>
                    </td>
                    <td className="px-3 py-2 text-muted">{u.planId}</td>
                    <td className="px-3 py-2 text-muted">{u.credits.handoffBalance}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === "coupons" && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2 rounded-lg border border-border bg-elevated p-3">
              <input value={newCode} onChange={(e) => setNewCode(e.target.value.toUpperCase())} placeholder="CODE"
                className="rounded-md border border-border bg-bg px-2 py-1.5 font-mono text-xs text-fg" />
              <input value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder="Label"
                className="min-w-[12rem] flex-1 rounded-md border border-border bg-bg px-2 py-1.5 font-mono text-xs text-fg" />
              <button type="button" onClick={() => {
                if (!newCode.trim()) return;
                setCoupons((c) => [{ code: newCode.trim(), label: newLabel || newCode, active: true, redemptions: 0, maxRedemptions: 1000, bonusHandoffs: 10 }, ...c]);
                onToast(`Mock POST /v1/admin/coupons { code: "${newCode}" }`);
                setNewCode(""); setNewLabel("");
              }} className="inline-flex items-center gap-1 rounded-md bg-accent px-3 py-1.5 font-mono text-[11px] font-semibold text-accent-fg">
                <Plus className="size-3" /> Create
              </button>
            </div>
            <ul className="space-y-2">
              {coupons.map((c) => (
                <li key={c.code} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-elevated px-3 py-2">
                  <div>
                    <p className="font-mono text-xs font-semibold text-fg">{c.code}</p>
                    <p className="text-[10px] text-muted">{c.label}</p>
                    <p className="font-mono text-[10px] text-subtle">{c.redemptions}/{c.maxRedemptions} redeemed</p>
                  </div>
                  <button type="button" onClick={() => {
                    setCoupons((list) => list.map((x) => x.code === c.code ? { ...x, active: !x.active } : x));
                    onToast(`Toggle coupon ${c.code}`);
                  }} className={`rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase ${c.active ? "border-success/40 text-success" : "border-border text-muted"}`}>
                    {c.active ? "active" : "off"}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {tab === "campaigns" && (
          <ul className="space-y-2">
            {campaigns.map((camp) => (
              <li key={camp.id} className="rounded-lg border border-border bg-elevated px-3 py-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium text-fg">{camp.title}</p>
                    <p className="text-xs text-muted">{camp.body}</p>
                    <p className="mt-1 font-mono text-[10px] text-subtle">{camp.placement} · {camp.segment}</p>
                  </div>
                  <button type="button" onClick={() => {
                    setCampaigns((list) => list.map((x) => x.id === camp.id ? { ...x, active: !x.active } : x));
                    onToast(`Toggle campaign ${camp.id}`);
                  }} className={`shrink-0 rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase ${camp.active ? "border-accent/40 text-accent" : "border-border text-muted"}`}>
                    {camp.active ? "live" : "paused"}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        {tab === "credits" && (
          <div className="max-w-md space-y-3 rounded-lg border border-border bg-elevated p-4">
            <p className="text-sm font-medium text-fg">Grant credits</p>
            <p className="text-xs text-muted">POST /v1/admin/credits/grant</p>
            <select value={grantUserId} onChange={(e) => setGrantUserId(e.target.value)}
              className="w-full rounded-md border border-border bg-bg px-2 py-1.5 font-mono text-xs text-fg">
              {users.map((u) => <option key={u.id} value={u.id}>{u.email}</option>)}
            </select>
            <input type="number" value={grantAmount} onChange={(e) => setGrantAmount(Number(e.target.value))}
              className="w-full rounded-md border border-border bg-bg px-2 py-1.5 font-mono text-xs text-fg" />
            <button type="button" onClick={() => {
              setUsers((list) => list.map((u) => u.id === grantUserId
                ? { ...u, credits: { ...u.credits, handoffBalance: u.credits.handoffBalance + grantAmount } }
                : u));
              onToast(`Mock grant ${grantAmount} handoffs → ${grantUserId}`);
            }} className="rounded-md bg-accent px-3 py-2 font-mono text-[11px] font-semibold text-accent-fg">
              Grant handoffs
            </button>
          </div>
        )}

        {tab === "events" && (
          <p className="font-mono text-[11px] text-muted">GET /v1/admin/events — product lifecycle stream (wizard_completed, soft_gate_shown, …)</p>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-elevated p-3">
      <p className="label-caps">{label}</p>
      <p className="mt-1 font-mono text-sm text-fg">{value}</p>
    </div>
  );
}
