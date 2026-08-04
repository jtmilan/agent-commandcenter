# Local rebuild & manual test handover

**For:** Jeffry (or next engineer) rebuilding **Agent Command Center** on a Mac and testing by hand.  
**Repos:** UI + host stubs in this repo · billing in **ade-api** (sibling).  
**As of:** 2026-08-04 · commits around `agent-commandcenter@1766274` · `ade-api@dad86b4`

This is the **single checklist** to clone, run, and verify. Deeper design lives in linked docs.

---

## 1. What you are building

| | |
|---|---|
| **Product** | ADE / Agent Command Center — multi-harness **operator** (not a full IDE) |
| **Form factor** | **Tauri 2 native app** (macOS first). Browser = UI preview only. |
| **UI repo** | https://github.com/jtmilan/agent-commandcenter |
| **API repo** | https://github.com/jtmilan/ade-api |
| **Real agents** | Only under Tauri (`spawn_agent`, worktrees). `npm run dev` = mock fleet. |
| **Billing secrets** | **Never** in the desktop binary — only in ade-api env |

```text
You (Mac)
  ├── agent-commandcenter   → React UI + src-tauri (Claude spawn, git worktree)
  └── ade-api               → entitlements, checkout mock, Stripe HMAC (optional)
```

---

## 2. Clone both repos

```bash
# UI + Tauri host
git clone https://github.com/jtmilan/agent-commandcenter.git
cd agent-commandcenter
git checkout main
git pull

# Billing API (sibling directory recommended)
cd ..
git clone https://github.com/jtmilan/ade-api.git
cd ade-api
git checkout main
git pull
```

---

## 3. ade-api (start first if you want soft-gates)

```bash
cd ade-api
cp .env.example .env   # if present; else use env inline

# Minimal dev:
export ALLOW_DEV_AUTH=1
export ENTITLEMENTS_SIGNING_SECRET=dev-only-change-me
export PUBLIC_APP_URL=http://localhost:8080
# Optional Stripe later:
# export STRIPE_SECRET_KEY=sk_test_...
# export STRIPE_WEBHOOK_SECRET=whsec_...

npm install
npm run dev
# → http://127.0.0.1:8787/health
```

**Smoke API:**

```bash
curl -s http://127.0.0.1:8787/health | jq .
curl -s http://127.0.0.1:8787/v1/entitlements \
  -H 'Authorization: Bearer operator' | jq '.entitlements.planId, .sig[0:16]'
curl -s -X POST http://127.0.0.1:8787/v1/checkout \
  -H 'Authorization: Bearer operator' -H 'Content-Type: application/json' \
  -d '{"planId":"pro"}' | jq .
```

| Bearer | Persona |
|--------|---------|
| `admin` | Admin console APIs |
| `operator` / `dev` | Operator (default desktop) |
| `viewer` | Read-only |

---

## 4. Desktop UI — two modes

### A) UI preview only (fast, mock harnesses)

```bash
cd agent-commandcenter
npm install
npm run typecheck
npm run dev
# → http://127.0.0.1:8080  (or host:8080)
```

Optional env (`.env` / shell) so soft-gates hit local API:

```bash
export VITE_ADE_API_URL=http://127.0.0.1:8787
export VITE_ENTITLEMENTS_VERIFY_SECRET=dev-only-change-me
npm run dev
```

> **Expectation:** spawn/destroy are **mock** but emit real-shaped events (job_id, needs_input, Timeline).

### B) Native Tauri (path for real Claude / git)

> **Wrong directory = this error:**  
> `npm error Missing script: "tauri:dev"` **and** `audited 4 packages`  
> → You are inside **`ade-api`**, not **`agent-commandcenter`**.  
> Tauri lives only in the UI repo. Check with: `cat package.json | grep name` → must say `"agent-commandcenter"`.

```bash
# Prerequisites (once): Xcode CLT, Rust stable, Node 20+
xcode-select --install   # if needed
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source "$HOME/.cargo/env"

cd agent-commandcenter   # ← NOT ade-api
pwd                      # …/agent-commandcenter
cat package.json | head -5   # "name": "agent-commandcenter"

npm install
npm install -D @tauri-apps/cli@2 @tauri-apps/api@2

# Confirm scripts exist
npm run   # should list tauri:dev and tauri:build

# Ensure Claude CLI is on PATH if you want real spawn:
which claude

npm run tauri:dev
# native window; IPC → src-tauri spawn_agent / worktree_*
```

Release package (macOS):

```bash
npm run tauri:build
# → target/release/bundle/… .app / dmg
```

**Note:** `src-tauri/` is already in the repo (stubs: process spawn + `git worktree`). First `tauri:dev` may need icons / full Tauri init polish on your machine — if `tauri.conf.json` complains about icons, add placeholder icons under `src-tauri/icons` or run `npx tauri icon <png>`.

---

## 5. Manual test script (30–40 min)

Do this after UI is up (preview or Tauri). Tick as you go.

### 5.1 Shell & themes

- [ ] App loads Command Center (not blank)
- [ ] Theme toggle: **dark / light / system**
- [ ] Persona switcher: **Operator → Admin → Viewer**
- [ ] Admin persona shows **Admin** tab (users, coupons, credits)

### 5.2 Fleet & layout

- [ ] **NEW** or load **demo fleet**
- [ ] Workspace chips / tree; select different workspaces
- [ ] Drag pane between workspaces
- [ ] Pin coordinator; resize split; **Auto-arrange**
- [ ] Host banner shows mock vs desktop host text

### 5.3 Spawn & Timeline (top-5)

- [ ] After demo load, **Timeline** fills with spawn / status events
- [ ] Host banner **Test spawn** → toast with `job=…`
- [ ] Claude-like panes may flip to **needs_input** (~4–5s in mock)
- [ ] Open **Heat** — path ownership heat
- [ ] Tauri only: process appears for `claude` if CLI installed

