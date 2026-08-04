# Product Requirements & Handover Document  
## Agent Command Center (ADE)

| Field | Value |
|-------|--------|
| **Product name** | Agent Command Center / ADE (Agent Development Environment) |
| **Repos** | [`jtmilan/agent-commandcenter`](https://github.com/jtmilan/agent-commandcenter) · [`jtmilan/ade-api`](https://github.com/jtmilan/ade-api) |
| **Document type** | PRD + engineering handover |
| **Version** | **2.0** |
| **Date** | 2026-08-04 |
| **Status** | UI + host bridge + signed soft-gates **in place**; native Tauri path ready for local rebuild; portable-pty & live Stripe still open |
| **Primary users** | Operators running multi-agent harness fleets |
| **Local rebuild** | **Start here → [LOCAL-HANDOVER.md](./LOCAL-HANDOVER.md)** |

---

## 1. Problem statement

Teams orchestrating multiple AI coding harnesses need a **local-first command center** that:

- Groups agents by **workspace** (not a flat pane soup)  
- Makes **attention** (needs_input / blocked / errors) findable  
- Respects **honest telemetry** (no fake “live” for state-blind CLIs)  
- Supports **MCP** configuration in one place  
- Supports **paid plans** without putting Stripe secrets in the desktop app  

---

## 2. Goals & non-goals

### Goals (current product)

1. Demo-quality **Command / Monitoring / Context** (+ Admin persona)  
2. Workspace tree, multi-harness panes, DnD, pin, resize, auto-arrange  
3. Wizard + recipes; welcome mission  
4. Operator suite: inbox, ownership, heat, timeline, runbook, Diff/PR, broadcast, merge, handoff, presets, matrix, MCP  
5. Themes dark/light/system; AA contrast notes  
6. **Agent bridge**: Claude-first spawn, job events, worktree destroy on close  
7. **ade-api**: signed entitlements, checkout mock, HMAC webhooks, growth (coupons/credits)  
8. Soft-gates that **never brick local worktrees**  

### Non-goals (still out of scope)

- Full interactive portable-pty terminal emulator (process spawn exists; richer PTY next)  
- Production multi-tenant Stripe + SSO  
- Cloud multiplayer co-editing of panes  
- Mobile-native fleet control  

---

## 3. Personas (same shell)

| Persona | Bearer (dev) | Surfaces |
|---------|--------------|----------|
| **Operator** | `operator` | Fleet, MCP, merge, self-serve billing |
| **Admin** | `admin` | Admin tab: users, coupons, campaigns, credits |
| **Viewer** | `viewer` | Read-only usage / entitlements |

See [PERSONA-CONSOLE.md](./PERSONA-CONSOLE.md).

---

## 4. Architecture

```text
┌─────────────────────────────────────────┐
│  agent-commandcenter (Tauri + React)    │
│  - Command Center UI                    │
│  - agent-bridge (spawn/kill/worktree)   │
│  - status bus + soft-gates              │
│  - Local MCP config + worktrees         │
└──────────────────┬──────────────────────┘
                   │ Bearer + GET /entitlements
                   ▼
┌─────────────────────────────────────────┐
│  ade-api (separate repo)                │
│  - Personas, Stripe webhooks (HMAC)     │
│  - Signed entitlements, checkout, usage │
│  - Coupons, credits, campaigns, admin   │
└─────────────────────────────────────────┘
```

---

## 5. What is completed (v2)

| Area | Status |
|------|--------|
| Command Center fleet UI | Done (demo data) |
| Sub-linear layout / pin / resize | Done |
| Close → destroy worktree confirm | Done (async + host destroy) |
| Wizard / recipes / mission | Done (UI) |
| MCP Control Center | Done (UI + local store) |
| 10+ feature panels + build-path panels | Done |
| Themes + Settings | Done |
| Persona + Admin console | Done (UI; API when ade-api up) |
| agent-bridge + Tauri stubs | Done (process + git worktree) |
| Host events → status bus / Timeline | Done |
| Soft-gates from signed entitlements | Done (HMAC verify + focus refresh) |
| ade-api entitlements / checkout / webhooks | Done (mock + HMAC tests) |
| Docs for local rebuild | **[LOCAL-HANDOVER.md](./LOCAL-HANDOVER.md)** |

Detail: [BUILD-PATH.md](./BUILD-PATH.md), [BUILD-PATH-V2.md](./BUILD-PATH-V2.md), [ENTITLEMENTS-PROTOCOL.md](./ENTITLEMENTS-PROTOCOL.md).

---

## 6. Open engineering (next)

1. portable-pty for true interactive agent terminals  
2. Multi-harness adapters beyond Claude first-class  
3. Live Stripe Checkout Session + Customer Portal  
4. Asymmetric entitlement signatures  
5. Crash recovery of pane layout + worktrees  
6. Windows / Linux packaging  

Full backlog: [RECOMMENDATIONS-CHECKLIST.md](./RECOMMENDATIONS-CHECKLIST.md).

---

## 7. How to rebuild & test locally

**→ Full checklist: [LOCAL-HANDOVER.md](./LOCAL-HANDOVER.md)**  
**→ Tauri detail: [DESKTOP-BUILD.md](./DESKTOP-BUILD.md)**

Short version:

```bash
# API
cd ade-api && ALLOW_DEV_AUTH=1 npm i && npm run dev

# UI mock
cd agent-commandcenter && npm i && npm run dev

# Native
npm run tauri:dev
```

---

## 8. Success criteria (handover accepted when)

- [ ] Both repos clone and install  
- [ ] UI preview shows Command Center  
- [ ] Demo fleet + Timeline events  
- [ ] Close pane destroy path works  
- [ ] Soft-gates work with or without API (degraded ok)  
- [ ] `npm run typecheck` passes  
- [ ] Optional: Tauri window + real `claude` if CLI present  

---

## 9. Document history

| Ver | Date | Notes |
|-----|------|--------|
| 1.0 | 2026-07-31 | UI proposal + architecture docs |
| 2.0 | 2026-08-04 | Host path top-5, entitlements, LOCAL-HANDOVER for manual rebuild |
