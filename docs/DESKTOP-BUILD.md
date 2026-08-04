# Desktop build guide — Agent Command Center (Tauri)

**Product form factor:** native **desktop app** via **Tauri 2**.  
**Primary platform:** **macOS**. Windows and Linux use the same UI + Tauri project with OS-specific prerequisites.

> **This is not a web app for running harnesses.**  
> Cloning and opening the Vite URL only previews the React UI. Terminal agents, worktrees, and local MCP require the **native Tauri host**.

**End-to-end local rebuild + manual test:** **[LOCAL-HANDOVER.md](./LOCAL-HANDOVER.md)**

---

## Architecture reminder

```text
┌──────────────────────────────────────┐
│  React ADE (this repo)               │  UI only in browser
│  embedded in Tauri webview           │
└──────────────────┬───────────────────┘
                   │ IPC (invoke / events)
┌──────────────────▼───────────────────┐
│  Tauri / Rust (src-tauri)            │  spawn, FS, git worktree
│  macOS .app  ·  Win .exe  ·  Linux   │
└──────────────────┬───────────────────┘
                   │ HTTPS
┌──────────────────▼───────────────────┐
│  ade-api (separate repo)             │  billing / entitlements
└──────────────────────────────────────┘
```

| Command | What you get |
|---------|----------------|
| `npm run dev` | Vite UI preview — **mock** agents, no real PTY |
| `npm run tauri:dev` | **Native window** — process spawn + git worktree |
| `npm run tauri:build` | Installable **macOS app** (and other OS targets) |

---

## 1. Clone

```bash
git clone https://github.com/jtmilan/agent-commandcenter.git
cd agent-commandcenter
git pull origin main
```

Optional companion:

```bash
git clone https://github.com/jtmilan/ade-api.git
```

---

## 2. macOS prerequisites

```bash
xcode-select --install   # if missing
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source "$HOME/.cargo/env"
rustc --version
node --version           # >= 20
```

Optional: [Tauri 2 prerequisites — macOS](https://v2.tauri.app/start/prerequisites/).

For **real** Claude spawn under Tauri, also install the Claude Code CLI and ensure `claude` is on `PATH`.

---

## 3. Install JS dependencies

```bash
npm install
npm install -D @tauri-apps/cli@2 @tauri-apps/api@2
```

Scripts (already in `package.json`):

```json
{
  "scripts": {
    "dev": "vite dev --host 0.0.0.0 --port 8080",
    "build": "vite build && npm run db:migrate",
    "typecheck": "tsc --noEmit",
    "tauri": "tauri",
    "tauri:dev": "tauri dev",
    "tauri:build": "tauri build"
  }
}
```

---

## 4. Tauri project (`src-tauri`)

**Already present** in the repo:

| Path | Role |
|------|------|
| `src-tauri/src/lib.rs` | `spawn_agent`, `kill_agent`, `worktree_create`, `worktree_destroy` |
| `src-tauri/tauri.conf.json` | Window + dev URL `http://localhost:8080` |
| `src-tauri/capabilities/default.json` | Deny-by-default core permissions |
| `src-tauri/Cargo.toml` | Tauri 2 crate |

Commands match JS [`src/lib/agent-bridge.ts`](../src/lib/agent-bridge.ts).

If the first build fails on **missing icons**, generate them:

```bash
# Place any 1024x1024 png then:
npx tauri icon path/to/app-icon.png
```

Or add minimal icons under `src-tauri/icons/` per Tauri docs.

---

## 5. Environment (soft-gates)

Create `.env` (Vite) if desired:

```bash
VITE_ADE_API_URL=http://127.0.0.1:8787
VITE_ENTITLEMENTS_VERIFY_SECRET=dev-only-change-me
```

Must match ade-api `ENTITLEMENTS_SIGNING_SECRET` in dev.

---

## 6. Run

```bash
# Terminal A — API (optional but recommended)
cd ../ade-api
ALLOW_DEV_AUTH=1 ENTITLEMENTS_SIGNING_SECRET=dev-only-change-me npm run dev

# Terminal B — UI only
cd agent-commandcenter
npm run dev

# OR native host
npm run tauri:dev
```

Release:

```bash
npm run tauri:build
```

---

## 7. Verify host path

1. Load demo fleet  
2. Timeline shows spawn job events  
3. Close pane → destroy worktree confirm  
4. Under Tauri: `spawn_agent` runs `claude` (if installed)  
5. Under Tauri: destroy uses `git worktree remove`

See manual script in [LOCAL-HANDOVER.md](./LOCAL-HANDOVER.md) §5.

---

## 8. Troubleshooting

| Symptom | Check |
|---------|--------|
| Blank UI | Console errors; `npm run typecheck` |
| No entitlements | ade-api up? `VITE_ADE_API_URL`? |
| Spawn error under Tauri | `which claude`; PATH for GUI apps |
| Worktree destroy fail | Path not under registered root; git available |
| Icon / bundle error | `npx tauri icon …` |
| Port conflict | Vite expects **8080** (tauri.conf `devUrl`) |

---

## 9. Security notes

- Capabilities: start deny-by-default; expand only with need  
- Never embed `STRIPE_*` or webhook secrets in the app  
- Path-scope all worktree destroy/create to known project roots  
