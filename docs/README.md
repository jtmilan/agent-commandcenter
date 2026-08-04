# ADE product documentation index

Handover pack for **Agent Command Center** — a **Tauri native desktop** product (macOS first), not a web-hosted harness runner.

| Document | Description |
|----------|-------------|
| **[LOCAL-HANDOVER.md](./LOCAL-HANDOVER.md)** | **★ Start here — clone, rebuild, manual test script** |
| **[DESKTOP-BUILD.md](./DESKTOP-BUILD.md)** | Tauri / macOS build detail |
| **[PRD-HANDOVER.md](./PRD-HANDOVER.md)** | Product requirements v2 + status |
| **[BUILD-PATH-V2.md](./BUILD-PATH-V2.md)** | Immediate top 5 (Claude, destroy, bus, API, soft-gates) |
| **[BUILD-PATH.md](./BUILD-PATH.md)** | Build path v1 (bridge → team → mission) |
| **[ENTITLEMENTS-PROTOCOL.md](./ENTITLEMENTS-PROTOCOL.md)** | Signed entitlements + soft-gate contract |
| [PERSONA-CONSOLE.md](./PERSONA-CONSOLE.md) | Admin / operator / viewer personas |
| [WIRE-PERSONA.md](./WIRE-PERSONA.md) | Persona wire notes |
| [ADE-API.md](./ADE-API.md) | Companion backend [`jtmilan/ade-api`](https://github.com/jtmilan/ade-api) |
| [GROWTH-ENGAGEMENT-API.md](./GROWTH-ENGAGEMENT-API.md) | Coupons, credits, campaigns, engagement |
| [ASYNC-CAPABILITIES.md](./ASYNC-CAPABILITIES.md) | Tauri capability JSON/TOML + async layers |
| [HMAC-WEBHOOK-VERIFICATION.md](./HMAC-WEBHOOK-VERIFICATION.md) | Stripe HMAC (ade-api only) |
| [RECOMMENDATIONS-CHECKLIST.md](./RECOMMENDATIONS-CHECKLIST.md) | Prioritized P0–P2 checklist |
| [ARCHITECTURE-ANALYSES.md](./ARCHITECTURE-ANALYSES.md) | Five skill-tagged analyses |

## In-app

**Settings (⌘,)** → **Architecture** / **API & delivery** / **HMAC & async**  
**Features strip** → Mission · Heat · Timeline · Diff/PR · Runbook · Team Q · Org MCP  
**Persona** → Admin for coupons/users/credits  

## Start here (new engineer / local rebuild)

1. **[LOCAL-HANDOVER.md](./LOCAL-HANDOVER.md)** — clone both repos, run API + UI, tick manual tests  
2. **[DESKTOP-BUILD.md](./DESKTOP-BUILD.md)** — Tauri native, not web-only  
3. Pair with ade-api for billing only  
