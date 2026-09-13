import { NextResponse, type NextRequest } from "next/server";
import type Stripe from "stripe";
import { createServiceSupabase } from "@/lib/db/server";
import { billingEnvStatus, getStripe } from "@/lib/billing/stripe";
import { applyStripeEvent, claimEvent, finishEvent } from "@/lib/billing/apply";
import { logServerError } from "@/lib/api/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Stripe webhook endpoint.
 *
 * Security posture:
 *  - the raw body is read with `request.text()` and verified against the signing
 *    secret; an unverified payload is never parsed as trusted data;
 *  - every event id is claimed exactly once (billing_events primary key), so a
 *    retried delivery cannot double-apply a subscription change;
 *  - failures are recorded with a status and returned as 5xx so Stripe retries, and
 *    the reason is visible in the billing_events table instead of being swallowed.
 */
export async function POST(request: NextRequest) {
  const env = billingEnvStatus();
  const stripe = getStripe();
  if (!stripe || !env.configured) {
    return NextResponse.json(
      {
        error: {
          code: "billing_not_configured",
          message: "Stripe webhooks require a fully configured billing environment.",
        },
        requiredEnv: env.missing,
      },
      { status: 503 },
    );
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json(
      { error: { code: "missing_signature", message: "Missing Stripe signature header." } },
      { status: 400 },
    );
  }

  const rawBody = await request.text();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET as string,
    );
  } catch (error) {
    // Signature failure is a security event, not a bug: log it without the payload.
    logServerError("billing.webhook.signature", error, {
      signaturePresent: true,
      bodyBytes: rawBody.length,
    });
    return NextResponse.json(
      { error: { code: "invalid_signature", message: "Webhook signature verification failed." } },
      { status: 400 },
    );
  }

  const admin = createServiceSupabase();
  if (!admin) {
    return NextResponse.json(
      {
        error: {
          code: "database_not_configured",
          message: "Webhook processing requires server-side database access.",
        },
      },
      { status: 503 },
    );
  }

  let claimed: boolean;
  try {
    claimed = await claimEvent(admin, { id: event.id, type: event.type });
  } catch (error) {
    logServerError("billing.webhook.claim", error, { eventId: event.id, type: event.type });
    return NextResponse.json(
      { error: { code: "ledger_unavailable", message: "Could not record the webhook event." } },
      { status: 500 },
    );
  }

  if (!claimed) {
    // Already processed. Acknowledge so Stripe stops retrying.
    return NextResponse.json({ received: true, duplicate: true });
  }

  try {
    const result = await applyStripeEvent(admin, stripe, event);
    await finishEvent(admin, event.id, result.applied ? "processed" : "ignored", result.reason);
    return NextResponse.json({
      received: true,
      applied: result.applied,
      ...(result.reason ? { note: result.reason } : {}),
    });
  } catch (error) {
    logServerError("billing.webhook.apply", error, { eventId: event.id, type: event.type });
    await finishEvent(
      admin,
      event.id,
      "failed",
      error instanceof Error ? error.message : "unknown",
    );
    // 500 so the provider retries: the customer's entitlements are still wrong.
    return NextResponse.json(
      { error: { code: "apply_failed", message: "Event could not be applied." } },
      { status: 500 },
    );
  }
}
