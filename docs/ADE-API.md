# ade-api (separate repository)

Companion backend: **[jtmilan/ade-api](https://github.com/jtmilan/ade-api)**

| Concern | Owner |
|---------|--------|
| Stripe secrets + webhooks | ade-api |
| HMAC verify + idempotent events | ade-api |
| Entitlements + usage | ade-api |
| **Coupons, credits, campaigns, referrals** | **ade-api** (see [GROWTH-ENGAGEMENT-API.md](./GROWTH-ENGAGEMENT-API.md)) |
| UI soft-gates + local worktrees | agent-commandcenter |
| Redeem / banner / soft-gate CTAs | agent-commandcenter (display only) |

## Local pairing

```bash
# terminal 1
cd ade-api && cp .env.example .env && npm i && npm run dev

# terminal 2 — UI preview only; production product is Tauri
cd agent-commandcenter && npm i && npm run dev
# preferred product path: npm run tauri:dev
```

```bash
curl -s http://127.0.0.1:8787/v1/entitlements -H 'Authorization: Bearer dev'
```

## Current API (shipped scaffold)

| Method | Path | Notes |
|--------|------|--------|
| `GET` | `/health` | Liveness |
| `GET` | `/v1/plans` | Catalog |
| `GET` | `/v1/me` | User + subscription |
| `GET` | `/v1/entitlements` | Signed features + limits |
| `GET` | `/v1/usage` | Soft meters |
| `POST` | `/v1/checkout` | → Checkout URL |
| `POST` | `/v1/portal` | → Customer portal |
| `POST` | `/v1/webhooks/stripe` | HMAC |

## Planned growth surface

Documented in **[GROWTH-ENGAGEMENT-API.md](./GROWTH-ENGAGEMENT-API.md)**:

- Coupons / promo redeem + checkout `couponCode`  
- Credits wallet + ledger  
- In-app campaigns + dismiss  
- Product events + referrals  
- Trial / win-back segments  

See also ade-api `docs/INTEGRATION.md` for desktop wiring steps.
