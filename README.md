# Agent Command Center

**ADE (Agent Development Environment)** — multi-harness operator for Claude, Cursor, Codex, Grok, and other coding agents.

**Repository:** [`jtmilan/agent-commandcenter`](https://github.com/jtmilan/agent-commandcenter)

---

## Important: this is a **native desktop app**, not a web product

| | |
|---|---|
| **Product target** | **Tauri native app** (macOS first; Windows & Linux next) |
| **Why not web-only?** | Terminal harnesses need local PTY, filesystem, git worktrees, and MCP `stdio` — browsers cannot spawn them |
| **What `npm run dev` is** | **UI-only** Vite preview for layout/features — **not** a production harness host |
| **Real harnesses** | Only when running inside **Tauri** (`src-tauri` + `agent-bridge` plugins) |

If you clone this repo expecting a website that runs agents in the cloud: **that is not the architecture.**  
Ship and use the **macOS (or other desktop) app** built with Tauri.

Billing/API stays separate: [`jtmilan/ade-api`](https://github.com/jtmilan/ade-api) (no Stripe secrets in the desktop binary).

→ Full clone & build steps: **[docs/DESKTOP-BUILD.md](docs/DESKTOP-BUILD.md)**

---

## Features (UI + planned host)

- **Command Center** — workspace tree, multi-pane fleet, drag-and-drop  
- **Sub-linear layout** — pin, focus grid, stack, resize, auto-arrange  
- **Safety** — worktree destroy confirmation on pane close  
- **Wizard** — recipe-first setup + MCP spawn preview  
- **MCP Control Center** — single config for all harnesses  
- **Operator suite** — inbox, ownership, telemetry, broadcast, merge gate, handoff, layouts, matrix  
- **Themes** — dark / light / system  
- **Settings** — Appearance, Billing/Usage mocks, architecture docs  

---

## Prerequisites (native app)

### macOS (primary)

- macOS 12+ (Apple Silicon or Intel)  
- [Xcode Command Line Tools](https://developer.apple.com/xcode/)  
- [Rust](https://rustup.rs/) stable  
- Node.js 20+  
- npm  

### Optional later

- Windows 10/11 + MSVC build tools  
- Linux (webkit2gtk deps) — see [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/)  

---

## Clone & build (Tauri / macOS)

```bash
git clone https://github.com/jtmilan/agent-commandcenter.git
cd agent-commandcenter
npm install

# Install Tauri CLI (once)
npm install -D @tauri-apps/cli@2
# or: cargo install tauri-cli --version "^2"

# Scaffold native shell if src-tauri is not present yet:
# npm run tauri init   # only when setting up from scratch

# Dev: native window (preferred for product work)
npm run tauri dev

# Release .app / dmg (macOS)
npm run tauri build
```

Expected outcome of `tauri build` on Mac: a **native `.app`** (and optional DMG), not a deployable SPA for hosting harnesses on a server.

### UI-only preview (design / HMR — no real harnesses)

```bash
npm run dev          # Vite on port 8080 — mock fleet only
npm run typecheck
npm run build        # web bundle for embedding in Tauri webview
```

Use `npm run dev` to iterate on React UI. Use **`npm run tauri dev`** when you need the desktop host path.

---

## Stack

| Layer | Tech |
|-------|------|
| UI | React 19 · TypeScript · Vite · TanStack · Tailwind v4 |
| **Desktop host** | **Tauri 2** (Rust plugins, capabilities, IPC) |
| Billing API | [`ade-api`](https://github.com/jtmilan/ade-api) (separate repo) |

---

## Docs

| Document | Description |
|----------|-------------|
| **[docs/DESKTOP-BUILD.md](docs/DESKTOP-BUILD.md)** | **Clone, Tauri, macOS build (start here)** |
| [docs/ADE-API.md](docs/ADE-API.md) | Companion backend repo |
| [docs/PRD-HANDOVER.md](docs/PRD-HANDOVER.md) | Product handover |
| [docs/ASYNC-CAPABILITIES.md](docs/ASYNC-CAPABILITIES.md) | Capabilities + async host model |
| [docs/HMAC-WEBHOOK-VERIFICATION.md](docs/HMAC-WEBHOOK-VERIFICATION.md) | Webhook HMAC (ade-api only) |
| [docs/RECOMMENDATIONS-CHECKLIST.md](docs/RECOMMENDATIONS-CHECKLIST.md) | Integration checklist |
| [docs/ARCHITECTURE-ANALYSES.md](docs/ARCHITECTURE-ANALYSES.md) | Plugin / security analyses |

---

## Product navigation (in app)

- **Open demo** — sample multi-agent fleet (mock until host wired)  
- **Features strip** — Inbox → MCP  
- **Settings (⌘,)** — Appearance · Billing · Architecture  
- **⌘K** — command palette  

---

## Related

- [`jtmilan/ade-api`](https://github.com/jtmilan/ade-api) — Stripe webhooks, entitlements, usage  
- Upstream research may live in `jtmilan/harness-ready`  

## License

Private / product terms unless otherwise noted by owner.
