# Capabilities, configuration syntax & asynchronous processing

**Product:** harness-ready Agent Command Center (ADE)  
**Audience:** engineers implementing Tauri plugins + `ade-api` workers  
**Status:** specification for product integration (mock UI exists; native plugins pending)

---

## 1. Capability model (Tauri v2)

### Trust boundary

| Zone | Trust | Access |
|------|--------|--------|
| WebView (React ADE) | **Untrusted** | Only IPC commands allowed by capabilities |
| Rust core + plugins | **Trusted** | OS, processes, FS (must self-enforce scopes) |
| `ade-api` | **Trusted server** | Stripe secrets, webhooks, entitlements DB |

Commands are **denied by default**. A capability file grants named permissions to labeled windows.

### Capability file syntax (JSON)

Path: `src-tauri/capabilities/main.json` (illustrative)

```json
{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "main-capability",
  "description": "Primary ADE Command Center window",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "core:event:allow-listen",
    "core:event:allow-emit",

    "agent-bridge:allow-spawn",
    "agent-bridge:allow-attach",
    "agent-bridge:allow-list",
    "agent-bridge:deny-raw-shell",

    "worktree:allow-create",
    "worktree:allow-status",
    "worktree:allow-destroy-confirm",

    "mcp:allow-resolve-config",
    "mcp:allow-inject-spawn",

    "entitlements:allow-read-cache",
    "entitlements:allow-refresh",

    "billing:allow-open-checkout",
    "billing:allow-open-portal",

    {
      "identifier": "fs:scope",
      "allow": [
        { "path": "$HOME/**/.agent-teams-worktrees/**" },
        { "path": "$APPLOCALDATA/ade/**" }
      ]
    },
    {
      "identifier": "http:default",
      "allow": [
        { "url": "https://api.yourdomain.com/**" }
      ]
    }
  ]
}
```

### Plugin permission file syntax

Path: `src-tauri/plugins/agent-bridge/permissions/default.toml` (illustrative)

```toml
[[permission]]
identifier = "allow-spawn"
description = "Spawn a harness process into a worktree"
commands.allow = ["spawn_agent"]

[[permission]]
identifier = "allow-attach"
description = "Attach UI pane to running agent PTY"
commands.allow = ["attach_agent"]

[[permission]]
identifier = "deny-raw-shell"
description = "Explicit deny documentation — no unrestricted shell"
commands.deny = ["exec_raw"]

[default]
description = "Safe defaults for ADE"
permissions = ["allow-list", "allow-attach"]
# Note: allow-spawn is NOT in default — require explicit capability grant
```

### Mapping ADE UI → permissions

| UI action | Command | Permission | Async? |
|-----------|---------|------------|--------|
| NEW wizard create | `spawn_agent` | `agent-bridge:allow-spawn` | Yes (job) |
| Pane close confirm | `destroy_worktree` | `worktree:allow-destroy-confirm` | Yes |
| MCP Control Center save | `write_mcp_config` | `mcp:allow-resolve-config` | No (local) |
| Settings → Manage subscription | `open_checkout` | `billing:allow-open-checkout` | No (browser) |
| Focus app / deep link | `refresh_entitlements` | `entitlements:allow-refresh` | Yes (HTTP) |
| Merge gate dry-run | pure TS / optional `git_status` | `worktree:allow-status` | Parallel |

---

## 2. Asynchronous processing model

ADE and `ade-api` use **three async layers**. Do not block UI or webhook HTTP threads on long work.

### Layer A — Desktop UI (React)

| Mechanism | Use |
|-----------|-----|
| React state + effects | Local layout, pins, MCP registry (mock: localStorage) |
| `invoke()` promises | One-shot Tauri commands |
| Tauri events (`listen`) | Stream agent logs, spawn progress, entitlement updates |
| Web Workers (optional) | Heavy pack/layout math if main thread janks |

**Rule:** Never await multi-minute agent work on the click handler; show pane status `starting` → `working`.

### Layer B — Rust plugin jobs

```text
UI invoke(spawn_agent)
    → validate capability + path scope
    → enqueue Job in managed State<JobQueue>
    → return { job_id, pane_id } immediately
    → background task: create worktree, spawn process
    → emit("agent://status", { pane_id, status })
```

Illustrative Rust shape:

```rust
#[tauri::command]
async fn spawn_agent(
    app: AppHandle,
    state: State<'_, JobQueue>,
    req: SpawnRequest,
) -> Result<SpawnAccepted, String> {
    // sync validation only
    validate_scope(&req.worktree)?;
    let job_id = state.enqueue(Job::Spawn(req.clone()));
    // async work continues on runtime
    tauri::async_runtime::spawn(async move {
        let result = do_spawn(req).await;
        let _ = app.emit("agent://status", result);
    });
    Ok(SpawnAccepted { job_id })
}
```

### Layer C — `ade-api` webhooks & workers

```text
POST /webhooks/stripe
    → verify HMAC (sync, fail fast)
    → INSERT event_id idempotent (sync)
    → enqueue OutboxJob (sync commit)
    → return 200 quickly
Worker
    → recompute entitlements
    → mark event processed
```

| Pattern | Spec |
|---------|------|
| **Idempotency** | Unique `event.id` primary key |
| **Ack latency** | Target < 2s to 2xx |
| **Ordering** | After event, optional Stripe API re-fetch for subscription |
| **Retries** | Provider retries on 5xx; handler must tolerate duplicates |
| **DLQ** | After N failures, human replay |

### Event naming convention (desktop)

```text
agent://status          { paneId, status, detail? }
agent://log             { paneId, line }
worktree://changed      { paneId, gitClean, branch }
entitlements://updated  { planId, exp, features[] }
billing://deep-link     { status: "success"|"cancel" }
mcp://probe-result      { serverId, status }
```

---

## 3. Configuration surfaces (product)

| Store | Location | Sync |
|-------|----------|------|
| Theme | `localStorage` `hr-ade-theme` | Immediate |
| MCP config | `localStorage` `hr-ade-mcp-config-v1` | Immediate; later project file |
| Recipes / layouts | `localStorage` | Immediate |
| Entitlements cache | `$APPLOCALDATA/ade/entitlements.json` (signed) | Refresh async |
| Capability files | shipped in binary | Build-time only |

### Async entitlement refresh sequence

```text
1. App focus / deep-link billing return
2. invoke("refresh_entitlements")  // network
3. Verify signature of payload
4. Write cache file
5. emit entitlements://updated
6. React soft-gates re-render
```

---

## 4. Anti-patterns

- Holding Stripe webhook open while sending email or calling 5 services  
- Running `git` destroy on UI thread without confirm + capability  
- Putting webhook secrets in Tauri env for “convenience”  
- Fake async: `setTimeout` to pretend usage is live for `state_blind` harnesses  
- Capability `"*"` or enabling all shell permissions in default set  

---

## 5. Related docs

- [HMAC-WEBHOOK-VERIFICATION.md](./HMAC-WEBHOOK-VERIFICATION.md)  
- [RECOMMENDATIONS-CHECKLIST.md](./RECOMMENDATIONS-CHECKLIST.md)  
- [PRD-HANDOVER.md](./PRD-HANDOVER.md)  
- [ARCHITECTURE-ANALYSES.md](./ARCHITECTURE-ANALYSES.md)  
