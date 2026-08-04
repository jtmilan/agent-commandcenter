# Recommendations checklist — ADE product integration

Prioritized for harness-ready Agent Command Center and sibling harness apps.

Legend: **P0** ship-blocker · **P1** paid launch · **P2** polish / scale

---

## A. Security & trust split

| # | Pri | Recommendation | Done? |
|---|-----|----------------|-------|
| A1 | P0 | Keep Stripe secrets + webhooks only in `ade-api` | [ ] |
| A2 | P0 | HMAC verify raw body on all payment webhooks | [ ] |
| A3 | P0 | Tauri capabilities deny-by-default; no `*` permissions | [ ] |
| A4 | P0 | Path-scope worktree destroy/create to known roots | [ ] |
| A5 | P1 | Signed entitlements cache (exp + sig) on desktop | [ ] |
| A6 | P1 | CI: capability deny smoke + webhook signature fixtures | [ ] |
| A7 | P1 | Redact tokens/prompts in logs | [ ] |
| A8 | P2 | Dual webhook secret rotation runbook | [ ] |

## B. Asynchronous processing

| # | Pri | Recommendation | Done? |
|---|-----|----------------|-------|
| B1 | P0 | Webhook: verify → idempotent insert → enqueue → 2xx | [ ] |
| B2 | P0 | Desktop spawn: return job_id; emit status events | [ ] |
| B3 | P1 | Outbox + worker for entitlement recompute | [ ] |
| B4 | P1 | DLQ + admin replay for poison events | [ ] |
| B5 | P1 | Refresh entitlements on focus + billing deep-link | [ ] |
| B6 | P2 | Parallel `git_status` for merge gate (timeouts) | [ ] |

## C. Capabilities & configuration syntax

| # | Pri | Recommendation | Done? |
|---|-----|----------------|-------|
| C1 | P0 | Capability file per window label (`main`, optional `settings`) | [ ] |
| C2 | P0 | Plugin permission files with explicit allow lists | [ ] |
| C3 | P1 | HTTP allowlist to `api.yourdomain.com` only | [ ] |
| C4 | P1 | Deep-link allowlist for Checkout return | [ ] |
| C5 | P2 | Document UI action → permission matrix in every PR | [ ] |

## D. Monetization & entitlements

| # | Pri | Recommendation | Done? |
|---|-----|----------------|-------|
| D1 | P0 | Plans: Hobby / Pro / Team with clear limits | Mock UI ✓ |
| D2 | P1 | Soft-gate Pro features; never brick local worktrees | [ ] |
| D3 | P1 | Checkout + Customer Portal via system browser | [ ] |
| D4 | P1 | Usage meters from API (label estimates for state_blind) | Mock UI ✓ |
| D5 | P2 | 72h grace on `past_due` | [ ] |
| D6 | P2 | Team seats + SSO-ready entitlements | [ ] |

## E. ADE product surfaces (already in mock)

| # | Pri | Item | Status |
|---|-----|------|--------|
| E1 | — | Command Center fleet + workspace tree + DnD | Done (mock) |
| E2 | — | Sub-linear pack, pin, resize, auto-arrange | Done (mock) |
| E3 | — | Worktree close confirm | Done (mock) |
| E4 | — | Wizard (incl. MCP spawn preview) | Done (mock) |
| E5 | — | MCP Control Center + matrix + pack | Done (mock) |
| E6 | — | 10 feature panels (inbox → matrix) | Done (mock) |
| E7 | — | Merge gate + conflict resolution + handoff v2 | Done (mock) |
| E8 | — | Themes dark/light/system + AA contrast | Done (mock) |
| E9 | — | Settings Appearance / Billing / Usage / Architecture | Done (mock) |
| E10 | — | Architecture analyses + HMAC/async docs | Done |

## F. Multi-harness platform (next products)

| # | Pri | Recommendation | Done? |
|---|-----|----------------|-------|
| F1 | P1 | Shared `agent-bridge` plugin interface for Claude/Cursor/Codex/Grok/… | [ ] |
| F2 | P1 | Honest telemetry enum: live / stale / state_blind | Partial mock ✓ |
| F3 | P1 | Reuse MCP registry + merge gate engines across apps | [ ] |
| F4 | P2 | Shared design tokens package (`@ade/tokens`) | [ ] |
| F5 | P2 | Shared handoff-md/v2 exporter | Partial mock ✓ |

## G. Documentation & handover

| # | Pri | Item | Status |
|---|-----|------|--------|
| G1 | P0 | PRD-HANDOVER.md | Done |
| G2 | P0 | ASYNC-CAPABILITIES.md | Done |
| G3 | P0 | HMAC-WEBHOOK-VERIFICATION.md | Done |
| G4 | P0 | RECOMMENDATIONS-CHECKLIST.md (this file) | Done |
| G5 | P1 | OpenAPI for `ade-api` when scaffolded | [ ] |

---

## Immediate next 5 engineering tasks

1. ~~Scaffold `ade-api` with Stripe test webhook (HMAC + idempotency table).~~ → done (ade-api)  
2. ~~Define real Tauri capability JSON matching §C.~~ → partial (`src-tauri/capabilities`)  
3. ~~Implement soft-gates in React from entitlements mock → real API.~~ → **v2 done**  
4. ~~Wire `spawn_agent` async job + events for one harness (Claude).~~ → **v2 done**  
5. Export `@ade/core` (mergeGate, handoff, mcpConfig) for other harness UIs.  

### v2 top 5 (shipped 2026-08)

See [BUILD-PATH-V2.md](./BUILD-PATH-V2.md) + [ENTITLEMENTS-PROTOCOL.md](./ENTITLEMENTS-PROTOCOL.md).

| # | Task | Done |
|---|------|------|
| 1 | Claude spawn + job_id events | [x] |
| 2 | Worktree destroy on close dialog | [x] |
| 3 | Status bus from host events | [x] |
| 4 | ade-api checkout + HMAC + signed entitlements | [x] |
| 5 | Soft-gates from signed blob | [x] |

---

*Last updated: 2026-07-31 — Agent Command Center UI proposal workspace.*

---

## H. Growth & engagement (coupons, credits, marketing)

See [GROWTH-ENGAGEMENT-API.md](./GROWTH-ENGAGEMENT-API.md).

| # | Pri | Recommendation | Done? |
|---|-----|----------------|-------|
| H1 | P0 | Entitlements include credits + trialEndsAt + promo | [ ] |
| H2 | P0 | `POST /v1/coupons/redeem` + checkout `couponCode` | [ ] |
| H3 | P0 | Settings Billing: redeem UI + promo chip | [ ] |
| H4 | P1 | Credits ledger + consume API (idempotent) | [ ] |
| H5 | P1 | Welcome credits on wizard_completed event | [ ] |
| H6 | P1 | In-app campaigns + dismiss | [ ] |
| H7 | P1 | Soft-gate dual CTA (credits vs upgrade) | [ ] |
| H8 | P2 | Referrals + win-back segments | [ ] |
| H9 | P2 | Credit packs (one-time Checkout) | [ ] |
| H10 | P2 | Lifecycle email from ade-api (not desktop) | [ ] |
