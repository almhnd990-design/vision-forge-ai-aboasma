import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { APP_URL } from "@/lib/config";
import { PLANS, DEFAULT_INTERVAL } from "@/lib/plans";
import { createServerSupabase, createServiceSupabase } from "@/lib/db/server";
import { getWorkspaceAccess } from "@/lib/db/access";
import {
  billingEnvStatus,
  getStripe,
  priceIdForPlan,
  returnUrl,
} from "@/lib/billing/stripe";
import { linkCustomer, readBillingRecord } from "@/lib/billing/apply";
import { jsonError, logServerError } from "@/lib/api/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  workspaceId: z.string().uuid(),
  planId: z.enum(["starter", "growth", "scale"]),
  interval: z.enum(["month", "year"]).default(DEFAULT_INTERVAL),
  locale: z.enum(["en", "ar"]).default("en"),
});

/**
 * Creates a Stripe Checkout Session for a workspace the caller owns.
 *
 * Trust rules enforced here:
 *  - ownership is proven with the request-scoped (RLS) client;
 *  - the plan id is validated against the central plan registry;
 *  - the price id comes from configuration, never from the request body, so a
 *    customer cannot choose their own price;
 *  - when Stripe is not fully configured the route returns 503 with the exact
 *    missing variables instead of simulating a purchase.
 */
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
    return jsonError(
      503,
      "database_not_configured",
      "Cloud accounts are not configured on this deployment.",
    );
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
    return jsonError(400, "invalid_request", "Invalid checkout request.", {
      issues: parsed.error.issues.map((i) => i.path.join(".")),
    });
  }
  const { planId, interval, locale } = parsed.data;

  const env = billingEnvStatus();
  if (!env.configured) {
    return jsonError(
      503,
      "billing_not_configured",
      "Billing is not configured on this deployment, so no purchase can be started.",
      { requiredEnv: env.missing },
    );
  }

  const stripe = getStripe();
  if (!stripe) {
    return jsonError(503, "billing_not_configured", "Stripe client unavailable.");
  }

  const workspace = preAccess.workspace;

  if (!PLANS[planId].intervalsOffered.includes(interval)) {
    return jsonError(
      400,
      "interval_not_offered",
      "That billing interval is not offered for this plan yet.",
    );
  }

  const priceId = priceIdForPlan(planId);
  if (!priceId) {
    return jsonError(
      503,
      "price_not_configured",
      `No Stripe price id is configured for the ${PLANS[planId].name.en} plan.`,
      { requiredEnv: [PLANS[planId].stripePriceEnvKey] },
    );
  }

  const admin = createServiceSupabase();
  if (!admin) {
    return jsonError(
      503,
      "database_not_configured",
      "Server-side database access is not configured.",
    );
  }

  try {
    const existing = await readBillingRecord(admin, workspace.id);

    // A second subscription for the same workspace would double-bill the customer.
    if (existing?.subscription_id && (existing.status === "active" || existing.status === "trialing")) {
      return jsonError(
        409,
        "subscription_exists",
        "This workspace already has an active subscription. Use the billing portal to change it.",
      );
    }

    let customerId = existing?.customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: undefined,
        name: workspace.name,
        metadata: { workspace_id: workspace.id, owner_id: workspace.owner_id },
      });
      customerId = customer.id;
      await linkCustomer(admin, workspace.id, customerId);
    }

    const session = await stripe.checkout.sessions.create(
      {
        mode: "subscription",
        customer: customerId,
        line_items: [{ price: priceId, quantity: 1 }],
        allow_promotion_codes: true,
        client_reference_id: workspace.id,
        subscription_data: {
          metadata: { workspace_id: workspace.id, plan_id: planId },
        },
        metadata: { workspace_id: workspace.id, plan_id: planId },
        success_url: returnUrl(locale, "/settings?checkout=success", APP_URL),
        cancel_url: returnUrl(locale, "/pricing?checkout=cancelled", APP_URL),
      },
      // Idempotency key derived from workspace + plan so a double-submit cannot
      // create two sessions for the same intent.
      { idempotencyKey: `checkout:${workspace.id}:${planId}:${Math.floor(Date.now() / 60000)}` },
    );

    if (!session.url) {
      return jsonError(502, "checkout_failed", "Stripe did not return a checkout URL.");
    }

    return NextResponse.json({ url: session.url, sessionId: session.id });
  } catch (error) {
    logServerError("billing.checkout", error, { workspaceId: workspace.id, planId });
    return jsonError(
      502,
      "checkout_failed",
      "The payment provider could not be reached. No charge was made.",
    );
  }
}
