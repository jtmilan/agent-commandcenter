# Agent notes — Agent Command Center

## Product form factor

- **Ship as Tauri native desktop** (macOS primary; Windows/Linux same repo).
- **Not** a web app for running terminal harnesses.
- `npm run dev` = UI preview only. Real PTY/worktrees/MCP = Tauri host.

## Docs to follow

1. [docs/DESKTOP-BUILD.md](docs/DESKTOP-BUILD.md) — clone & build instructions  
2. [docs/PRD-HANDOVER.md](docs/PRD-HANDOVER.md) — product handover  
3. Companion API: https://github.com/jtmilan/ade-api  

## When changing the repo

- Keep README leading with **Tauri / macOS**, not “open localhost as the product.”
- Never document Stripe secrets inside the desktop app.
