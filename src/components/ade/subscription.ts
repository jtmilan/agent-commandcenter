/**
 * Subscription + growth model (product mock) for Agent Command Center / ADE.
 * Real billing lives in ade-api; this is the client contract.
 * Growth: coupons, credits, campaigns — see docs/GROWTH-ENGAGEMENT-API.md
 */

export type PlanId = "free" | "pro" | "team";

export interface Plan {
  id: PlanId;
  name: string;
  priceMonthly: number | null;
  priceLabel: string;
  seats: number | "unlimited";
  highlight?: boolean;
  /** One-line operator-facing pitch */
  pitch: string;
  features: string[];
  limits: {
    concurrentPanes: number;
    workspaces: number;
    mcpServers: number;
    handoffExportsDay: number;
    prioritySupport: boolean;
  };
  /** Monthly included credits (soft consumables) */
  includedCredits: {
    tokens: number;
    handoffs: number;
  };
}

export const PLANS: Plan[] = [
  {
    id: "free",
    name: "Hobby",
    priceMonthly: 0,
    priceLabel: "$0",
    seats: 1,
    pitch: "Learn multi-agent fleets on your machine. Local worktrees always free.",
    features: [
      "1 workspace · 3 concurrent panes",
      "Local MCP registry",
      "Merge gate dry-run",
      "Welcome credits to try handoff",
    ],
    limits: {
      concurrentPanes: 3,
      workspaces: 1,
      mcpServers: 4,
      handoffExportsDay: 5,
      prioritySupport: false,
    },
    includedCredits: { tokens: 500_000, handoffs: 5 },
  },
  {
    id: "pro",
    name: "Pro",
    priceMonthly: 29,
    priceLabel: "$29",
    seats: 1,
    highlight: true,
    pitch: "Run full fleets daily — handoff, MCP packs, merge gate for operators.",
    features: [
      "Unlimited workspaces",
      "24 concurrent panes · sub-linear pack",
      "MCP pack import/export",
      "Session handoff + merge gate",
      "Promo & credit top-ups supported",
    ],
    limits: {
      concurrentPanes: 24,
      workspaces: 50,
      mcpServers: 32,
      handoffExportsDay: 200,
      prioritySupport: true,
    },
    includedCredits: { tokens: 10_000_000, handoffs: 200 },
  },
  {
    id: "team",
    name: "Team",
    priceMonthly: 99,
    priceLabel: "$99",
    seats: 5,
    pitch: "Shared recipes, org MCP policy, pooled credits — one bill for the fleet.",
    features: [
      "Everything in Pro",
      "5 seats · SSO-ready API",
      "Org MCP policy templates",
      "Pooled credit wallet",
      "Usage analytics + referrals",
    ],
    limits: {
      concurrentPanes: 64,
      workspaces: 200,
      mcpServers: 64,
      handoffExportsDay: 2000,
      prioritySupport: true,
    },
    includedCredits: { tokens: 50_000_000, handoffs: 2000 },
  },
];

export type SubStatus = "active" | "trialing" | "past_due" | "canceled" | "none";

export interface PromoOverlay {
  code: string;
  label: string;
  endsAt: string | null;
}

export interface CreditsWallet {
  tokenBalance: number;
  handoffBalance: number;
  currency: "ade_credit";
}

export interface SubscriptionSnapshot {
  planId: PlanId;
  status: SubStatus;
  renewsAt: string | null;
  trialEndsAt: string | null;
  customerEmail: string;
  externalCustomerId?: string;
  externalSubscriptionId?: string;
  promo?: PromoOverlay | null;
  credits?: CreditsWallet;
}

export interface UsageMeter {
  id: string;
  label: string;
  used: number;
  limit: number | null;
  unit: string;
}

export interface CampaignBanner {
  id: string;
  placement: "billing_banner" | "command_strip" | "soft_gate";
  title: string;
  body: string;
  ctaLabel: string;
  planId?: PlanId;
  couponCode?: string;
  endsAt: string | null;
}

export const DEMO_SUBSCRIPTION: SubscriptionSnapshot = {
  planId: "pro",
  status: "active",
  renewsAt: "2026-08-30T00:00:00.000Z",
  trialEndsAt: null,
  customerEmail: "jeffry@example.com",
  externalCustomerId: "cus_mock_ade",
  externalSubscriptionId: "sub_mock_ade",
  promo: {
    code: "LAUNCH50",
    label: "Launch: 50% off first 3 months",
    endsAt: "2026-09-01T00:00:00.000Z",
  },
  credits: {
    tokenBalance: 8_760_000,
    handoffBalance: 188,
    currency: "ade_credit",
  },
};

export const DEMO_CAMPAIGNS: CampaignBanner[] = [
  {
    id: "camp_august_launch",
    placement: "billing_banner",
    title: "Launch week: invite a teammate",
    body: "Both of you get handoff credits when they finish the wizard.",
    ctaLabel: "Copy referral (API)",
    endsAt: "2026-08-15T00:00:00.000Z",
  },
];

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
      limit: plan.includedCredits.tokens,
      unit: "tok",
    },
  ];
}

/** Contract for ade-api including growth surface */
export const BILLING_API_CONTRACT = `
# ade-api contract (billing + growth) — v1 sketch

Base: https://api.yourdomain.com/v1
Auth: Bearer <user_jwt> or desktop device token (Tauri)

## Core
GET  /me
GET  /plans
GET  /entitlements          → plan + features + limits + credits + promo + trialEndsAt + sig
GET  /usage
POST /checkout              → { planId, couponCode?, successUrl, cancelUrl }
POST /portal
POST /webhooks/stripe       → server-only HMAC

## Growth (see docs/GROWTH-ENGAGEMENT-API.md)
POST /coupons/redeem        → { code } → new entitlements
GET  /coupons/preview?code=
GET  /credits
POST /credits/consume       → Idempotency-Key required
GET  /credits/ledger
GET  /campaigns/active
POST /campaigns/:id/dismiss
POST /events                → allowlisted product events
GET  /referrals/me
POST /referrals/claim

## Desktop rules
1. Cache signed entitlements (TTL ~1h); refresh on focus
2. Soft-gate only; never brick local worktrees
3. Redeem coupons only via API — never trust client-only codes
4. Marketing banners from /campaigns/active; dismissible
5. Checkout opens system browser; no card UI in WebView

## Never in the desktop binary
- Stripe secret / webhook secret
- Ability to invent credit balances offline
`.trim();
