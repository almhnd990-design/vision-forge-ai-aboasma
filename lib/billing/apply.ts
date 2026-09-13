import "server-only";

import type Stripe from "stripe";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { BillingInterval, BillingStatus, PlanId } from "@/lib/plans";
import type { BillingCustomerRow } from "@/lib/db/types";
import {
  intervalFromPrice,
  mapStripeStatus,
  planForPriceId,
  planForPriceLookupKey,
} from "./stripe";

/**
 * Applies VERIFIED Stripe state to our own billing mirror.
 *
 * Every function here runs with the service-role client and therefore bypasses RLS.
 * It must only ever be called from the webhook route after signature verification,
 * or from a route that has already proven the caller owns the workspace.
 *
 * The browser can read this mirror (RLS) but can never write it: migration 0002 adds
 * a trigger that rejects client-originated changes to the billing columns.
 */

export type ApplyResult = { applied: boolean; reason?: string };

type SubscriptionState = {
  status: BillingStatus;
  planId: PlanId | null;
  priceId: string | null;
  interval: BillingInterval | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  trialEndsAt: string | null;
};

/** Reduce a Stripe subscription to the fields we persist. */
export function readSubscriptionState(
  subscription: Stripe.Subscription,
): SubscriptionState {
  const item = subscription.items?.data?.[0];
  const price = item?.price ?? null;
  const priceId = price?.id ?? null;
  const planId =
    planForPriceId(priceId) ??
    planForPriceLookupKey(price?.lookup_key ?? null) ??
    planForPriceLookupKey((subscription.metadata?.plan_id as string) ?? null);

  // Stripe moved period boundaries onto subscription items in recent API versions.
  const periodEnd =
    (item as unknown as { current_period_end?: number } | undefined)
      ?.current_period_end ??
    (subscription as unknown as { current_period_end?: number }).current_period_end;

  return {
    status: mapStripeStatus(subscription.status),
    planId,
    priceId,
    interval: intervalFromPrice(price),
    currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
    cancelAtPeriodEnd: Boolean(subscription.cancel_at_period_end),
    trialEndsAt: subscription.trial_end
      ? new Date(subscription.trial_end * 1000).toISOString()
      : null,
  };
}

/**
 * Idempotency gate. Returns false when this provider event id has already been
 * processed, so a retried delivery can never double-apply a subscription change.
 */
export async function claimEvent(
  admin: SupabaseClient,
  event: { id: string; type: string; provider?: "stripe" },
): Promise<boolean> {
  const provider = event.provider ?? "stripe";
  const { error } = await admin.from("billing_events").insert({
    provider,
    event_id: event.id,
    event_type: event.type,
    status: "received",
  });
  if (!error) return true;
  // 23505 = unique violation: the event was already recorded.
  if (error.code === "23505") return false;
  throw new Error(`could not record billing event: ${error.message}`);
}

export async function finishEvent(
  admin: SupabaseClient,
  eventId: string,
  status: "processed" | "ignored" | "failed",
  error?: string,
): Promise<void> {
  await admin
    .from("billing_events")
    .update({
      status,
      processed_at: new Date().toISOString(),
      error: error ? error.slice(0, 500) : null,
    })
    .eq("event_id", eventId);
}

/** Find the workspace that owns a Stripe customer id. */
export async function workspaceForCustomer(
  admin: SupabaseClient,
  customerId: string,
): Promise<string | null> {
  const { data } = await admin
    .from("billing_customers")
    .select("workspace_id")
    .eq("provider", "stripe")
    .eq("customer_id", customerId)
    .maybeSingle<{ workspace_id: string }>();
  return data?.workspace_id ?? null;
}

export async function readBillingRecord(
  admin: SupabaseClient,
  workspaceId: string,
): Promise<BillingCustomerRow | null> {
  const { data } = await admin
    .from("billing_customers")
    .select("*")
    .eq("workspace_id", workspaceId)
    .maybeSingle<BillingCustomerRow>();
  return data ?? null;
}

/** Identifier of the Stripe object that a webhook event is about. */
function subscriptionIdOf(event: Stripe.Event): string | null {
  const object = event.data.object as { id?: string; subscription?: string | { id?: string } };
  if (event.type.startsWith("customer.subscription.")) return object.id ?? null;
  if (event.type === "checkout.session.completed") {
    const sub = object.subscription;
    if (typeof sub === "string") return sub;
    if (sub && typeof sub === "object" && "id" in sub) return sub.id ?? null;
    return null;
  }
  const sub = object.subscription;
  if (typeof sub === "string") return sub;
  if (sub && typeof sub === "object" && "id" in sub) return sub.id ?? null;
  return null;
}

