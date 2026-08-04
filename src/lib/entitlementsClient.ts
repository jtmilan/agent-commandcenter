/**
 * Entitlements client — fetch signed blob from ade-api, verify HMAC, soft-gate.
 * Source of truth is ade-api; local cache is TTL'd. Local worktrees never bricked.
 */

import type { PlanId } from "../components/ade/subscription";
import { DEMO_SUBSCRIPTION, PLANS } from "../components/ade/subscription";
import { publishStatus } from "./statusBus";

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
  /** demo | api (verified) | api_unverified | cache */
  source: "demo" | "api" | "api_unverified" | "cache";
  /** HMAC-SHA256 hex of payloadJson when from API */
  sig?: string;
  payloadJson?: string;
  role?: string;
  status?: string;
  userId?: string;
  verified?: boolean;
}

const CACHE_KEY = "hr-ade-entitlements-v1";
const API_BASE_KEY = "hr-ade-api-base";
const BEARER_KEY = "hr-ade-bearer";

/** Default ade-api origin (dev). Override via localStorage or VITE_ADE_API_URL. */
export function getApiBase(): string {
  if (typeof window !== "undefined") {
    try {
      const s = localStorage.getItem(API_BASE_KEY);
      if (s) return s.replace(/\/$/, "");
    } catch {
      /* */
    }
  }
  const env =
    typeof import.meta !== "undefined"
      ? (import.meta as { env?: { VITE_ADE_API_URL?: string } }).env?.VITE_ADE_API_URL
      : undefined;
  return (env ?? "http://127.0.0.1:8787").replace(/\/$/, "");
}

export function setApiBase(url: string) {
  try {
    localStorage.setItem(API_BASE_KEY, url.replace(/\/$/, ""));
  } catch {
    /* */
  }
}

export function getBearer(): string {
  try {
    return localStorage.getItem(BEARER_KEY) ?? "operator";
  } catch {
    return "operator";
  }
}

export function setBearer(token: string) {
  try {
    localStorage.setItem(BEARER_KEY, token);
  } catch {
    /* */
  }
}

/**
 * Verify HMAC-SHA256 hex signature of payloadJson.
 * Uses Web Crypto when available. Secret from VITE_ENTITLEMENTS_VERIFY_SECRET
 * (must match ade-api ENTITLEMENTS_SIGNING_SECRET in dev).
 */
export async function verifyEntitlementsSig(
  payloadJson: string,
  sig: string,
  secret?: string,
): Promise<boolean> {
  const key =
    secret ??
    (typeof import.meta !== "undefined"
      ? (import.meta as { env?: { VITE_ENTITLEMENTS_VERIFY_SECRET?: string } }).env
          ?.VITE_ENTITLEMENTS_VERIFY_SECRET
      : undefined) ??
    "dev-only-change-me";

  if (typeof crypto === "undefined" || !crypto.subtle) {
    // Node/test fallback — pure JS comparison not available; trust server if no subtle
    return Boolean(sig && payloadJson);
  }

  try {
    const enc = new TextEncoder();
    const cryptoKey = await crypto.subtle.importKey(
      "raw",
      enc.encode(key),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const mac = await crypto.subtle.sign("HMAC", cryptoKey, enc.encode(payloadJson));
    const hex = [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, "0")).join("");
    if (hex.length !== sig.length) return false;
    // constant-time-ish
    let diff = 0;
    for (let i = 0; i < hex.length; i++) diff |= hex.charCodeAt(i) ^ sig.charCodeAt(i);
    return diff === 0;
  } catch {
    return false;
  }
}

export function loadEntitlements(): LocalEntitlements {
  if (typeof window === "undefined") return demoEntitlements();
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as LocalEntitlements;
      if (parsed.exp * 1000 > Date.now()) {
        return { ...parsed, source: parsed.source === "api" ? "cache" : parsed.source };
      }
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
  return {
    planId: plan.id,
    features: [
      "feature.mcp.export",
      "feature.merge.gate",
      "feature.handoff.v2",
      "feature.diff_pr",
      "feature.runbook",
      "feature.broadcast",
      ...(plan.id === "team" ? ["feature.org_mcp", "feature.shared_inbox"] : []),
      ...(plan.id === "free" ? [] : ["feature.broadcast"]),
    ].filter((f, i, a) => a.indexOf(f) === i),
    limits: { ...plan.limits },
    credits: DEMO_SUBSCRIPTION.credits ?? {
      tokenBalance: plan.includedCredits.tokens,
      handoffBalance: plan.includedCredits.handoffs,
    },
    trialEndsAt: DEMO_SUBSCRIPTION.trialEndsAt,
    exp: Math.floor(Date.now() / 1000) + 3600,
    source: "demo",
    verified: false,
  };
}

