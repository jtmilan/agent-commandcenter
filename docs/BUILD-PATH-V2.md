# Build path v2 — Immediate top 5 (shipped)

Implements the roadmap’s **immediate top 5** after mock build path v1.

| # | Item | Status |
|---|------|--------|
| **1** | Claude spawn via agent-bridge + `job_id` events | Done (mock PTY lifecycle + Tauri process spawn) |
| **2** | Worktree destroy wired to close dialog | Done (async confirm → kill job → path-scoped destroy) |
| **3** | Status bus from host (exit / needs_input / tool_fail) | Done (`subscribeHostEvents` → panes + Timeline) |
| **4** | ade-api Checkout + HMAC webhook + signed `/entitlements` | Done (verify route + mock checkout applies plan) |
| **5** | Soft-gates from signed blob | Done (`refreshEntitlementsFromApi` + Web Crypto HMAC) |

---

## 1. Claude spawn + job events

| Piece | Path |
|-------|------|
| JS bridge | [`src/lib/agent-bridge.ts`](../src/lib/agent-bridge.ts) |
| Rust host | [`src-tauri/src/lib.rs`](../src-tauri/src/lib.rs) |
| Wire-up | `CommandCenter` loadDemo → `spawnClaude` / `spawnAgent` |

**Events:** `spawn_queued` → `spawn_starting` → `spawn_running` → (`needs_input` \| `tool_fail`) → `exit`  
Mirrored on status bus for **Timeline**. Host banner: **Test spawn** uses Claude.

Web: honest mock timers.  
Desktop: `Command::new("claude")` (+ env `ADE_JOB_ID`, `ADE_PANE_ID`).

---

## 2. Close → destroy worktree

| Piece | Path |
|-------|------|
| Dialog | [`ClosePaneDialog.tsx`](../src/components/ade/ClosePaneDialog.tsx) |
| Grid | async `onConfirm` awaits destroy result |
| Action | `closePane` → `killPaneAgent` → `destroyWorktree({ force, paneId })` |

Path scoping: `registerWorktreeRoot` + `isPathScoped`.  
Tauri: `git worktree remove [--force]`.

---

## 3. Status bus from host

| Piece | Path |
|-------|------|
| Bus | [`src/lib/statusBus.ts`](../src/lib/statusBus.ts) |
| Host emit | `emitHost` inside agent-bridge |
| UI | `subscribeHostEvents` updates pane `status` / `attention` / `lastToolFailure` |

Honest telemetry: Claude → `live` hooks; limited harnesses stay `state_blind`.

---

## 4. ade-api billing surface

Repo: [`jtmilan/ade-api`](https://github.com/jtmilan/ade-api)

| Endpoint | Notes |
|----------|--------|
| `GET /v1/entitlements` | Signed blob `{ entitlements, payloadJson, sig }` |
| `POST /v1/entitlements/verify` | Server HMAC check |
| `POST /v1/checkout` | Mock applies plan when no Stripe key |
| `POST /v1/webhooks/stripe` | Raw body + HMAC (existing) |
| `GET /v1/public/config` | Algorithm + path hints |

Feature flags on plans now include `feature.broadcast`, `feature.runbook`, `feature.org_mcp`, `feature.shared_inbox`.

---

## 5. Soft-gates from signed blob

| Piece | Path |
|-------|------|
| Client | [`src/lib/entitlementsClient.ts`](../src/lib/entitlementsClient.ts) |
| Verify | Web Crypto HMAC-SHA256 vs `VITE_ENTITLEMENTS_VERIFY_SECRET` (default `dev-only-change-me`) |
| Refresh | On persona change + window focus |
| UI | SoftGateModal → `startCheckout` opens system browser URL |

Sources: `demo` \| `api` \| `api_unverified` \| `cache`.  
**Never bricks local worktrees** if API is down.

---

## Try it

1. Load demo fleet → Timeline fills with spawn jobs; Claude panes may flip to needs_input  
2. Pane ⋮ → Close → confirm destroy (busy state)  
3. Run ade-api (`ALLOW_DEV_AUTH=1 npm run dev`) → entitlements chip refreshes from API  
4. Soft-gate Handoff / Runbook on Hobby → Upgrade calls checkout  
5. Tauri: `npm run tauri:dev` for real process spawn  

Env (desktop / Vite):

```bash
VITE_ADE_API_URL=http://127.0.0.1:8787
VITE_ENTITLEMENTS_VERIFY_SECRET=dev-only-change-me
```

---

## Still open (next phases)

- portable-pty (true interactive terminal)  
- Stripe live Checkout Session create  
- Asymmetric entitlements sig (vs shared HMAC)  
- Multi-harness adapters beyond Claude first-class  
