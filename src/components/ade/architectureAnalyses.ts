/**
 * Five skill-tagged analyses: Tauri plugins + webhook security
 * Synthesized for ADE / harness-ready product incorporation.
 */

export interface SkillTaggedAnalysis {
  id: string;
  number: 1 | 2 | 3 | 4 | 5;
  title: string;
  /** Primary skill set(s) owning this analysis */
  skillSets: string[];
  summary: string;
  findings: string[];
  productActions: string[];
  threats?: string[];
}

export const FIVE_ANALYSES: SkillTaggedAnalysis[] = [
  {
    id: "tauri-plugin-architecture",
    number: 1,
    title: "Tauri v2 plugin architecture patterns",
    skillSets: [
      "Rust systems engineering",
      "Desktop platform architecture",
      "API surface design (Rust ↔ TypeScript)",
    ],
    summary:
      "Tauri plugins are dual-sided packages: a Rust crate (commands, state, lifecycle) plus a TypeScript package that invokes those commands. Official pattern is modular extraction of domain logic (shell, FS, updater, custom agent bridges) with explicit permission files — commands are denied by default until allowed.",
    findings: [
      "Plugin layout typically: src-tauri plugin crate + guest-js/TS bindings; both ship as versioned units.",
      "Commands use #[tauri::command]; plugins register via Builder plugin() and can hold managed State<T>.",
      "Permission files live under permissions/ (JSON/TOML): individual allows + permission sets + a default set reflecting the threat model.",
      "App-level capabilities (src-tauri/capabilities/) map permission sets onto window/webview labels — not global wildcards.",
      "Trust split: Rust core has full OS access; WebView only sees what IPC + capabilities expose. Plugins run in the trusted core.",
      "Best practice: one plugin per domain (e.g. plugin-agent-bridge, plugin-worktree, plugin-mcp-spawn) rather than a monoplugin god-crate.",
      "Avoid localhost-server plugins unless necessary; they widen the attack surface vs asset protocol + IPC.",
      "Type-safe wrappers (TauRPC / GraphQL plugins) reduce footguns but still sit behind the same capability model.",
    ],
    productActions: [
      "Define ADE plugins: agent-bridge (spawn/attach), worktree-git, mcp-inject, entitlements-cache, deep-link-billing.",
      "Default permissions: deny shell/open unless capability for coordinator window only.",
      "Never put Stripe secrets in any plugin; billing plugin only opens system browser + stores JWT.",
      "Document each command’s inputs/outputs in OpenAPI-style tables for UI + security review.",
    ],
    threats: [
      "Over-broad default permissions → WebView XSS becomes full machine RCE via plugin commands.",
      "Unmanaged plugin state races across multi-window ADE.",
    ],
  },
  {
    id: "tauri-capability-ipc",
    number: 2,
    title: "Capability-based IPC & desktop trust boundaries",
    skillSets: [
      "Application security (desktop)",
      "Threat modeling",
      "Least-privilege systems design",
    ],
    summary:
      "Tauri v2’s security model is capability-based: permissions are toggles + optional parameter validation, attached to labeled windows. ADE must treat the Command Center webview as untrusted relative to worktree destruction and process spawn.",
    findings: [
      "IPC is the only bridge between untrusted UI and trusted Rust; all invokes are intercepted and ACL-checked.",
      "Capabilities file = { windows: [\"main\"], permissions: [\"agent-bridge:allow-spawn\", …] }.",
      "Scopes (paths, URLs) should constrain FS and HTTP plugins to project roots / known APIs.",
      "CSP + isolation for any remote content; prefer no remote script in production ADE builds.",
      "Deep links (billing return) need a dedicated capability and strict URL allowlist.",
      "Updater plugin: signed updates only; pin public keys in config.",
      "Logging plugin: redact tokens, webhook secrets, and pane prompts that may contain secrets.",
    ],
    productActions: [
      "Capability matrix in-repo: map each Settings/Billing UI action → allowed command set.",
      "Separate window labels if Settings ever runs in a detached window (narrower perms).",
      "Path scope worktree ops to `.agent-teams-worktrees/**` under known project roots.",
      "Add security self-test: invoke denied command must reject in CI smoke.",
    ],
    threats: [
      "Prototype pollution / XSS in React → invoke destroy_worktree without confirm.",
      "Capability drift between dev and release configs.",
    ],
  },
  {
    id: "webhook-crypto-verify",
    number: 3,
    title: "Webhook cryptographic verification (Stripe & peers)",
    skillSets: [
      "Application security / AppSec",
      "Applied cryptography",
      "Payments integration engineering",
    ],
    summary:
      "Webhook endpoints must prove origin via HMAC signatures (Stripe-Signature, GitHub X-Hub-Signature-256). Verification uses the raw body, a secret only on ade-api, constant-time compare, and timestamp tolerance to stop replays.",
    findings: [
      "Never trust JSON body alone; anyone can POST to a public URL.",
      "Stripe: verify with official SDK; requires unmodified raw body (no premature JSON parse).",
      "Validate t= timestamp (typically ±5 minutes) to limit replay windows.",
      "Secrets only in env / secret manager (STRIPE_WEBHOOK_SECRET); rotate via dual-secret window.",
      "Return 400 on bad signature; log failures for SIEM without logging full payload PII.",
      "HTTPS-only endpoints; no query-token “security”.",
      "Desktop ADE must NOT receive Stripe webhooks — only ade-api does.",
    ],
    productActions: [
      "ade-api: POST /webhooks/stripe with raw body middleware + SDK constructEvent.",
      "Store signing secret outside git; document rotation runbook.",
      "Reject and metric: webhook_signature_fail_total.",
      "Separate endpoints per provider if adding GitHub marketplace later.",
    ],
    threats: [
      "Forged customer.subscription.deleted → wrongful downgrade.",
      "Body re-serialization breaking signatures in framework middleware.",
    ],
  },
  {
    id: "webhook-reliability",
    number: 4,
    title: "Webhook reliability: idempotency, ordering, async work",
    skillSets: [
      "Distributed systems",
      "Backend reliability engineering",
      "Data modeling (event stores)",
    ],
    summary:
      "Providers deliver at-least-once and may reorder. Handlers must be idempotent (event id keys), respond fast (2xx after accept), and process side effects asynchronously with durable jobs.",
    findings: [
      "Idempotency key = Stripe event.id (or delivery id); unique constraint in DB before side effects.",
      "Ack quickly (≤ a few seconds); enqueue for entitlement recompute / email.",
      "Handle out-of-order: prefer subscription object fetch from Stripe API after event, not only payload snapshot.",
      "Retries: 5xx/timeouts redeliver; 2xx stops; design so double-apply is safe.",
      "Transactional outbox: update sub row + insert job in one DB transaction.",
      "Dead-letter queue for poison events after N failures.",
      "Clock skew: rely on signature timestamp + server NTP.",
    ],
    productActions: [
      "Schema: webhook_events(id PK, type, processed_at, payload_hash).",
      "Worker: recompute entitlements → publish version for desktop cache invalidation.",
      "Settings Usage: source from ade-api aggregates, not client-side guesses alone.",
      "Admin replay tool: reprocess event id safely.",
    ],
    threats: [
      "Double-credit or double-revoke on race without unique event id.",
      "Long handler → Stripe timeouts → infinite retry storms.",
    ],
  },
  {
    id: "entitlements-bridge",
    number: 5,
    title: "Product bridge: entitlements from API to Tauri ADE",
    skillSets: [
      "Product engineering",
      "Full-stack systems design",
      "Desktop UX for monetization",
    ],
    summary:
      "Paid delivery is an entitlements protocol: ade-api is source of truth after webhooks; Tauri caches signed entitlements with TTL; UI soft-gates Pro features without destroying local worktrees or MCP local config.",
    findings: [
      "Entitlement blob: { plan, features[], limits{}, exp, sig } — verify with API public key offline.",
      "Refresh on app focus + deep-link return from Checkout.",
      "Soft-gate: Hobby can still run 3 panes; export MCP pack / advanced merge may prompt upgrade.",
      "Hard-gate only cloud-backed APIs (org recipes, SSO) — never local FS.",
      "Billing plugin: open_url(checkout) + deep_link handler; no card UI in WebView.",
      "Usage meters: GET /usage; show honesty when harness is state_blind (no fake token burn).",
      "Team seats: seat claims via API; desktop shows org roster read-only.",
    ],
    productActions: [
      "Implement entitlements.ts client + plugin-entitlements Rust cache file.",
      "Wire Settings → Billing to real checkout when ade-api exists.",
      "Feature flags map: feature.mcp.export, limit.panes.concurrent, etc.",
      "Grace period 72h on past_due before soft-gate tightens.",
      "Analytics: upgrade funnel from gate modal → checkout → active (privacy-preserving).",
    ],
    threats: [
      "Clock-back to extend expired cache — bind exp + device nonce; periodic online check.",
      "User edits local cache file — signature required.",
    ],
  },
];

