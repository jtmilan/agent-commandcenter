# Agent Command Center

**ADE (Agent Development Environment)** — multi-harness operator UI for running Claude, Cursor, Codex, Grok, and other coding agents in workspace-scoped fleets.

Repository: [`jtmilan/agent-commandcenter`](https://github.com/jtmilan/agent-commandcenter)

> Interactive product proposal + implementation of Command Center surfaces, MCP configuration, merge gate, session handoff, themes, settings/billing mocks, and architecture docs for Tauri + a separate `ade-api`.

---

## Features

- **Command Center** — workspace tree, multi-pane fleet, drag-and-drop between workspaces  
- **Sub-linear layout** — pin column, focus grid, stack overflow, resize, auto-arrange  
- **Safety** — worktree destroy confirmation on pane close  
- **Wizard** — recipe-first setup + MCP spawn preview  
- **MCP Control Center** — single config for all harnesses (matrix, presets, pack export)  
- **Operator suite** — attention inbox, ownership map, telemetry, broadcast, merge gate, handoff v2, layouts, capability matrix  
- **Appearance** — dark / light / system themes (AA contrast)  
- **Settings** — Appearance cards, Billing/Usage mocks, Architecture + HMAC docs  

## Docs

| Document | Description |
|----------|-------------|
| [docs/PRD-HANDOVER.md](docs/PRD-HANDOVER.md) | Product requirements & engineering handover |
| [docs/ASYNC-CAPABILITIES.md](docs/ASYNC-CAPABILITIES.md) | Tauri capabilities + async processing |
| [docs/HMAC-WEBHOOK-VERIFICATION.md](docs/HMAC-WEBHOOK-VERIFICATION.md) | Stripe webhook HMAC examples |
| [docs/RECOMMENDATIONS-CHECKLIST.md](docs/RECOMMENDATIONS-CHECKLIST.md) | P0–P2 integration checklist |
| [docs/ARCHITECTURE-ANALYSES.md](docs/ARCHITECTURE-ANALYSES.md) | Five skill-tagged analyses |

## Quick start

```bash
npm install
npm run dev        # http://0.0.0.0:8080
npm run typecheck
npm run build
```

Or:

```bash
sh startup.sh
```

## Stack

React 19 · TypeScript · Vite · TanStack Start/Router · Tailwind v4 · Lucide  

Target desktop shell: **Tauri** (plugins + capabilities documented; native bindings next).  
Billing webhooks: separate **`ade-api`** repo (never put Stripe secrets in the desktop app).

## Product navigation (in app)

- **Open demo** — sample multi-agent fleet  
- **Features strip** — Inbox, Paths, Recipes, Telemetry, Broadcast, Merge, Handoff, Layouts, Matrix, MCP  
- **Settings (⌘,)** — Appearance · Billing · Usage · Architecture · HMAC & async  
- **⌘K** — command palette  

## License

Private / product proposal unless otherwise noted by owner.

## Related

- Upstream research may live in `jtmilan/harness-ready`  
- Planned: `ade-api` for entitlements + Stripe webhooks  
