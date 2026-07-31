/**
 * Settings shell — Appearance (theme cards) + Payments (Billing / Usage)
 * inspired by product settings patterns; subscription is mock + API contract.
 */
import { useMemo, useState } from "react";
import {
  Activity,
  CreditCard,
  ExternalLink,
  Gauge,
  Monitor,
  Moon,
  Settings2,
  Shield,
  Sun,
  User,
  X,
  Zap,
} from "lucide-react";
import {
  BILLING_API_CONTRACT,
  DEMO_SUBSCRIPTION,
  PLANS,
  usageForPlan,
  type SubscriptionSnapshot,
} from "./subscription";
import { FIVE_ANALYSES, buildArchitectureMarkdown } from "./architectureAnalyses";
import {
  ASYNC_SPAWN_EXAMPLE,
  CAPABILITY_JSON_EXAMPLE,
  HMAC_EXPRESS_EXAMPLE,
  HMAC_MANUAL_EXAMPLE,
  HMAC_NOTES,
} from "./hmacExamples";
import type { ThemePreference } from "./theme";



type SettingsNav =
  | "account"
  | "appearance"
  | "behavior"
  | "billing"
  | "usage"
  | "api"
  | "architecture"
  | "hmac";

const NAV: {
  section?: string;
  id: SettingsNav;
  label: string;
  icon: typeof User;
}[] = [
  { section: "General", id: "account", label: "Account", icon: User },
  { id: "appearance", label: "Appearance", icon: Settings2 },
  { id: "behavior", label: "Behavior", icon: Shield },
  { section: "Payments", id: "billing", label: "Billing", icon: CreditCard },
  { id: "usage", label: "Usage", icon: Gauge },
  { section: "Platform", id: "api", label: "API & delivery", icon: Zap },
  { id: "architecture", label: "Architecture", icon: Activity },
  { id: "hmac", label: "HMAC & async", icon: Shield },
];



function ThemeCard({
  id,
  label,
  selected,
  onSelect,
  preview,
}: {
  id: ThemePreference;
  label: string;
  selected: boolean;
  onSelect: () => void;
  preview: "light" | "dark" | "system";
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={`group flex w-[7.5rem] flex-col items-center gap-2 rounded-xl p-1 transition-shadow ${
        selected ? "ring-2 ring-accent ring-offset-2 ring-offset-bg" : ""
      }`}
    >
      <div
        className={`relative h-16 w-full overflow-hidden rounded-lg border shadow-sm ${
          preview === "light"
            ? "border-border bg-[#f4f5f7]"
            : preview === "dark"
              ? "border-[#2a2a32] bg-[#0c0c10]"
              : "border-border"
        }`}
      >
        {preview === "system" ? (
          <div className="flex h-full">
            <div className="w-1/2 bg-[#f4f5f7] p-1.5">
              <div className="mb-1 h-1.5 w-6 rounded bg-[#d0d4dc]" />
              <div className="space-y-1">
                <div className="h-1 w-full rounded bg-[#e4e6eb]" />
                <div className="h-1 w-3/4 rounded bg-[#e4e6eb]" />
              </div>
            </div>
            <div className="w-1/2 bg-[#0c0c10] p-1.5">
              <div className="mb-1 h-1.5 w-6 rounded bg-[#3a3a44]" />
              <div className="space-y-1">
                <div className="h-1 w-full rounded bg-[#22222a]" />
                <div className="h-1 w-3/4 rounded bg-[#22222a]" />
              </div>
            </div>
          </div>
        ) : (
          <div className="flex h-full gap-1 p-1.5">
            <div
              className={`w-1/3 rounded-sm ${
                preview === "light" ? "bg-white border border-[#e4e6eb]" : "bg-[#16161c]"
              }`}
            />
            <div className="flex flex-1 flex-col gap-1 pt-1">
              <div
                className={`h-1.5 w-8 rounded ${
                  preview === "light" ? "bg-[#c8ccd4]" : "bg-[#3a3a44]"
                }`}
              />
              <div
                className={`h-1 w-full rounded ${
                  preview === "light" ? "bg-[#e4e6eb]" : "bg-[#22222a]"
                }`}
              />
              <div
                className={`h-1 w-2/3 rounded ${
                  preview === "light" ? "bg-[#e4e6eb]" : "bg-[#22222a]"
                }`}
              />
              <div
                className={`mt-auto size-1.5 self-end rounded-full ${
                  preview === "light" ? "bg-accent" : "bg-[#5ec8c0]"
                }`}
              />
            </div>
          </div>
        )}
      </div>
      <span
        className={`font-mono text-[11px] ${selected ? "font-semibold text-fg" : "text-muted"}`}
      >
        {label}
      </span>
    </button>
  );
}