export function buildArchitectureMarkdown(): string {
  const lines: string[] = [
    `# ADE architecture analyses`,
    ``,
    `Five skill-tagged investigations synthesizing Tauri plugin patterns and webhook security for harness-ready / Agent Command Center.`,
    ``,
    `## Synthesis (product incorporation)`,
    ``,
    `1. **Split trust**: Stripe webhooks + secrets only in \`ade-api\`; Tauri plugins never see webhook secrets.`,
    `2. **Plugin modularity**: agent-bridge · worktree · mcp-inject · entitlements · deep-link-billing — each with least-privilege permissions.`,
    `3. **Capabilities**: map UI actions → allowed commands; path-scope worktrees; deny-by-default.`,
    `4. **Webhooks**: raw-body HMAC verify · timestamp window · idempotent event IDs · fast 2xx · async workers.`,
    `5. **Monetization UX**: signed entitlements cache · soft-gates · Checkout in system browser · Usage from API.`,
    `6. **Honesty**: state_blind harnesses do not invent usage; meters label estimates.`,
    ``,
    `### Delivery checklist`,
    ``,
    `- [ ] Scaffold \`ade-api\` with \`POST /webhooks/stripe\` (verify + idempotent store)`,
    `- [ ] \`GET /entitlements\` signed response`,
    `- [ ] Tauri \`plugin-entitlements\` + capability entries`,
    `- [ ] Settings Billing → Checkout / Portal`,
    `- [ ] Soft-gates for Hobby vs Pro features`,
    `- [ ] CI: capability deny test + webhook signature fixture tests`,
    ``,
  ];

  for (const a of FIVE_ANALYSES) {
    lines.push(`---`);
    lines.push(``);
    lines.push(`## ${a.number}. ${a.title}`);
    lines.push(``);
    lines.push(`**Skill sets:** ${a.skillSets.join(" · ")}`);
    lines.push(``);
    lines.push(a.summary);
    lines.push(``);
    lines.push(`### Findings`);
    lines.push(``);
    for (const f of a.findings) lines.push(`- ${f}`);
    lines.push(``);
    if (a.threats?.length) {
      lines.push(`### Threats`);
      lines.push(``);
      for (const t of a.threats) lines.push(`- ${t}`);
      lines.push(``);
    }
    lines.push(`### Product actions`);
    lines.push(``);
    for (const p of a.productActions) lines.push(`- [ ] ${p}`);
    lines.push(``);
  }

  lines.push(`---`);
  lines.push(``);
  lines.push(`*Generated for product incorporation — ADE Settings → API & delivery.*`);
  return lines.join("\n");
}
