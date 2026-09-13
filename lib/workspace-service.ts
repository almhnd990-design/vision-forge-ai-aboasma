import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { checkWorkspaceQuota, entitlementState, listWorkspaces } from "@/lib/db/access";
import { isBillingConfigured } from "@/lib/config";
import { DEFAULT_PLAN_ID } from "@/lib/plans";
import type { WorkspaceRow } from "@/lib/db/types";

/**
 * Workspace lifecycle.
 *
 * Creation is quota-gated server-side. The count is read through the request-scoped
 * client (RLS applies) and the insert uses the same client, so the new row can only ever
 * belong to the caller — `owner_id` is taken from the verified session, never from input.
 */

export type CreateWorkspaceResult =
  | { ok: true; workspace: WorkspaceRow }
  | { ok: false; code: string; message: string };

export async function createWorkspace(
  supabase: SupabaseClient,
  input: {
    userId: string;
    name: string;
    businessType?: string | null;
    primaryGoal?: string | null;
    /** Only applied when billing is configured; otherwise the workspace stays planless. */
    intendedPlanId?: string | null;
  },
): Promise<CreateWorkspaceResult> {
  const existing = await listWorkspaces(supabase);
  const owned = existing.length;

  /*
   * Discovery mode: while billing is not configured no plan exists to enforce against, so
   * the product must not block a first workspace. The customer sees an explicit
   * entitlement state instead. Once billing exists, quota is enforced for real.
   */
  if (isBillingConfigured()) {
    const state = entitlementState({ plan_id: null, billing_status: "none" });
    const quota = checkWorkspaceQuota(state, owned);
    if (!quota.allowed) {
      return {
        ok: false,
        code: "quota_exceeded",
        message:
          quota.reason === "no_plan"
            ? "An active subscription is required before creating a workspace."
            : `Your plan allows ${quota.limit} workspace(s) and ${quota.used} already exist.`,
      };
    }
  } else if (owned >= 1) {
    return {
      ok: false,
      code: "quota_exceeded",
      message:
        "This deployment has no billing configured, so only one workspace can exist. Configure Stripe to allow more.",
    };
  }

  const name = input.name.trim().slice(0, 120);
  if (name.length === 0) {
    return { ok: false, code: "invalid_name", message: "A workspace name is required." };
  }

  const { data, error } = await supabase
    .from("workspaces")
    .insert({
      owner_id: input.userId,
      name,
      business_type: input.businessType ?? null,
      primary_goal: input.primaryGoal ?? null,
      onboarding_completed: false,
      // Billing columns stay untouched here; only verified webhooks may set them.
    })
    .select("*")
    .single<WorkspaceRow>();

  if (error || !data) {
    return {
      ok: false,
      code: "storage_failed",
      message: `The workspace could not be created: ${error?.message ?? "unknown error"}`,
    };
  }

  await supabase.from("audit_events").insert({
    workspace_id: data.id,
    actor_id: input.userId,
    actor_type: "user",
    action: "workspace.created",
    target_type: "workspace",
    target_id: data.id,
    metadata: {
      business_type: input.businessType ?? null,
      primary_goal: input.primaryGoal ?? null,
      intended_plan: input.intendedPlanId ?? DEFAULT_PLAN_ID,
    },
  });

  return { ok: true, workspace: data };
}

export async function renameWorkspace(
  supabase: SupabaseClient,
  input: { userId: string; workspaceId: string; name: string },
): Promise<{ ok: boolean; message?: string }> {
  const name = input.name.trim().slice(0, 120);
  if (name.length === 0) return { ok: false, message: "A workspace name is required." };

  const { error } = await supabase
    .from("workspaces")
    .update({ name })
    .eq("id", input.workspaceId)
    .eq("owner_id", input.userId);
  if (error) return { ok: false, message: error.message };

  await supabase.from("audit_events").insert({
    workspace_id: input.workspaceId,
    actor_id: input.userId,
    actor_type: "user",
    action: "workspace.renamed",
    target_type: "workspace",
    target_id: input.workspaceId,
    metadata: { name },
  });
  return { ok: true };
}

export async function completeOnboarding(
  supabase: SupabaseClient,
  input: { userId: string; workspaceId: string; primaryGoal?: string | null },
): Promise<void> {
  await supabase
    .from("workspaces")
    .update({
      onboarding_completed: true,
      ...(input.primaryGoal ? { primary_goal: input.primaryGoal } : {}),
    })
    .eq("id", input.workspaceId)
    .eq("owner_id", input.userId);

  await supabase.from("audit_events").insert({
    workspace_id: input.workspaceId,
    actor_id: input.userId,
    actor_type: "user",
    action: "workspace.onboarding_completed",
    target_type: "workspace",
    target_id: input.workspaceId,
    metadata: {},
  });
}
