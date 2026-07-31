# HMAC verification for webhooks (product integration notes)

**Scope:** `ade-api` only — never the Tauri desktop binary  
**Primary provider:** Stripe (`Stripe-Signature`)  
**Also applies to:** GitHub (`X-Hub-Signature-256`) with the same principles  

---

## 1. Why HMAC

A public `POST /webhooks/stripe` can be called by anyone. The signature proves:

1. The body was not modified in transit  
2. The sender knows the **endpoint signing secret** (only Stripe + your server)

Without verification, an attacker can forge `customer.subscription.updated` and change entitlements.

---

## 2. Stripe signature header format

```http
Stripe-Signature: t=1712345678,v1=5257a869e7ecebeda32affa62cdca3fa51cad7e77a0e56ff536d0ce8e108d8bd
```

| Part | Meaning |
|------|---------|
| `t` | Unix timestamp (seconds) when Stripe signed |
| `v1` | Hex HMAC-SHA256 of `"{t}.{raw_body}"` with webhook secret |

**Signed payload string:**

```text
`${timestamp}.${rawBodyUtf8}`
```

**Rules:**

- Use the **raw request body** bytes (exactly as received)  
- Do **not** `JSON.parse` then re-`stringify` before verify  
- Reject if `abs(now - t) > tolerance` (Stripe default often 300s)  
- Use **constant-time** compare for the hex digest  
- Prefer official Stripe SDK  

---

## 3. Node.js / Hono / Express examples

### 3.1 Express (official Stripe pattern)

```ts
import express from "express";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-11-20.acacia",
});
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

const app = express();

// IMPORTANT: raw body for this route only
app.post(
  "/v1/webhooks/stripe",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    const sig = req.headers["stripe-signature"];
    if (!sig || typeof sig !== "string") {
      res.status(400).send("Missing Stripe-Signature");
      return;
    }

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    } catch (err) {
      console.error("webhook_signature_fail", (err as Error).message);
      res.status(400).send("Invalid signature");
      return;
    }

    // Idempotency: insert event.id; if conflict, return 200
    const inserted = await db.insertWebhookEvent(event.id, event.type);
    if (!inserted) {
      res.json({ received: true, duplicate: true });
      return;
    }

    // Fast ack — process async
    await queue.enqueue({ kind: "stripe_event", eventId: event.id });
    res.json({ received: true });
  },
);

// Other routes can use JSON parser
app.use(express.json());
```

### 3.2 Manual HMAC (educational — prefer SDK in production)

```ts
import crypto from "node:crypto";

export function verifyStripeSignature(
  rawBody: Buffer,
  header: string,
  secret: string,
  toleranceSec = 300,
): { ok: true; timestamp: number } | { ok: false; reason: string } {
  const parts = Object.fromEntries(
    header.split(",").map((p) => {
      const [k, v] = p.split("=");
      return [k?.trim(), v?.trim()];
    }),
  ) as Record<string, string | undefined>;

  const timestamp = Number(parts.t);
  const v1 = parts.v1;
  if (!timestamp || !v1) return { ok: false, reason: "malformed_header" };

  const age = Math.abs(Math.floor(Date.now() / 1000) - timestamp);
  if (age > toleranceSec) return { ok: false, reason: "timestamp_out_of_range" };

  const signed = `${timestamp}.${rawBody.toString("utf8")}`;
  const expected = crypto
    .createHmac("sha256", secret)
    .update(signed, "utf8")
    .digest("hex");

  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(v1, "utf8");
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return { ok: false, reason: "bad_signature" };
  }
  return { ok: true, timestamp };
}
```

### 3.3 Hono (Bun / Node) sketch

```ts
import { Hono } from "hono";
import Stripe from "stripe";

const app = new Hono();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

app.post("/v1/webhooks/stripe", async (c) => {
  const raw = await c.req.arrayBuffer();
  const body = Buffer.from(raw);
  const sig = c.req.header("stripe-signature");
  if (!sig) return c.text("Missing signature", 400);

  try {
    const event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!,
    );
    await enqueueStripeEvent(event);
    return c.json({ received: true });
  } catch {
    return c.text("Invalid signature", 400);
  }
});
```

### 3.4 Worker: process after verify

```ts
async function handleStripeEvent(event: Stripe.Event) {
  switch (event.type) {
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      // Prefer re-fetch for latest state under races
      const fresh = await stripe.subscriptions.retrieve(sub.id);
      await db.upsertSubscription(fresh);
      await db.recomputeEntitlements(fresh.customer as string);
      break;
    }
    case "invoice.paid":
      // extend access, clear past_due
      break;
    default:
      // ignore unknown types — still mark processed
      break;
  }
  await db.markEventProcessed(event.id);
}
```

---

## 4. GitHub-style HMAC (for future marketplace / repo hooks)

```ts
import crypto from "node:crypto";

export function verifyGitHubSignature(
  rawBody: Buffer,
  signatureHeader: string | undefined, // sha256=hex
  secret: string,
): boolean {
  if (!signatureHeader?.startsWith("sha256=")) return false;
  const their = signatureHeader.slice("sha256=".length);
  const ours = crypto
    .createHmac("sha256", secret)
    .update(rawBody)
    .digest("hex");
  try {
    return crypto.timingSafeEqual(
      Buffer.from(ours, "utf8"),
      Buffer.from(their, "utf8"),
    );
  } catch {
    return false;
  }
}
```

Also: store `X-GitHub-Delivery` for idempotency.

---

## 5. Security checklist (HMAC)

- [ ] Webhook route uses **raw body**  
- [ ] Secret only in env / secret manager (`STRIPE_WEBHOOK_SECRET`)  
- [ ] SDK `constructEvent` or timing-safe manual compare  
- [ ] Timestamp tolerance enforced  
- [ ] 400 on failure; metric `webhook_signature_fail_total`  
- [ ] No signature secrets in Tauri, client, or git  
- [ ] Idempotent `event.id` unique constraint  
- [ ] Fast 2xx after durable accept  
- [ ] HTTPS only in production  
- [ ] Dual-secret rotation runbook documented  

---

## 6. What the ADE desktop does **not** do

| Desktop | API |
|---------|-----|
| Open Checkout URL | Host webhook |
| Cache signed entitlements | Verify Stripe HMAC |
| Soft-gate features | Recompute plan limits |

---

## 7. Test fixtures

```ts
// Unit test idea: use Stripe CLI signed payloads
// stripe listen --forward-to localhost:8787/v1/webhooks/stripe
// stripe trigger customer.subscription.updated

describe("verifyStripeSignature", () => {
  it("rejects tampered body", () => {
    // sign body A, verify body B → fail
  });
  it("rejects expired timestamp", () => {
    // t = now - 3600 → fail
  });
  it("accepts valid fixture", () => {
    // known secret + body + header from Stripe test helpers
  });
});
```

---

## Related

- [ASYNC-CAPABILITIES.md](./ASYNC-CAPABILITIES.md) — where async workers sit relative to verify  
- [PRD-HANDOVER.md](./PRD-HANDOVER.md)  
- Settings → **API & delivery** / **Architecture** in the ADE mock  