async function applyState(
  admin: SupabaseClient,
  workspaceId: string,
  state: SubscriptionState,
  extras: { customerId?: string; subscriptionId?: string | null; eventId?: string } = {},
): Promise<void> {
  const now = new Date().toISOString();

  const patch: Record<string, unknown> = {
    plan_id: state.planId,
    billing_status: state.status,
    billing_interval: state.interval,
    trial_ends_at: state.trialEndsAt,
    current_period_end: state.currentPeriodEnd,
  };

  const { error: workspaceError } = await admin
    .from("workspaces")
    .update(patch)
    .eq("id", workspaceId);
  if (workspaceError) {
    throw new Error(`could not update workspace billing: ${workspaceError.message}`);
  }

  const customerPatch: Record<string, unknown> = {
    workspace_id: workspaceId,
    provider: "stripe",
    plan_id: state.planId,
    price_id: state.priceId,
    billing_interval: state.interval,
    status: state.status,
    current_period_end: state.currentPeriodEnd,
    cancel_at_period_end: state.cancelAtPeriodEnd,
    trial_ends_at: state.trialEndsAt,
    updated_at: now,
  };
  if (extras.customerId) customerPatch.customer_id = extras.customerId;
  if (extras.subscriptionId !== undefined) {
    customerPatch.subscription_id = extras.subscriptionId;
  }
  if (extras.eventId) customerPatch.last_event_id = extras.eventId;

  const { error: billingError } = await admin
    .from("billing_customers")
    .upsert(customerPatch, { onConflict: "workspace_id" });
  if (billingError) {
    throw new Error(`could not update billing record: ${billingError.message}`);
  }

  await admin.from("audit_events").insert({
    workspace_id: workspaceId,
    actor_type: "provider",
    action: "billing.subscription_updated",
    target_type: "subscription",
    target_id: extras.subscriptionId ?? null,
    metadata: {
      status: state.status,
      plan_id: state.planId,
      interval: state.interval,
      cancel_at_period_end: state.cancelAtPeriodEnd,
    },
  });
}

/** Persist the customer id when checkout starts, before any subscription exists. */
export async function linkCustomer(
  admin: SupabaseClient,
  workspaceId: string,
  customerId: string,
): Promise<void> {
  const existing = await readBillingRecord(admin, workspaceId);
  await admin.from("billing_customers").upsert(
    {
      workspace_id: workspaceId,
      provider: "stripe",
      customer_id: customerId,
      subscription_id: existing?.subscription_id ?? null,
      plan_id: existing?.plan_id ?? null,
      price_id: existing?.price_id ?? null,
      billing_interval: existing?.billing_interval ?? null,
      status: existing?.status ?? "none",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "workspace_id" },
  );
}

/**
 * Apply one verified event.
 * Returns `applied: false` with a reason when the event is not relevant to us,
 * which keeps webhook behaviour observable instead of silently dropping events.
 */
export async function applyStripeEvent(
  admin: SupabaseClient,
  stripe: Stripe,
  event: Stripe.Event,
): Promise<ApplyResult> {
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const customerId =
        typeof session.customer === "string" ? session.customer : session.customer?.id;
      const subscriptionId =
        typeof session.subscription === "string"
          ? session.subscription
          : session.subscription?.id ?? null;
      const workspaceId =
        session.metadata?.workspace_id ??
        (customerId ? await workspaceForCustomer(admin, customerId) : null);
      if (!workspaceId) return { applied: false, reason: "no workspace for session" };
      if (customerId) {
        await linkCustomer(admin, workspaceId, customerId);
      }
      if (!subscriptionId) {
        // One-off payment or a session without a subscription: nothing to mirror yet.
        return { applied: false, reason: "session has no subscription" };
      }
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      await applyState(admin, workspaceId, readSubscriptionState(subscription), {
        customerId: customerId ?? undefined,
        subscriptionId,
        eventId: event.id,
      });
      return { applied: true };
    }

    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      const customerId =
        typeof subscription.customer === "string"
          ? subscription.customer
          : subscription.customer?.id;
      const workspaceId =
        subscription.metadata?.workspace_id ??
        (customerId ? await workspaceForCustomer(admin, customerId) : null);
      if (!workspaceId) return { applied: false, reason: "no workspace for customer" };
      await applyState(admin, workspaceId, readSubscriptionState(subscription), {
        customerId,
        subscriptionId: subscription.id,
        eventId: event.id,
      });
      return { applied: true };
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      const customerId =
        typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
      if (!customerId) return { applied: false, reason: "invoice has no customer" };
      const workspaceId = await workspaceForCustomer(admin, customerId);
      if (!workspaceId) return { applied: false, reason: "no workspace for customer" };

      /*
       * Stripe keeps the subscription `active` while it retries. Surface the failure
       * immediately so entitlements are not silently granted during a dunning cycle.
       */
      await admin
        .from("workspaces")
        .update({ billing_status: "past_due" })
        .eq("id", workspaceId);
      await admin
        .from("billing_customers")
        .update({ status: "past_due", last_event_id: event.id, updated_at: new Date().toISOString() })
        .eq("workspace_id", workspaceId);
      await admin.from("audit_events").insert({
        workspace_id: workspaceId,
        actor_type: "provider",
        action: "billing.payment_failed",
        target_type: "invoice",
        target_id: invoice.id ?? null,
        metadata: {
          amount_due: invoice.amount_due ?? null,
          attempt_count: invoice.attempt_count ?? null,
          subscription: subscriptionIdOf(event),
        },
      });
      return { applied: true };
    }

    case "invoice.paid":
    case "invoice.payment_succeeded": {
      const invoice = event.data.object as Stripe.Invoice;
      const customerId =
        typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
      if (!customerId) return { applied: false, reason: "invoice has no customer" };
      const workspaceId = await workspaceForCustomer(admin, customerId);
      if (!workspaceId) return { applied: false, reason: "no workspace for customer" };
      const subscriptionId = subscriptionIdOf(event);
      if (!subscriptionId) return { applied: false, reason: "invoice has no subscription" };
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      await applyState(admin, workspaceId, readSubscriptionState(subscription), {
        customerId,
        subscriptionId,
        eventId: event.id,
      });
      return { applied: true };
    }

    default:
      return { applied: false, reason: `unhandled event type ${event.type}` };
  }
}
