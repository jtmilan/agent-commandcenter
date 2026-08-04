# Entitlements protocol (desktop ↔ ade-api)

## Blob

```json
{
  "entitlements": {
    "userId": "…",
    "planId": "pro",
    "features": ["feature.handoff.v2", "feature.broadcast", …],
    "limits": { "concurrentPanes": 24, … },
    "credits": { "tokenBalance": 0, "handoffBalance": 200 },
    "trialEndsAt": null,
    "exp": 1710000000,
    "iat": 1709996400
  },
  "payloadJson": "<canonical JSON of entitlements>",
  "sig": "<HMAC-SHA256 hex of payloadJson>",
  "algorithm": "HMAC-SHA256"
}
```

## Verify (desktop)

1. `GET /v1/entitlements` with `Authorization: Bearer <persona>`  
2. HMAC-SHA256(`payloadJson`, secret) == `sig`  
3. Reject if `exp` past; soft-fallback to last cache then demo  
4. Soft-gate UI features from `features[]` + credits  

Dev secret: `ENTITLEMENTS_SIGNING_SECRET` (api) = `VITE_ENTITLEMENTS_VERIFY_SECRET` (app).  
Production: rotate secret; prefer asymmetric later.

## Soft-gates (never brick worktrees)

| Feature key | Gate |
|-------------|------|
| `feature.handoff.v2` + credits | Handoff pack |
| `feature.broadcast` | Broadcast |
| `feature.runbook` | Runbook |
| `feature.mcp.export` | MCP export |
| `feature.org_mcp` / Team | Org MCP policy |
| `feature.shared_inbox` / Team | Shared inbox |
| merge dry-run | Always free |

## Checkout loop

1. `POST /v1/checkout` `{ planId, couponCode? }` → `{ url, sessionId, mode }`  
2. Open `url` in system browser  
3. Stripe webhook (HMAC) → recompute plan  
4. On focus: `GET /v1/entitlements` again  

Mock mode (no Stripe key): checkout applies plan immediately for the bearer user.
