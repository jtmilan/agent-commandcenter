/**
 * Copy-ready HMAC verification examples for product integration.
 * Runtime: ade-api only — not imported by Tauri UI for verification.
 */

export const HMAC_NOTES = `
# HMAC verification (quick notes)

1. Verify BEFORE any business logic.
2. Use RAW body bytes — never re-serialized JSON.
3. Stripe-Signature: t=<unix>,v1=<hex hmac of "t.body">.
4. Reject if |now - t| > 300 seconds (replay window).
5. Compare digests with crypto.timingSafeEqual.
6. Prefer stripe.webhooks.constructEvent (official SDK).
7. On failure: HTTP 400 + metric; do not process.
8. On success: idempotent store event.id, enqueue worker, return 200 fast.
9. Secrets only on ade-api (STRIPE_WEBHOOK_SECRET).
10. Desktop ADE never verifies Stripe webhooks.
`.trim();

export const HMAC_EXPRESS_EXAMPLE = `
import express from "express";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
const secret = process.env.STRIPE_WEBHOOK_SECRET!;
const app = express();

app.post(
  "/v1/webhooks/stripe",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    const sig = req.headers["stripe-signature"];
    if (typeof sig !== "string") {
      res.status(400).send("Missing Stripe-Signature");
      return;
    }
    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(req.body, sig, secret);
    } catch (e) {
      console.error("webhook_signature_fail", (e as Error).message);
      res.status(400).send("Invalid signature");
      return;
    }
    // Idempotency
    const inserted = await db.insertWebhookEvent(event.id, event.type);
    if (!inserted) {
      res.json({ received: true, duplicate: true });
      return;
    }
    await queue.enqueue({ kind: "stripe_event", eventId: event.id });
    res.json({ received: true });
  },
);
`.trim();

export const HMAC_MANUAL_EXAMPLE = `
import crypto from "node:crypto";

/** Educational manual verify — production should prefer Stripe SDK */
export function verifyStripeSignature(
  rawBody: Buffer,
  header: string,
  secret: string,
  toleranceSec = 300,
): boolean {
  const map = Object.fromEntries(
    header.split(",").map((part) => {
      const [k, v] = part.split("=");
      return [k?.trim() ?? "", v?.trim() ?? ""];
    }),
  );
  const t = Number(map.t);
  const v1 = map.v1;
  if (!t || !v1) return false;
  if (Math.abs(Math.floor(Date.now() / 1000) - t) > toleranceSec) return false;

  const signed = \`\${t}.\${rawBody.toString("utf8")}\`;
  const expected = crypto.createHmac("sha256", secret).update(signed).digest("hex");
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(v1, "utf8");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
`.trim();

export const CAPABILITY_JSON_EXAMPLE = `
{
  "identifier": "main-capability",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "agent-bridge:allow-spawn",
    "agent-bridge:allow-attach",
    "worktree:allow-create",
    "worktree:allow-destroy-confirm",
    "mcp:allow-inject-spawn",
    "entitlements:allow-refresh",
    "billing:allow-open-checkout",
    {
      "identifier": "fs:scope",
      "allow": [{ "path": "$HOME/**/.agent-teams-worktrees/**" }]
    },
    {
      "identifier": "http:default",
      "allow": [{ "url": "https://api.yourdomain.com/**" }]
    }
  ]
}
`.trim();

export const ASYNC_SPAWN_EXAMPLE = `
// Rust plugin sketch — accept fast, work async, emit events
#[tauri::command]
async fn spawn_agent(
    app: AppHandle,
    state: State<'_, JobQueue>,
    req: SpawnRequest,
) -> Result<SpawnAccepted, String> {
    validate_scope(&req.worktree)?;
    let job_id = state.enqueue(Job::Spawn(req.clone()));
    tauri::async_runtime::spawn(async move {
        let result = do_spawn(req).await;
        let _ = app.emit("agent://status", &result);
    });
    Ok(SpawnAccepted { job_id })
}
`.trim();
