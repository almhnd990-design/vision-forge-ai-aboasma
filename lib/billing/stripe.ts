import "server-only";

import Stripe from "stripe";
import {
  PLANS,
  PLAN_IDS,
  isPlanId,
  type BillingInterval,
  type BillingStatus,
  type PlanId,
} from "@/lib/plans";

/**
 * Billing is only "configured" when every variable below exists.
 * A partially configured account is treated as unconfigured: we would rather show an
 * explicit configuration requirement than create a customer we cannot bill correctly.
 */
export const REQUIRED_BILLING_ENV = [
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "STRIPE_PRICE_STARTER",
  "STRIPE_PRICE_GROWTH",
  "STRIPE_PRICE_SCALE",
] as const;

export function billingEnvStatus(): {
  configured: boolean;
  missing: string[];
} {
  const missing = REQUIRED_BILLING_ENV.filter(
    (key) => !(process.env[key] ?? "").trim(),
  );
  return { configured: missing.length === 0, missing: [...missing] };
}

export function isStripeConfigured(): boolean {
  return billingEnvStatus().configured;
}

let cached: Stripe | null = null;

/** Server-only Stripe client. Never import this from a Client Component. */
export function getStripe(): Stripe | null {
  if (cached) return cached;
  const secret = (process.env.STRIPE_SECRET_KEY ?? "").trim();
  if (!secret) return null;
  cached = new Stripe(secret, {
    maxNetworkRetries: 2,
    timeout: 20_000,
  });
  return cached;
}

/** plan id -> configured Stripe price id. The mapping lives in lib/plans.ts. */
export function priceIdForPlan(planId: PlanId): string | null {
  const envKey = PLANS[planId].stripePriceEnvKey;
  const value = (process.env[envKey] ?? "").trim();
  return value || null;
}

/** Stripe price id -> plan id, for webhook payloads. */
export function planForPriceId(priceId: string | null | undefined): PlanId | null {
  if (!priceId) return null;
  for (const id of PLAN_IDS) {
    if (priceIdForPlan(id) === priceId) return id;
  }
  return null;
}

/** Reverse lookup used when a subscription arrives without a price id we recognise. */
export function planForPriceLookupKey(key: string | null | undefined): PlanId | null {
  if (!key) return null;
  return isPlanId(key) ? key : null;
}

/**
 * Map a provider subscription status onto our own state machine.
 * `invoice.payment_failed` is handled separately because Stripe keeps the
 * subscription `active` while a payment is retried.
 */
export function mapStripeStatus(status: string): BillingStatus {
  switch (status) {
    case "trialing":
      return "trialing";
    case "active":
      return "active";
    case "past_due":
      return "past_due";
    case "canceled":
      return "canceled";
    case "unpaid":
      return "unpaid";
    case "incomplete":
      return "incomplete";
    case "incomplete_expired":
      return "canceled";
    case "paused":
      return "paused";
    default:
      return "none";
  }
}

export function intervalFromPrice(price: Stripe.Price | null | undefined): BillingInterval | null {
  const interval = price?.recurring?.interval;
  if (interval === "month") return "month";
  if (interval === "year") return "year";
  return null;
}

/** Absolute URLs for Stripe redirects. Derived from one configuration value. */
export function returnUrl(
  locale: string,
  path: string,
  appUrl: string,
): string {
  const base = appUrl.replace(/\/$/, "");
  const safeLocale = locale === "ar" ? "ar" : "en";
  return `${base}/${safeLocale}${path}`;
}
