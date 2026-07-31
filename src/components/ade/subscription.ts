/**
 * Subscription model (product mock) for Agent Command Center / ADE.
 * Real billing lives in a separate API repo; this is the client contract.
 */

export type PlanId = "free" | "pro" | "team";

export interface Plan {
  id: PlanId;
  name: string;
  priceMonthly: number | null; // null = custom
  priceLabel: string;
  seats: number | "unlimited";
  highlight?: boolean;
  features: string[];
  limits: {
    concurrentPanes: number;
    workspaces: number;
    mcpServers: number;
    handoffExportsDay: number;
    prioritySupport: boolean;
  };
}

export const PLANS: Plan[] = [
  {
    id: "free",
    name: "Hobby",
    priceMonthly: 0,
    priceLabel: "$0",
    seats: 1,
    features: [
      "1 workspace · 3 concurrent panes",
      "Local MCP registry",
      "Merge gate dry-run",
      "Community recipes",
    ],
    limits: {
      concurrentPanes: 3,
      workspaces: 1,
      mcpServers: 4,
      handoffExportsDay: 5,
      prioritySupport: false,
    },
  },
  {
    id: "pro",
    name: "Pro",
    priceMonthly: 29,
    priceLabel: "$29",
    seats: 1,
    highlight: true,
    features: [
      "Unlimited workspaces",
      "24 concurrent panes · sub-linear pack",
      "MCP pack import/export",
      "Session handoff + merge gate",
      "Priority model routing (when wired)",
    ],
    limits: {
      concurrentPanes: 24,
      workspaces: 50,
      mcpServers: 32,
      handoffExportsDay: 200,
      prioritySupport: true,
    },
  },
  {
    id: "team",
    name: "Team",
    priceMonthly: 99,
    priceLabel: "$99",
    seats: 5,
    features: [
      "Everything in Pro",
      "5 seats · SSO-ready API",
      "Org MCP policy templates",
      "Usage analytics API",
      "Shared recipe library",
    ],
    limits: {
      concurrentPanes: 64,
      workspaces: 200,
      mcpServers: 64,
      handoffExportsDay: 2000,
      prioritySupport: true,
    },
  },
];

export type SubStatus = "active" | "trialing" | "past_due" | "canceled" | "none";

export interface SubscriptionSnapshot {
  planId: PlanId;
  status: SubStatus;
  renewsAt: string | null;
  trialEndsAt: string | null;
  customerEmail: string;
  /** Stripe customer / subscription ids — opaque to UI */
  externalCustomerId?: string;
  externalSubscriptionId?: string;
}

export interface UsageMeter {
  id: string;
  label: string;
  used: number;
  limit: number | null; // null = unlimited
  unit: string;
}

export const DEMO_SUBSCRIPTION: SubscriptionSnapshot = {
  planId: "pro",
  status: "active",
  renewsAt: "2026-08-30T00:00:00.000Z",
  trialEndsAt: null,
  customerEmail: "jeffry@example.com",
  externalCustomerId: "cus_mock_ade",
  externalSubscriptionId: "sub_mock_ade",
};

export function usageForPlan(planId: PlanId): UsageMeter[] {
  const plan = PLANS.find((p) => p.id === planId) ?? PLANS[0]!;
  return [
    {
      id: "panes",
      label: "Concurrent panes (peak today)",
      used: Math.min(7, plan.limits.concurrentPanes),
      limit: plan.limits.concurrentPanes,
      unit: "panes",
    },
    {
      id: "workspaces",
      label: "Workspaces",
      used: 3,
      limit: plan.limits.workspaces,
      unit: "ws",
    },
    {
      id: "mcp",
      label: "MCP servers bound",
      used: 6,
      limit: plan.limits.mcpServers,
      unit: "servers",
    },
    {
      id: "handoff",
      label: "Handoff exports (24h)",
      used: 12,
      limit: plan.limits.handoffExportsDay,
      unit: "exports",
    },
    {
      id: "tokens",
      label: "Agent tokens (estimate)",
      used: 1_240_000,
      limit: planId === "free" ? 500_000 : planId === "pro" ? 10_000_000 : null,
      unit: "tok",
    },
  ];
}

/** Contract for separate billing API (ade-api / billing service) */
export const BILLING_API_CONTRACT = `
# ade-billing API (separate repo) — v0 sketch

Base: https://api.yourdomain.com/v1
Auth: Bearer <user_jwt> or desktop device token (Tauri)

## Endpoints
GET  /me                     → user + subscription snapshot
GET  /plans                  → catalog (also cacheable static)
POST /checkout               → { planId, successUrl, cancelUrl } → { url }
POST /portal                 → Stripe customer portal URL
GET  /usage?from=&to=        → meters + series for charts
POST /webhooks/stripe        → server-only; updates sub status
GET  /entitlements           → { features: string[], limits: {...} }

## Entitlements (what the desktop app checks)
- feature.mcp.export
- feature.merge.gate
- feature.handoff.v2
- limit.panes.concurrent
- limit.workspaces
- limit.mcp.servers

## Desktop (Tauri) flow
1. Sign-in via OAuth / device code → short-lived JWT
2. Cache entitlements offline (signed, TTL 1h)
3. Soft-gate Pro features when expired; never block local worktrees
4. "Upgrade" opens system browser → checkout URL from API
5. Webhook → API; app refreshes /entitlements on focus

## Repo split
| Repo            | Owns                                      |
|-----------------|-------------------------------------------|
| harness-ready   | Tauri + React ADE UI, local MCP, panes    |
| ade-api         | Auth, Stripe, entitlements, usage, SSO    |
| ade-docs        | Public pricing + operator guides          |

## Never in the desktop binary
- Stripe secret key
- Webhook signing secret
- Raw card data
`.trim();
