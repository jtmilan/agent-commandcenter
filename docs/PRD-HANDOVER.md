# Product Requirements & Handover Document  
## Agent Command Center (ADE) — harness-ready UI proposal

| Field | Value |
|-------|--------|
| **Product name** | Agent Command Center / ADE (Agent Development Environment) |
| **Codebase context** | Interactive UI proposal for [harness-ready](https://github.com/jtmilan/harness-ready) patterns |
| **Document type** | PRD + engineering handover |
| **Version** | 1.0 |
| **Date** | 2026-07-31 |
| **Status** | UI complete as proposal; **product is Tauri native (macOS first)** — see docs/DESKTOP-BUILD.md; host plugins + ade-api wiring ongoing |
| **Primary users** | Operators running multi-agent harness fleets (Claude, Cursor, Codex, Grok, Pi, bash, …) |

---

## 1. Problem statement

Teams orchestrating multiple AI coding harnesses need a **local-first command center** that:

- Groups agents by **workspace** (not a flat pane soup)  
- Makes **attention** (needs_input / blocked / errors) findable  
- Respects **honest telemetry** (no fake “live” for state-blind CLIs)  
- Supports **MCP** configuration in one place  
- Prepares a path to **paid subscriptions** without putting payment secrets in the desktop app  

Existing UIs felt non-intuitive; this proposal re-centers on workspace containment, recipe-first setup, and operator safety (worktree destroy warnings).

---

## 2. Goals & non-goals

### Goals

1. Demo-quality **Command / Monitoring / Context** surfaces  
2. Workspace tree, multi-harness panes, drag-and-drop, pin, resize, auto-arrange  
3. Wizard + recipes for agent/harness/role selection  
4. Feature suite: inbox, ownership, recipes, telemetry, broadcast, merge gate, handoff, presets, matrix, MCP  
5. Theme system (dark / light / system) with AA contrast  
6. Settings with Appearance cards + Billing / Usage mocks  
7. Architecture docs: Tauri plugins, capabilities, async, HMAC webhooks  
8. Clear **handover** so other harness products can reuse engines  

### Non-goals (this phase)

- Real Stripe charges or production `ade-api` deployment  
- Real PTY / process spawn (UI mock only)  
- Multiplayer / multi-operator realtime  
- Mobile-native ADE (responsive web preview only)  

---

## 3. Personas

| Persona | Need |
|---------|------|
| **Solo operator** | Fast recipe spawn, clear attention, safe close |
| **Multi-agent power user** | Path ownership, merge gate, handoff pack |
| **Team lead (future)** | Seats, usage, shared MCP policies |
| **Harness engineer** | Capability matrix, honest state_blind labels |

---

## 4. Product architecture (target)

```text
┌─────────────────────────────────────────┐
│  harness-ready / ADE (Tauri + React)    │
│  - Command Center UI                    │
│  - Plugins: agent-bridge, worktree,     │
│    mcp-inject, entitlements, billing    │
│  - Local MCP + worktrees                │
└──────────────────┬──────────────────────┘
                   │ JWT + entitlements
                   ▼
┌─────────────────────────────────────────┐
│  ade-api (separate repo)                │
│  - Auth, Stripe, webhooks (HMAC)        │
│  - Entitlements, usage                  │
└─────────────────────────────────────────┘
```

**Trust rule:** Webhook secrets never ship in the desktop binary.

---

## 5. Completed deliverables (this workspace)

### 5.1 Core shell

| Deliverable | Location / notes |
|-------------|------------------|
| Command Center app | `src/components/ade/CommandCenter.tsx` |
| Tabs: Command, Monitoring, Context | Theme docs + product links on Context |
| Feature strip launchers | Inbox → MCP |
| Keyboard palette, hints (`?`, ⌘K, ⌘N, ⌘,) | Palette v2 |
| Settings panel | Appearance theme cards, Billing, Usage, API, Architecture |

### 5.2 Workspace & panes

| Deliverable | Notes |
|-------------|--------|
| Workspace tree + sub-workspaces | `layout.ts` `workspaceTree` |
| Multi-harness per workspace | Demo fleet in `data.ts` |
| HTML5 DnD between workspaces | Directory + pane move |
| Sub-linear pack | Pins / focus (cap) / stack |
| Pin (user + auto coordinator) | Pane menu + directory |
| Resizable panes + auto-arrange | `PaneGrid.tsx` |
| Close → worktree destroy warning | `ClosePaneDialog.tsx` |
| Pane menu | Rename, pin, max, copy id/branch, move, MCP, close |

### 5.3 Wizard & recipes

| Deliverable | Notes |
|-------------|--------|
| 4-step wizard | Start → Layout → Agents → **MCP** |
| Recipe cards | Solo, pair, trio, scout-build |
| MCP spawn preview | Snapshot servers/tools onto panes |
| Recipe library panel | localStorage store |

### 5.4 MCP

| Deliverable | Notes |
|-------------|--------|
| Control Center | Servers, harness matrix, presets, export pack |
| `mcpConfig.ts` | Bindings, role policy, drift detection |
| Pane inspector | ⋮ → MCP tools |
| Merge gate MCP checks | required / forbidden / health |
| Handoff MCP section | markdown v2 |

### 5.5 Operator features (10 + MCP)

| # | Feature | Module |
|---|---------|--------|
| 1 | Attention inbox | FeaturePanels |
| 2 | Path ownership map | + resolve sole owner |
| 3 | Recipe library | localStorage |
| 4 | Honest telemetry drawer | state_blind honesty |
| 5 | Broadcast composer | multi-pane |
| 6 | Merge gate checklist | `mergeGate.ts` |
| 7 | Session handoff pack | `handoff.ts` v2 |
| 8 | Command palette v2 | features + theme |
| 9 | Layout presets | per workspace path |
| 10 | Harness capability matrix | registry UI |
| + | MCP Control Center | full |

### 5.6 Merge, conflicts, handoff

- Severities: block / warn / info  
- Conflicts: path, branch, attention, dirty, role, telemetry, **mcp**  
- Dry-run only (no git mutation)  
- Handoff markdown sections 1–7 + MCP pack  

### 5.7 Appearance & a11y

- Tokens via CSS custom properties (`styles.css`)  
- Dark / light / system (`theme.ts`, FOUC-safe init)  
- Contrast audit + AA fixes for light accent/subtle  
- Theme docs + copyable toggle snippet  

### 5.8 Subscription (mock)

- Plans: Hobby / Pro / Team (`subscription.ts`)  
- Billing cards, usage meters  
- API contract for separate repo  
- Soft-gate philosophy documented  

### 5.9 Engineering analyses & docs

| Doc | Purpose |
|-----|---------|
| [ARCHITECTURE-ANALYSES.md](./ARCHITECTURE-ANALYSES.md) | 5 skill-tagged analyses |
| [ASYNC-CAPABILITIES.md](./ASYNC-CAPABILITIES.md) | Capability syntax + async layers |
| [HMAC-WEBHOOK-VERIFICATION.md](./HMAC-WEBHOOK-VERIFICATION.md) | HMAC notes + code |
| [RECOMMENDATIONS-CHECKLIST.md](./RECOMMENDATIONS-CHECKLIST.md) | Prioritized checklist |
| [PRD-HANDOVER.md](./PRD-HANDOVER.md) | This document |

---

## 6. Key modules map

```text
src/components/ade/
  CommandCenter.tsx      # Shell, fleet state, wiring
  PaneGrid.tsx           # Sub-linear UI, resize, close
  PaneMenu.tsx
  wizard.tsx
  FeaturePanels.tsx      # 10 features
  McpControlCenter.tsx
  McpPaneInspector.tsx
  mcpConfig.ts
  mergeGate.ts
  handoff.ts
  layout.ts
  harnesses.ts
  SettingsPanel.tsx
  subscription.ts
  theme.ts / ThemeToggle / ThemeDocs
  architectureAnalyses.ts
  data.ts / types.ts / badges.tsx
```

---

## 7. Functional requirements (acceptance)

| ID | Requirement | Mock status |
|----|-------------|-------------|
| FR-01 | Open demo fleet grouped by workspace | Pass |
| FR-02 | Drag pane to another workspace | Pass |
| FR-03 | Pin coordinator; stack overflow | Pass |
| FR-04 | Close pane shows worktree destroy warning | Pass |
| FR-05 | Wizard creates workspace + MCP snapshot | Pass |
| FR-06 | MCP matrix binds servers per harness | Pass |
| FR-07 | Merge gate lists blocks including MCP policy | Pass |
| FR-08 | Handoff copies markdown v2 | Pass |
| FR-09 | Theme dark/light/system persists | Pass |
| FR-10 | Settings Billing shows plans/usage | Pass |
| FR-11 | Architecture pack copyable | Pass |
| FR-12 | Real process spawn | Not started |
| FR-13 | Real Stripe webhook | Not started |

---

## 8. Non-functional requirements

| Area | Spec |
|------|------|
| Performance | Sub-linear visible panes; stack overflow |
| Security | Capability deny-default; webhook HMAC on API |
| Accessibility | AA body text; radiogroup theme; focus-visible |
| Honesty | state_blind never faked as live CPU |
| Local-first | Core workflows offline; billing optional |

---

## 9. Subscription sketch (for paid users)

| Plan | Limit highlights |
|------|------------------|
| Hobby $0 | 1 workspace, 3 panes, basic MCP |
| Pro ~$29 | 24 panes, handoff, MCP pack, merge gate |
| Team ~$99 | seats, org MCP, usage API |

Desktop enforces **entitlements** from API; soft-gate only.

---

## 10. Reuse for other harness products

Extract-ready pure TS engines (no React):

- `mergeGate.ts` — conflict + checklist  
- `handoff.ts` — markdown exporter  
- `mcpConfig.ts` — registry + policy  
- `layout.ts` — pack algorithm  
- `harnesses.ts` — capability registry  
- `subscription.ts` — plan catalog types  

UI shells can differ; keep engines shared as `@ade/core` later.

---

## 11. Risks & open decisions

| Risk / decision | Notes |
|-----------------|--------|
| Mock ≠ production spawn | Need real PTY bridge next |
| Entitlement clock skew | Signed exp + periodic online refresh |
| Multi-window capabilities | Settings window may need narrower ACL |
| Token usage accuracy | Must label estimates for limited harnesses |
| Repo split timing | Scaffold `ade-api` before public Pro launch |

---

## 12. Success metrics (post-launch)

- Time-to-first-fleet < 2 minutes (wizard or demo)  
- Attention items cleared without hunting tiles  
- Zero silent worktree data loss (confirm rate)  
- Checkout conversion from soft-gate (privacy-safe)  
- Webhook signature fail rate monitored  

---

## 13. Handover checklist for next engineer

1. Run app (`startup.sh` / dev on :8080); click through Settings → Architecture  
2. Read [ASYNC-CAPABILITIES.md](./ASYNC-CAPABILITIES.md) + [HMAC-WEBHOOK-VERIFICATION.md](./HMAC-WEBHOOK-VERIFICATION.md)  
3. Walk [RECOMMENDATIONS-CHECKLIST.md](./RECOMMENDATIONS-CHECKLIST.md) P0 items  
4. Decide first real plugin: `agent-bridge` spawn for one harness  
5. Scaffold `ade-api` with verified Stripe webhook fixture tests  
6. Wire soft-gates from mock plan → entitlements API  
7. Extract shared engines if building a second harness UI  

---

## 14. Appendix — keyboard shortcuts (mock)

| Key | Action |
|-----|--------|
| ⌘K | Palette |
| ⌘N | New wizard |
| ⌘, | Settings |
| ⌘P | Toggle pin selected |
| ⌘⇧A | Next attention / inbox |
| ⌘B | Broadcast |
| ⌘1/2/3 | Tabs |
| ? | Keyboard hints |
| Esc | Close overlays |

---

## 15. Document control

| Version | Date | Notes |
|---------|------|--------|
| 1.0 | 2026-07-31 | Initial PRD handover from UI proposal workspace |

**Owners:** Product (Jeffry) · Engineering (next assignee)  
**Related:** Design Brief / BUILD-PLAN in upstream harness-ready `docs/*` when present  

---

*End of PRD & handover. Continue implementation from P0 items in RECOMMENDATIONS-CHECKLIST.md.*
