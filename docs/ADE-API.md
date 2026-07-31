# ade-api (separate repository)

Companion backend: **[jtmilan/ade-api](https://github.com/jtmilan/ade-api)**

| Concern | Owner |
|---------|--------|
| Stripe secrets + webhooks | ade-api |
| HMAC verify + idempotent events | ade-api |
| Entitlements + usage | ade-api |
| UI soft-gates + local worktrees | agent-commandcenter |

## Local pairing

```bash
# terminal 1
cd ade-api && cp .env.example .env && npm i && npm run dev

# terminal 2
cd agent-commandcenter && npm i && npm run dev
```

```bash
curl -s http://127.0.0.1:8787/v1/entitlements -H 'Authorization: Bearer dev'
```

See ade-api `docs/INTEGRATION.md` for desktop wiring steps.