### 5.4 Close / worktree safety

- [ ] Pane **⋮ → Close**
- [ ] Confirm dialog warns **destroy worktree / data loss**
- [ ] Confirm → **Destroying…** then pane removed
- [ ] Timeline shows worktree destroy (mock or git)
- [ ] Cancel keeps pane open

### 5.5 Operator suite

- [ ] **Inbox** — jump to needs_input pane
- [ ] **Merge** — dry-run checklist
- [ ] **Handoff** — export markdown (may soft-gate on Hobby)
- [ ] **Diff/PR**, **Runbook** (start / complete step / pause)
- [ ] **MCP** Control Center; **Org MCP** (Team gate)
- [ ] **Mission** — load demo → merge → handoff → claim credits

### 5.6 Soft-gates & ade-api

With ade-api running:

- [ ] Entitlements chip reflects API plan (operator often **pro**)
- [ ] Settings → Billing / Usage not blank
- [ ] Soft-gate modal: spend credit vs **Upgrade** (opens checkout URL)
- [ ] `POST /v1/checkout` mock applies plan when no Stripe key
- [ ] Window focus refreshes entitlements

Without ade-api:

- [ ] UI still works on **demo** entitlements (no brick)
- [ ] Console may log connection refused once — acceptable offline

### 5.7 Wizard & MCP

- [ ] **NEW** wizard: recipe → harness → roles
- [ ] MCP pack preview on spawn path
- [ ] Pane MCP inspector opens from menu if available

### 5.8 Production web build (webview payload)

```bash
npm run typecheck
npm run build
```

- [ ] Build succeeds (required for Tauri embed / Vercel UI artifact if any)

---

## 6. Key code map (where to look)

| Concern | Path |
|---------|------|
| Command shell | `src/components/ade/CommandCenter.tsx` |
| Feature panels (inbox…matrix) | `src/components/ade/FeaturePanels.tsx` |
| Build-path panels (diff, heat…) | `src/components/ade/NextPathPanels.tsx` |
| Close confirm | `src/components/ade/ClosePaneDialog.tsx` |
| Agent bridge | `src/lib/agent-bridge.ts` |
| Status bus | `src/lib/statusBus.ts` |
| Entitlements / soft-gates | `src/lib/entitlementsClient.ts` |
| Tauri host | `src-tauri/src/lib.rs` |
| Capabilities | `src-tauri/capabilities/default.json` |
| Personas / Admin | `personas.ts`, `AdminConsole.tsx` |
| MCP | `mcpConfig.ts`, `McpControlCenter.tsx` |
| Merge / handoff | `mergeGate.ts`, `handoff.ts` |

---

## 7. Doc index (read order for rebuild)

1. **This file** — LOCAL-HANDOVER (you are here)  
2. [DESKTOP-BUILD.md](./DESKTOP-BUILD.md) — Tauri/macOS detail  
3. [BUILD-PATH-V2.md](./BUILD-PATH-V2.md) — top 5 host path just shipped  
4. [ENTITLEMENTS-PROTOCOL.md](./ENTITLEMENTS-PROTOCOL.md) — signed blob contract  
5. [PRD-HANDOVER.md](./PRD-HANDOVER.md) — product requirements (updated summary)  
6. [ADE-API.md](./ADE-API.md) + ade-api README — backend  
7. [RECOMMENDATIONS-CHECKLIST.md](./RECOMMENDATIONS-CHECKLIST.md) — P0–P2 backlog  

---

## 8. Known limitations (do not file as “broken”)

| Area | Reality today |
|------|----------------|
| `npm run dev` | Mock PTY — no real terminal harness |
| Tauri spawn | Process spawn of CLI (`claude`); not full interactive portable-pty yet |
| Worktree destroy | Mock in browser; `git worktree remove` under Tauri |
| Stripe | HMAC path ready; live Checkout Session create still stub without full Stripe wiring |
| Icons / first tauri build | May need icon assets on clean machine |
| Multi-OS | macOS primary; Win/Linux later |

---

## 9. Suggested local workflow day-to-day

```text
Terminal 1:  ade-api (ALLOW_DEV_AUTH=1)
Terminal 2:  npm run dev          ← UI iteration
     or      npm run tauri:dev    ← host + UI
```

1. Change React → HMR in preview  
2. Change `src-tauri` → restart `tauri:dev`  
3. Change ade-api → tsx watch reloads  
4. Before push: `npm run typecheck` (+ `npm test` in ade-api)

---

## 10. Handover sign-off checklist

| Item | Done? |
|------|-------|
| Both repos clone clean | [ ] |
| ade-api `/health` 200 | [ ] |
| UI preview loads Command Center | [ ] |
| Demo fleet + Timeline events | [ ] |
| Close pane destroy confirm works | [ ] |
| Persona Admin tab works | [ ] |
| Soft-gates with API (optional) | [ ] |
| `npm run typecheck` green | [ ] |
| (Optional) `tauri:dev` opens native window | [ ] |
| (Optional) real `claude` spawn under Tauri | [ ] |

When the sign-off list is ticked, local rebuild is validated. Product next phase = Phase 0–1 from the roadmap (real portable-pty, multi-harness adapters, live Stripe).

---

## 11. Contacts / ownership

| Area | Owner note |
|------|------------|
| Product / ADE UX | jtmilan |
| Desktop host (Rust) | Continue in `src-tauri` |
| Billing | ade-api only |
| Support mindset | Soft-gate cloud extras; never brick local worktrees |

**Questions while testing:** capture Timeline screenshot + host banner text (mock vs tauri) + persona + whether ade-api was running — that triad diagnoses most issues.
