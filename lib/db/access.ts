import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getEntitlements,
  isPlanId,
  NO_PLAN,
  type Entitlements,
  type FeatureKey,
  type PlanId,
} from "@/lib/plans";
import { isBillingConfigured } from "@/lib/config";
import type { WorkspaceRow } from "./types";

export type WorkspaceAccess = {
  userId: string;
  workspace?: WorkspaceRow;
  error?: "unauthorized" | "not_found" | "unavailable";
};

/**
 * Resolve the signed-in user and (optionally) prove they own the workspace.
 *
 * Tenant isolation: this uses the REQUEST-SCOPED client, so Row Level Security is the
 * authority. A workspace owned by somebody else is indistinguishable from a missing
 * one — `not_found` — so probing cannot confirm the existence of other tenants' data.
 */
export async function getWorkspaceAccess(
  supabase: SupabaseClient | null,
  workspaceId?: string,
): Promise<WorkspaceAccess> {
  if (!supabase) return { userId: "", error: "unavailable" };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { userId: "", error: "unauthorized" };

  if (!workspaceId) return { userId: user.id };

  const { data, error } = await supabase
    .from("workspaces")
    .select("*")
    .eq("id", workspaceId)
    .maybeSingle<WorkspaceRow>();

  if (error || !data) return { userId: user.id, error: "not_found" };
  if (data.owner_id !== user.id) return { userId: user.id, error: "not_found" };

  return { userId: user.id, workspace: data };
}

/** List the caller's own workspaces. RLS guarantees the scope. */
export async function listWorkspaces(
  supabase: SupabaseClient,
): Promise<WorkspaceRow[]> {
  const { data } = await supabase
    .from("workspaces")
    .select("*")
    .order("created_at", { ascending: true });
  return (data ?? []) as WorkspaceRow[];
}

export const TRIAL_GRACE_DAYS = 0;

/**
 * The plan a workspace is entitled to right now.
 *
 * Server-side truth. Never trust a plan id supplied by the browser: it is always
 * derived from the workspace billing mirror, which only verified webhooks may write.
 */
export function resolveActivePlanId(workspace: {
  plan_id?: string | null;
  billing_status?: string | null;
  trial_ends_at?: string | null;
}): PlanId | null {
  if (workspace.billing_status === "active") {
    return isPlanId(workspace.plan_id) ? workspace.plan_id : null;
  }
  if (workspace.billing_status === "trialing") {
    const ends = workspace.trial_ends_at ? Date.parse(workspace.trial_ends_at) : NaN;
    if (!Number.isNaN(ends) && ends + TRIAL_GRACE_DAYS * 86_400_000 > Date.now()) {
      return isPlanId(workspace.plan_id) ? workspace.plan_id : null;
    }
    return null;
  }
  // past_due / unpaid / canceled / incomplete / none -> no paid entitlements.
  return null;
}

export type EntitlementState = {
  planId: PlanId | null;
  entitlements: Entitlements;
  billingStatus: string;
  /** Set when the account is blocked from paid features and why. */
  blockedReason?: "no_plan" | "past_due" | "unpaid" | "canceled" | "incomplete" | "trial_expired";
};

export function entitlementState(workspace: {
  plan_id?: string | null;
  billing_status?: string | null;
  trial_ends_at?: string | null;
}): EntitlementState {
  const planId = resolveActivePlanId(workspace);
  const status = workspace.billing_status ?? "none";
  if (planId) {
    return { planId, entitlements: getEntitlements(planId), billingStatus: status };
  }
  let reason: EntitlementState["blockedReason"] = "no_plan";
  if (status === "trialing") reason = "trial_expired";
  else if (
    status === "past_due" ||
    status === "unpaid" ||
    status === "canceled" ||
    status === "incomplete"
  ) {
    reason = status;
  }
  return { planId: null, entitlements: NO_PLAN, billingStatus: status, blockedReason: reason };
}

export function hasFeature(state: EntitlementState, feature: FeatureKey): boolean {
  return state.entitlements.features.includes(feature);
}

/** Usage for the current calendar month, read through the RPC exposed by migration 0002. */
export async function analysesUsedThisPeriod(
  supabase: SupabaseClient,
  workspaceId: string,
): Promise<number> {
  const { data, error } = await supabase.rpc("workspace_usage_this_period", {
    target: workspaceId,
  });
  if (error) return 0;
  return typeof data === "number" ? data : 0;
}

export type QuotaCheck = {
  allowed: boolean;
  used: number;
  limit: number | null;
  reason?: "no_plan" | "quota_exceeded" | "feature_unavailable" | "billing_not_configured";
};

/**
 * Server-side quota gate for analyses. This is the enforcement point — the dashboard
 * may also hide buttons, but that is cosmetic and must never be the only control.
 */
export function checkAnalysisQuota(
  state: EntitlementState,
  used: number,
): QuotaCheck {
  const limit = state.entitlements.analysesPerMonth;
  if (!hasFeature(state, "deterministic_analysis")) {
    return {
      allowed: false,
      used,
      limit,
      reason: isBillingConfigured() ? "no_plan" : "billing_not_configured",
    };
  }
  if (limit === null) return { allowed: true, used, limit };
  if (used >= limit) return { allowed: false, used, limit, reason: "quota_exceeded" };
  return { allowed: true, used, limit };
}

export function checkWorkspaceQuota(
  state: EntitlementState,
  owned: number,
): QuotaCheck {
  const limit = state.entitlements.workspaces;
  if (limit === null) return { allowed: true, used: owned, limit };
  if (owned >= limit) return { allowed: false, used: owned, limit, reason: "quota_exceeded" };
  return { allowed: true, used: owned, limit };
}

export function checkConnectionQuota(
  state: EntitlementState,
  connected: number,
): QuotaCheck {
  const limit = state.entitlements.connectedProviders;
  if (limit === null) return { allowed: true, used: connected, limit };
  if (connected >= limit) return { allowed: false, used: connected, limit, reason: "quota_exceeded" };
  return { allowed: true, used: connected, limit };
}
