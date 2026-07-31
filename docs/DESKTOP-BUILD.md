# Desktop build guide — Agent Command Center (Tauri)

**Product form factor:** native **desktop app** via **Tauri 2**.  
**Primary platform:** **macOS**. Windows and Linux use the same UI + Tauri project with OS-specific prerequisites.

> **This is not a web app for running harnesses.**  
> Cloning and opening `localhost` only previews the React UI. Terminal agents, worktrees, and local MCP require the **native Tauri host**.

---

## Architecture reminder

```text
┌──────────────────────────────────────┐
│  React ADE (this repo)               │  UI only in browser
│  embedded in Tauri webview           │
└──────────────────┬───────────────────┘
                   │ IPC (invoke / events)
┌──────────────────▼───────────────────┐
│  Tauri / Rust (src-tauri)            │  spawn, PTY, FS, git, MCP
│  macOS .app  ·  Win .exe  ·  Linux   │
└──────────────────┬───────────────────┘
                   │ HTTPS
┌──────────────────▼───────────────────┐
│  ade-api (separate repo)             │  billing only
└──────────────────────────────────────┘
```

| Command | What you get |
|---------|----------------|
| `npm run dev` | Vite UI preview — **mock** agents, no real PTY |
| `npm run tauri dev` | **Native window** — path for real harness integration |
| `npm run tauri build` | Installable **macOS app** (and other OS targets) |

---

## 1. Clone

```bash
git clone https://github.com/jtmilan/agent-commandcenter.git
cd agent-commandcenter
```

---

## 2. macOS prerequisites

Install once on the machine that will build the app:

```bash
# Xcode CLT (if missing)
xcode-select --install

# Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source "$HOME/.cargo/env"
rustc --version

# Node 20+
node --version   # should be >= 20
```

Optional: read [Tauri 2 prerequisites — macOS](https://v2.tauri.app/start/prerequisites/).

---

## 3. Install JS dependencies

```bash
npm install
npm install -D @tauri-apps/cli@2 @tauri-apps/api@2
```

Add scripts to `package.json` if not already present:

```json
{
  "scripts": {
    "dev": "vite dev --host 0.0.0.0 --port 8080",
    "build": "vite build",
    "tauri": "tauri",
    "tauri:dev": "tauri dev",
    "tauri:build": "tauri build"
  }
}
```

---

## 4. Tauri project (`src-tauri`)

If `src-tauri/` is **not** in the repo yet (UI-first phase):

```bash
npx tauri init
```

Recommended answers:

- App name: **Agent Command Center**  
- Window title: **Agent Command Center**  
- Dev URL: `http://localhost:8080` (match Vite)  
- Frontend dist: path produced by `vite build` (often `dist` / `.output/public` — align with this repo’s Vite config)

Then implement plugins as documented in [ASYNC-CAPABILITIES.md](./ASYNC-CAPABILITIES.md):

- `agent-bridge` — spawn / attach  
- `worktree` — create / destroy (with confirm)  
- `mcp-inject`  
- `entitlements` — cache signed blob from ade-api  
- `billing` — open Checkout URL in system browser only  

**Capability rule:** deny-by-default; never put Stripe secrets in the app.

---

## 5. Run native (macOS)

```bash
# Terminal A not required if tauri starts Vite for you;
# with this repo you may run UI and host:

npm run dev          # if tauri.json points at external dev server
npm run tauri dev    # or: npx tauri dev
```

You should see a **native macOS window**, not only a browser tab.

---

## 6. Build installable macOS app

```bash
npm run build
npx tauri build
```

Artifacts (typical):

```text
src-tauri/target/release/bundle/macos/Agent Command Center.app
src-tauri/target/release/bundle/dmg/*.dmg
```

Distribute the **`.app` / `.dmg`** to operators. Do **not** tell them “open the website to run harnesses.”

### Code signing / notarization (release)

For outside-your-machine distribution on macOS, configure Apple Developer signing and notarization per [Tauri macOS distribution](https://v2.tauri.app/distribute/macos-application-bundle/). Required for smooth Gatekeeper installs.

---

## 7. Windows & Linux (same repo, later)

Same codebase; different host toolchain:

| OS | Notes |
|----|--------|
| Windows | MSVC Build Tools, WebView2 |
| Linux | `webkit2gtk`, `libssl`, etc. (see Tauri docs) |

```bash
npx tauri build   # on that OS CI runner or machine
```

---

## 8. Pair with ade-api (billing only)

```bash
git clone https://github.com/jtmilan/ade-api.git
cd ade-api && cp .env.example .env && npm i && npm run dev
# http://127.0.0.1:8787
```

Desktop app calls entitlements/checkout over HTTPS. It does **not** host Stripe webhooks.

---

## 9. What contributors should not do

| Don’t | Do instead |
|-------|------------|
| Deploy Vite build to Vercel as the “ADE product” for agents | Ship Tauri `.app` |
| Expect browser tabs to spawn Claude/Codex | Use Tauri `invoke` + PTY |
| Put `STRIPE_SECRET_KEY` in the app | Use `ade-api` |
| Document only `npm run dev` as setup | Lead with `tauri dev` / `tauri build` |

---

## 10. Checklist after clone

- [ ] Rust + Xcode CLT installed (macOS)  
- [ ] `npm install`  
- [ ] Tauri CLI available  
- [ ] `src-tauri` present or initialized  
- [ ] `npx tauri dev` opens **native** window  
- [ ] Understand UI preview ≠ harness runtime  
- [ ] Read [PRD-HANDOVER.md](./PRD-HANDOVER.md) for product scope  

---

*Primary product: **Tauri native macOS app**. Web is UI tooling only.*
