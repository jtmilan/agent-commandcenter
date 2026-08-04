# Build path shipped — Agent Command Center

Implements the next-product path: host bridge → status/entitlements → operator tools → team → activation.

## 1. Tauri agent-bridge + worktree safety

| Piece | Location |
|-------|----------|
| JS client | [`src/lib/agent-bridge.ts`](../src/lib/agent-bridge.ts) |
| Rust stubs | [`src-tauri/src/lib.rs`](../src-tauri/src/lib.rs) |
| Capabilities | [`src-tauri/capabilities/default.json`](../src-tauri/capabilities/default.json) |

Commands: `spawn_agent`, `kill_agent`, `worktree_create`, `worktree_destroy`  
Path scoping: `registerWorktreeRoot` + `isPathScoped` before destroy.  
Web preview: honest **mock** spawn (banner in UI).

## 2. Status bus + entitlements soft-gate

| Piece | Location |
|-------|----------|
| Event bus | [`src/lib/statusBus.ts`](../src/lib/statusBus.ts) |
| Entitlements | [`src/lib/entitlementsClient.ts`](../src/lib/entitlementsClient.ts) |
| Soft gate UI | `SoftGateModal` in NextPathPanels |

Dual CTA: spend credit vs upgrade; never brick local worktrees.

## 3. Diff/PR + runbook

Feature strip: **Diff/PR**, **Runbook**  
Panels in [`NextPathPanels.tsx`](../src/components/ade/NextPathPanels.tsx).

## 4. Conflict heat map + session timeline

**Heat** · **Timeline** — live path collisions + scrubable session log.

## 5. Team: org MCP + shared inbox

**Org MCP** · **Team Q** — Team soft-gates via entitlements.

## 6. Welcome mission + credit soft-gates

**Mission** + handoff/broadcast/runbook gates.

## Persona console

Header **persona** select → Admin tab → [`AdminConsole.tsx`](../src/components/ade/AdminConsole.tsx).

## Try in preview

1. Open demo fleet  
2. Features strip → Mission / Heat / Timeline / Diff/PR / Runbook  
3. Persona → Admin  
4. Host banner → Test spawn / Test destroy  
5. Switch plan to Hobby in Settings → try Handoff (soft-gate)

## Desktop next

```bash
npm run tauri:dev   # after Rust + src-tauri fully init
```

Implement real PTY in `spawn_agent` and `git worktree` in worktree_* commands.

---

## v2 immediate top 5 — **done**

See **[BUILD-PATH-V2.md](./BUILD-PATH-V2.md)** for Claude spawn, close→destroy, host status bus, ade-api signed entitlements, and soft-gates.