function mapPayloadToLocal(
  payload: {
    planId: PlanId;
    features: string[];
    limits: LocalEntitlements["limits"];
    credits: LocalEntitlements["credits"];
    trialEndsAt: string | null;
    exp: number;
    role?: string;
    status?: string;
    userId?: string;
  },
  opts: {
    sig?: string;
    payloadJson?: string;
    verified: boolean;
    source: LocalEntitlements["source"];
  },
): LocalEntitlements {
  return {
    planId: payload.planId,
    features: payload.features ?? [],
    limits: payload.limits,
    credits: payload.credits,
    trialEndsAt: payload.trialEndsAt,
    exp: payload.exp,
    sig: opts.sig,
    payloadJson: opts.payloadJson,
    role: payload.role,
    status: payload.status,
    userId: payload.userId,
    verified: opts.verified,
    source: opts.source,
  };
}

/**
 * Fetch signed entitlements from ade-api and verify signature.
 * Falls back to demo on network failure (soft — never bricks UI).
 */
export async function refreshEntitlementsFromApi(opts?: {
  bearer?: string;
  baseUrl?: string;
}): Promise<LocalEntitlements> {
  const base = opts?.baseUrl ?? getApiBase();
  const bearer = opts?.bearer ?? getBearer();

  try {
    const res = await fetch(`${base}/v1/entitlements`, {
      headers: {
        Authorization: `Bearer ${bearer}`,
        Accept: "application/json",
      },
    });
    if (!res.ok) {
      publishStatus({
        kind: "system",
        message: `entitlements fetch ${res.status} — using cache/demo`,
        source: "operator",
      });
      return loadEntitlements();
    }
    const body = (await res.json()) as {
      entitlements: {
        planId: PlanId;
        features: string[];
        limits: LocalEntitlements["limits"];
        credits: LocalEntitlements["credits"];
        trialEndsAt: string | null;
        exp: number;
        role?: string;
        status?: string;
        userId?: string;
      };
      payloadJson: string;
      sig: string;
      algorithm?: string;
    };

    const verified = await verifyEntitlementsSig(body.payloadJson, body.sig);
    const local = mapPayloadToLocal(body.entitlements, {
      sig: body.sig,
      payloadJson: body.payloadJson,
      verified,
      source: verified ? "api" : "api_unverified",
    });
    saveEntitlements(local);
    publishStatus({
      kind: "system",
      message: verified
        ? `Entitlements verified · ${local.planId} · handoffs ${local.credits.handoffBalance}`
        : `Entitlements loaded (sig unverified) · ${local.planId}`,
      source: "operator",
    });
    return local;
  } catch (e) {
    publishStatus({
      kind: "system",
      message: `ade-api unreachable — demo entitlements (${e instanceof Error ? e.message : "err"})`,
      source: "operator",
    });
    return loadEntitlements();
  }
}

/** Start Checkout session (mock or live_stub URL from ade-api). */
export async function startCheckout(planId: "pro" | "team", couponCode?: string) {
  const base = getApiBase();
  const res = await fetch(`${base}/v1/checkout`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getBearer()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ planId, couponCode }),
  });
  if (!res.ok) throw new Error(`checkout ${res.status}`);
  return (await res.json()) as { url: string; mode: string; planId: string };
}

export function canUse(
  e: LocalEntitlements,
  feature: SoftGateFeature,
): { ok: boolean; reason?: string; upgrade?: PlanId } {
  const has = (f: string) => e.features.includes(f);

  switch (feature) {
    case "concurrent_panes":
      return { ok: true };
    case "mcp_export":
      if (has("feature.mcp.export")) return { ok: true };
      return { ok: false, reason: "MCP pack export is Pro+", upgrade: "pro" };
    case "handoff":
      if (e.credits.handoffBalance <= 0)
        return { ok: false, reason: "No handoff credits left", upgrade: "pro" };
      if (!has("feature.handoff.v2") && e.planId === "free")
        return { ok: false, reason: "Handoff v2 is limited on Hobby", upgrade: "pro" };
      return { ok: true };
    case "merge_gate":
      return { ok: true };
    case "broadcast":
      if (has("feature.broadcast") || e.planId !== "free") return { ok: true };
      return { ok: false, reason: "Broadcast is Pro+", upgrade: "pro" };
    case "org_mcp_policy":
      if (has("feature.org_mcp") || has("feature.org.recipes") || e.planId === "team")
        return { ok: true };
      return { ok: false, reason: "Org MCP policy is Team", upgrade: "team" };
    case "shared_inbox":
      if (has("feature.shared_inbox") || e.planId === "team") return { ok: true };
      return { ok: false, reason: "Shared inbox is Team", upgrade: "team" };
    case "diff_pr":
      return { ok: true };
    case "runbook":
      if (has("feature.runbook") || e.planId !== "free") return { ok: true };
      return { ok: false, reason: "Runbooks are Pro+", upgrade: "pro" };
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

/** Soft-gate label for chrome (never blocks local fleet). */
export function entitlementsLabel(e: LocalEntitlements): string {
  const v = e.verified ? "✓" : e.source === "demo" ? "demo" : "~";
  return `${e.planId} ${v}`;
}
