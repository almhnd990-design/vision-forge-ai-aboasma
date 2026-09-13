import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { APP_URL } from "@/lib/config";
import { createServerSupabase, createServiceSupabase } from "@/lib/db/server";
import { getWorkspaceAccess } from "@/lib/db/access";
import { billingEnvStatus, getStripe, returnUrl } from "@/lib/billing/stripe";
import { readBillingRecord } from "@/lib/billing/apply";
import { jsonError, logServerError } from "@/lib/api/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  workspaceId: z.string().uuid(),
  locale: z.enum(["en", "ar"]).default("en"),
});

/** Opens the Stripe Billing Portal so customers can change plan, update cards or cancel. */
export async function POST(request: NextRequest) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return jsonError(400, "invalid_json", "Request body must be JSON.");
  }

  const preParse = z.object({ workspaceId: z.string().uuid() }).safeParse(payload);
  if (!preParse.success) {
    return jsonError(400, "invalid_request", "A workspace id is required.");
  }

  // Authentication precedes the rest of input validation.
  const supabase = await createServerSupabase();
  if (!supabase) {
    return jsonError(503, "database_not_configured", "Cloud accounts are not configured.");
  }
  const preAccess = await getWorkspaceAccess(supabase, preParse.data.workspaceId);
  if (preAccess.error === "unauthorized") {
    return jsonError(401, "unauthorized", "Sign in to continue.");
  }
  if (preAccess.error || !preAccess.workspace) {
    return jsonError(404, "workspace_not_found", "Workspace not found.");
  }

  const parsed = bodySchema.safeParse(payload);
  if (!parsed.success) {
    return jsonError(400, "invalid_request", "Invalid portal request.");
  }
  const { workspaceId, locale } = parsed.data;

  const env = billingEnvStatus();
  if (!env.configured) {
    return jsonError(
      503,
      "billing_not_configured",
      "Billing is not configured on this deployment.",
      { requiredEnv: env.missing },
    );
  }

  const stripe = getStripe();
  if (!stripe) {
    return jsonError(503, "billing_not_configured", "Billing is unavailable.");
  }

  const admin = createServiceSupabase();
  if (!admin) {
    return jsonError(503, "database_not_configured", "Server-side database access is not configured.");
  }

  const record = await readBillingRecord(admin, workspaceId);
  if (!record?.customer_id) {
    return jsonError(
      409,
      "no_billing_account",
      "This workspace has no billing account yet. Start a subscription first.",
    );
  }

  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: record.customer_id,
      return_url: returnUrl(locale, "/settings", APP_URL),
    });
    return NextResponse.json({ url: session.url });
  } catch (error) {
    logServerError("billing.portal", error, { workspaceId });
    return jsonError(
      502,
      "portal_failed",
      "The billing portal could not be opened. No change was made to your subscription.",
    );
  }
}