export function SettingsPanel({
  open,
  onClose,
  themePref,
  onTheme,
  onToast,
}: {
  open: boolean;
  onClose: () => void;
  themePref: ThemePreference;
  onTheme: (p: ThemePreference) => void;
  onToast: (m: string) => void;
}) {
  const [nav, setNav] = useState<SettingsNav>("appearance");
  const [sub, setSub] = useState<SubscriptionSnapshot>(DEMO_SUBSCRIPTION);
  const [wrapCode, setWrapCode] = useState(true);
  const [confirmClose, setConfirmClose] = useState(true);
  const [autoArrange, setAutoArrange] = useState(true);

  const plan = PLANS.find((p) => p.id === sub.planId) ?? PLANS[1]!;
  const meters = useMemo(() => usageForPlan(sub.planId), [sub.planId]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-bg/60 p-3 sm:p-6"
      role="dialog"
      aria-modal
      aria-label="Settings"
      onClick={onClose}
    >
      <div
        className="flex h-full max-h-[min(720px,92dvh)] w-full max-w-4xl overflow-hidden rounded-xl border border-border bg-surface shadow-panel"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Sidebar */}
        <aside className="flex w-44 shrink-0 flex-col border-r border-border bg-elevated/80 sm:w-52">
          <div className="border-b border-border px-3 py-3">
            <p className="font-mono text-xs font-semibold text-fg">Settings</p>
            <p className="font-mono text-[10px] text-subtle">ADE · Command Center</p>
          </div>
          <nav className="min-h-0 flex-1 overflow-y-auto p-2">
            {NAV.map((item, i) => (
              <div key={item.id}>
                {item.section && (
                  <p
                    className={`label-caps px-2 pb-1 ${i === 0 ? "pt-0" : "pt-3"}`}
                  >
                    {item.section}
                  </p>
                )}
                <button
                  type="button"
                  onClick={() => setNav(item.id)}
                  className={`mb-0.5 flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[13px] ${
                    nav === item.id
                      ? "bg-panel font-medium text-fg"
                      : "text-muted hover:bg-panel/60 hover:text-fg"
                  }`}
                >
                  <item.icon className="size-3.5 shrink-0 opacity-80" />
                  {item.label}
                </button>
              </div>
            ))}
          </nav>
        </aside>

        {/* Main */}
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex items-center justify-between border-b border-border px-5 py-3">
            <h2 className="text-base font-semibold tracking-tight text-fg">
              {NAV.find((n) => n.id === nav)?.label}
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="rounded-md p-1 text-muted hover:bg-elevated hover:text-fg"
              aria-label="Close settings"
            >
              <X className="size-4" />
            </button>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
            {nav === "appearance" && (
              <div className="space-y-8">
                <div>
                  <p className="text-sm font-medium text-fg">Theme</p>
                  <div
                    role="radiogroup"
                    aria-label="Theme"
                    className="mt-4 flex flex-wrap gap-4"
                  >
                    <ThemeCard
                      id="light"
                      label="Light"
                      preview="light"
                      selected={themePref === "light"}
                      onSelect={() => {
                        onTheme("light");
                        onToast("Theme → light");
                      }}
                    />
                    <ThemeCard
                      id="dark"
                      label="Dark"
                      preview="dark"
                      selected={themePref === "dark"}
                      onSelect={() => {
                        onTheme("dark");
                        onToast("Theme → dark");
                      }}
                    />
                    <ThemeCard
                      id="system"
                      label="System"
                      preview="system"
                      selected={themePref === "system"}
                      onSelect={() => {
                        onTheme("system");
                        onToast("Theme → system");
                      }}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between gap-4 border-t border-border pt-6">
                  <div>
                    <p className="text-sm font-medium text-fg">
                      Wrap long lines for code blocks by default
                    </p>
                    <p className="mt-0.5 text-xs text-muted">
                      Pane scrollback and handoff markdown previews
                    </p>
                  </div>
                  <Toggle checked={wrapCode} onChange={setWrapCode} />
                </div>
              </div>
            )}

            {nav === "account" && (
              <div className="space-y-4">
                <div className="rounded-lg border border-border bg-elevated p-4">
                  <p className="label-caps">Signed in (mock)</p>
                  <p className="mt-1 font-mono text-sm text-fg">{sub.customerEmail}</p>
                  <p className="mt-1 font-mono text-[11px] text-muted">
                    Plan {plan.name} · {sub.status}
                  </p>
                </div>
                <p className="text-xs text-muted">
                  Production: OAuth / device code via <code className="text-accent">ade-api</code>
                  . Desktop never stores Stripe secrets.
                </p>
              </div>
            )}

            {nav === "behavior" && (
              <div className="space-y-5">
                <RowToggle
                  title="Confirm before destroying worktree"
                  hint="Close pane → warn data loss"
                  checked={confirmClose}
                  onChange={setConfirmClose}
                />
                <RowToggle
                  title="Auto-arrange on workspace open"
                  hint="Coordinator left · focus grid · stack overflow"
                  checked={autoArrange}
                  onChange={setAutoArrange}
                />
              </div>
            )}

            {nav === "billing" && (
              <div className="space-y-6">
                <div className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-border bg-elevated p-4">
                  <div>
                    <p className="label-caps">Current plan</p>
                    <p className="mt-1 text-lg font-semibold text-fg">{plan.name}</p>
                    <p className="font-mono text-[11px] text-muted">
                      {plan.priceLabel}
                      {plan.priceMonthly ? "/mo" : ""} · renews{" "}
                      {sub.renewsAt
                        ? new Date(sub.renewsAt).toLocaleDateString()
                        : "—"}
                    </p>
                  </div>
                  <span
                    className={`rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase ${
                      sub.status === "active"
                        ? "border-success/40 bg-success-dim text-success"
                        : "border-need/40 bg-need-dim text-need"
                    }`}
                  >
                    {sub.status}
                  </span>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  {PLANS.map((p) => (
                    <PlanCard
                      key={p.id}
                      plan={p}
                      current={sub.planId === p.id}
                      onSelect={() => {
                        setSub((s) => ({
                          ...s,
                          planId: p.id,
                          status: p.id === "free" ? "none" : "active",
                        }));
                        onToast(
                          p.id === sub.planId
                            ? "Already on this plan"
                            : `Mock switch → ${p.name} (API checkout in prod)`,
                        );
                      }}
                    />
                  ))}
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      onToast("Would open Stripe Checkout via ade-api POST /checkout")
                    }
                    className="inline-flex items-center gap-1.5 rounded-md bg-accent px-3 py-2 font-mono text-[11px] font-semibold text-accent-fg"
                  >
                    <ExternalLink className="size-3.5" />
                    Manage subscription
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      onToast("Would open Stripe Customer Portal via POST /portal")
                    }
                    className="rounded-md border border-border px-3 py-2 font-mono text-[11px] text-muted hover:text-fg"
                  >
                    Invoices & payment method
                  </button>
                </div>
              </div>
            )}

            {nav === "usage" && (
              <div className="space-y-4">
                <p className="text-xs text-muted">
                  Meters enforce soft limits from entitlements. Token counts are estimates until
                  harness telemetry is wired.
                </p>
                {meters.map((m) => {
                  const pct =
                    m.limit == null ? 0 : Math.min(100, Math.round((m.used / m.limit) * 100));
                  const over = m.limit != null && m.used >= m.limit;
                  return (
                    <div key={m.id}>
                      <div className="mb-1 flex justify-between font-mono text-[11px]">
                        <span className="text-fg">{m.label}</span>
                        <span className={over ? "text-danger" : "text-muted"}>
                          {m.used.toLocaleString()}
                          {m.limit != null ? ` / ${m.limit.toLocaleString()}` : " · ∞"}{" "}
                          {m.unit}
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-elevated">
                        <div
                          className={`h-full rounded-full ${
                            over ? "bg-danger" : pct > 80 ? "bg-need" : "bg-accent"
                          }`}
                          style={{
                            width: m.limit == null ? "12%" : `${Math.max(4, pct)}%`,
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
                <button
                  type="button"
                  onClick={() => onToast("Export usage CSV — ade-api GET /usage")}
                  className="mt-2 rounded-sm border border-border px-2 py-1.5 font-mono text-[10px] text-muted"
                >
                  Export usage (API)
                </button>
              </div>
            )}

            {nav === "api" && (
              <div className="space-y-4">
                <p className="text-sm text-muted">
                  Separate <strong className="text-fg">ade-api</strong> repo owns auth, Stripe,
                  entitlements, and usage. This desktop app only holds a JWT and cached
                  entitlements.
                </p>
                <pre className="max-h-[50dvh] overflow-auto rounded-lg border border-border bg-bg p-3 font-mono text-[10px] leading-relaxed text-muted">
                  {BILLING_API_CONTRACT}
                </pre>
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(BILLING_API_CONTRACT);
                      onToast("API contract copied");
                    } catch {
                      onToast("Copy failed");
                    }
                  }}
                  className="rounded-md border border-accent/40 bg-accent-dim px-3 py-1.5 font-mono text-[11px] text-accent"
                >
                  Copy API contract
                </button>
              </div>
            )}

            {nav === "architecture" && (
              <div className="space-y-5">
                <p className="text-sm text-muted">
                  Five skill-tagged analyses — Tauri plugins, IPC trust, webhook crypto,
                  reliability, entitlements bridge. Use this as the incorporation checklist.
                </p>
                {FIVE_ANALYSES.map((a) => (
                  <article
                    key={a.id}
                    className="rounded-lg border border-border bg-elevated p-4"
                  >
                    <div className="flex flex-wrap items-baseline gap-2">
                      <span className="font-mono text-[10px] text-accent">0{a.number}</span>
                      <h3 className="text-sm font-semibold text-fg">{a.title}</h3>
                    </div>
                    <p className="mt-1 font-mono text-[10px] text-subtle">
                      Skills: {a.skillSets.join(" · ")}
                    </p>
                    <p className="mt-2 text-xs leading-relaxed text-muted">{a.summary}</p>
                    <ul className="mt-2 space-y-1 font-mono text-[10px] text-muted">
                      {a.productActions.slice(0, 3).map((p) => (
                        <li key={p}>→ {p}</li>
                      ))}
                    </ul>
                  </article>
                ))}
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(buildArchitectureMarkdown());
                      onToast("Full architecture pack copied (markdown)");
                    } catch {
                      onToast("Copy failed");
                    }
                  }}
                  className="rounded-md border border-accent/40 bg-accent-dim px-3 py-1.5 font-mono text-[11px] text-accent"
                >
                  Copy full analysis pack
                </button>
              </div>
            )}

            {nav === "hmac" && (
              <div className="space-y-5">
                <p className="text-sm text-muted">
                  Capability syntax, async spawn, and Stripe HMAC examples for{" "}
                  <code className="text-accent">ade-api</code>. Full write-ups live in{" "}
                  <code className="text-fg">docs/</code>.
                </p>

                <DocBlock
                  title="HMAC notes"
                  body={HMAC_NOTES}
                  onCopy={async () => {
                    await navigator.clipboard.writeText(HMAC_NOTES);
                    onToast("HMAC notes copied");
                  }}
                />
                <DocBlock
                  title="Express + Stripe SDK"
                  body={HMAC_EXPRESS_EXAMPLE}
                  onCopy={async () => {
                    await navigator.clipboard.writeText(HMAC_EXPRESS_EXAMPLE);
                    onToast("Express example copied");
                  }}
                />
                <DocBlock
                  title="Manual HMAC (educational)"
                  body={HMAC_MANUAL_EXAMPLE}
                  onCopy={async () => {
                    await navigator.clipboard.writeText(HMAC_MANUAL_EXAMPLE);
                    onToast("Manual HMAC example copied");
                  }}
                />
                <DocBlock
                  title="Capability JSON (main window)"
                  body={CAPABILITY_JSON_EXAMPLE}
                  onCopy={async () => {
                    await navigator.clipboard.writeText(CAPABILITY_JSON_EXAMPLE);
                    onToast("Capability JSON copied");
                  }}
                />
                <DocBlock
                  title="Async spawn (Rust sketch)"
                  body={ASYNC_SPAWN_EXAMPLE}
                  onCopy={async () => {
                    await navigator.clipboard.writeText(ASYNC_SPAWN_EXAMPLE);
                    onToast("Async spawn sketch copied");
                  }}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function DocBlock({
  title,
  body,
  onCopy,
}: {
  title: string;
  body: string;
  onCopy: () => Promise<void>;
}) {
  return (
    <section className="rounded-lg border border-border bg-elevated p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="font-mono text-xs font-semibold text-fg">{title}</h3>
        <button
          type="button"
          onClick={() => {
            void onCopy().catch(() => undefined);
          }}
          className="rounded-sm border border-border px-2 py-0.5 font-mono text-[10px] text-muted hover:text-fg"
        >
          Copy
        </button>
      </div>
      <pre className="max-h-48 overflow-auto rounded-md border border-border bg-bg p-2 font-mono text-[10px] leading-relaxed text-muted">
        {body}
      </pre>
    </section>
  );
}

function Toggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
        checked ? "bg-accent" : "bg-border-strong"
      }`}
    >
      <span
        className={`absolute top-0.5 size-5 rounded-full bg-white shadow transition-transform ${
          checked ? "left-5" : "left-0.5"
        }`}
      />
    </button>
  );
}

function RowToggle({
  title,
  hint,
  checked,
  onChange,
}: {
  title: string;
  hint: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border pb-4">
      <div>
        <p className="text-sm font-medium text-fg">{title}</p>
        <p className="text-xs text-muted">{hint}</p>
      </div>
      <Toggle checked={checked} onChange={onChange} />
    </div>
  );
}

function PlanCard({
  plan,
  current,
  onSelect,
}: {
  plan: (typeof PLANS)[0];
  current: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex flex-col rounded-lg border p-3 text-left ${
        current
          ? "border-accent bg-accent-dim/30"
          : plan.highlight
            ? "border-border bg-elevated hover:border-accent/40"
            : "border-border bg-elevated hover:border-border-strong"
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="font-mono text-xs font-semibold text-fg">{plan.name}</span>
        {current && (
          <span className="font-mono text-[9px] uppercase text-accent">current</span>
        )}
      </div>
      <p className="mt-1 font-mono text-lg font-semibold text-fg">
        {plan.priceLabel}
        {plan.priceMonthly ? (
          <span className="text-xs font-normal text-muted">/mo</span>
        ) : null}
      </p>
      <ul className="mt-2 space-y-1 font-mono text-[10px] text-muted">
        {plan.features.slice(0, 4).map((f) => (
          <li key={f}>· {f}</li>
        ))}
      </ul>
    </button>
  );
}
