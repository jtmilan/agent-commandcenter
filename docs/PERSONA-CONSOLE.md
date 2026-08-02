# Persona console — same interface

Agent Command Center is **one shell** with personas:

| Persona | Header control | What you see |
|---------|----------------|--------------|
| **Operator** | default | Fleet, MCP, merge, Settings billing |
| **Admin** | switch to Admin | **Admin** tab: users, coupons, campaigns, credit grants, events |
| **Viewer** | switch to Viewer | Read-oriented surfaces |

## API tokens (ade-api, ALLOW_DEV_AUTH)

```bash
curl -s localhost:8787/v1/me -H 'Authorization: Bearer admin'
curl -s localhost:8787/v1/admin/overview -H 'Authorization: Bearer admin'
curl -s -X POST localhost:8787/v1/coupons/redeem \
  -H 'Authorization: Bearer operator' -H 'Content-Type: application/json' \
  -d '{"code":"WELCOME"}'
```

## Files

| Repo | Path |
|------|------|
| ade-api | `src/routes/admin.ts`, `growth.ts`, `db/store.ts`, `lib/auth.ts` |
| agent-commandcenter | `src/components/ade/AdminConsole.tsx`, `personas.ts` |

Wire: header **persona** select → when `admin`, show Admin tab calling `/v1/admin/*`.
