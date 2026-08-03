/**
 * Client-side entitlements + soft-gate helpers.
 * Production: fetch signed blob from ade-api; here: local cache + demo.
 */

import type { PlanId } from "../components/ade/subscription";
import { DEMO_SUBSCRIPTION, PLANS } from "../components/ade/subscription";

export type SoftGateFeature =
  | "concurrent_panes"
  | "mcp_export"
  | "handoff"
  | "merge_gate"
  | "broadcast"
  | "org_mcp_policy"
  | "shared_inbox"
  | "diff_pr"
  | "runbook";

export interface LocalEntitlements {
  planId: PlanId;
  features: string[];
  limits: {
    concurrentPanes: number;
    workspaces: number;
    mcpServers: number;
    handoffExportsDay: number;
  };
  credits: { tokenBalance: number; handoffBalance: number };
  trialEndsAt: string | null;
  exp: number;
  source: "demo" | "api";
}

const CACHE_KEY = "hr-ade-entitlements-v1";

export function loadEntitlements(): LocalEntitlements {
  if (typeof window === "undefined") return demoEntitlements();
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as LocalEntitlements;
      if (parsed.exp * 1000 > Date.now()) return parsed;
    }
  } catch {
    /* ignore */
  }
  return demoEntitlements();
}

export function saveEntitlements(e: LocalEntitlements) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(e));
  } catch {
    /* ignore */
  }
}

export function demoEntitlements(planId: PlanId = DEMO_SUBSCRIPTION.planId): LocalEntitlements {
  const plan = PLANS.find((p) => p.id === planId) ?? PLANS[1]!;
  const e: LocalEntitlements = {
    planId: plan.id,
    features: [
      "feature.mcp.export",
      "feature.merge.gate",
      "feature.handoff.v2",
      "feature.diff_pr",
      "feature.runbook",
      ...(plan.id === "team" ? ["feature.org_mcp", "feature.shared_inbox"] : []),
      ...(plan.id === "free" ? [] : ["feature.broadcast"]),
    ],
    limits: { ...plan.limits },
    credits: DEMO_SUBSCRIPTION.credits ?? {
      tokenBalance: plan.includedCredits.tokens,
      handoffBalance: plan.includedCredits.handoffs,
    },
    trialEndsAt: DEMO_SUBSCRIPTION.trialEndsAt,
    exp: Math.floor(Date.now() / 1000) + 3600,
    source: "demo",
  };
  return e;
}

export function canUse(
  e: LocalEntitlements,
  feature: SoftGateFeature,
): { ok: boolean; reason?: string; upgrade?: PlanId } {
  switch (feature) {
    case "concurrent_panes":
      return { ok: true };
    case "mcp_export":
      if (e.features.includes("feature.mcp.export")) return { ok: true };
      return { ok: false, reason: "MCP pack export is Pro+", upgrade: "pro" };
    case "handoff":
      if (e.credits.handoffBalance <= 0)
        return { ok: false, reason: "No handoff credits left", upgrade: "pro" };
      if (!e.features.includes("feature.handoff.v2") && e.planId === "free")
        return { ok: false, reason: "Handoff v2 is limited on Hobby", upgrade: "pro" };
      return { ok: true };
    case "merge_gate":
      return { ok: true }; // dry-run always free
    case "broadcast":
      if (e.features.includes("feature.broadcast")) return { ok: true };
      return { ok: false, reason: "Broadcast is Pro+", upgrade: "pro" };
    case "org_mcp_policy":
      if (e.features.includes("feature.org_mcp")) return { ok: true };
      return { ok: false, reason: "Org MCP policy is Team", upgrade: "team" };
    case "shared_inbox":
      if (e.features.includes("feature.shared_inbox")) return { ok: true };
      return { ok: false, reason: "Shared inbox is Team", upgrade: "team" };
    case "diff_pr":
      return { ok: true };
    case "runbook":
      if (e.planId === "free")
        return { ok: false, reason: "Runbooks are Pro+", upgrade: "pro" };
      return { ok: true };
    default:
      return { ok: true };
  }
}

export function spendHandoffCredit(e: LocalEntitlements, n = 1): LocalEntitlements {
  const next = {
    ...e,
    credits: {
      ...e.credits,
      handoffBalance: Math.max(0, e.credits.handoffBalance - n),
    },
  };
  saveEntitlements(next);
  return next;
}

export function grantWelcomeCredits(e: LocalEntitlements): LocalEntitlements {
  const next = {
    ...e,
    credits: {
      tokenBalance: e.credits.tokenBalance + 50_000,
      handoffBalance: e.credits.handoffBalance + 5,
    },
  };
  saveEntitlements(next);
  return next;
}
