"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, AlertTriangle, Sparkles } from "lucide-react";
import {
  DEFAULT_INTERVAL,
  FEATURES,
  PLANS,
  PLAN_IDS,
  type BillingInterval,
  type PlanId,
} from "@/lib/plans";
import type { Locale } from "@/lib/locale";
import { PRICE_LABELS } from "@/lib/i18n/labels";
import { formatPlanPrice } from "@/lib/pricing-format";
import { getDictionary } from "@/lib/i18n/dictionaries";

export type PricingBillingState = {
  /** True only when Supabase + Stripe are fully configured. */
  configured: boolean;
  /** Environment variables an operator still has to set. */
  missingEnv: string[];
  /** Whether a signed-in customer with a workspace can check out right now. */
  canCheckout: boolean;
  workspaceId?: string | null;
};

export type PricingCardsProps = {
  locale: Locale;
  billing: PricingBillingState;
  /** `section` renders the landing-page block, `page` renders the full pricing page. */
  variant?: "section" | "page";
};

/**
 * Pricing UI.
 *
 * Every number, name and limit comes from `lib/plans.ts`. This component contains no
 * price literal and no plan name literal, so changing the offer requires editing one file.
 *
 * Honesty rules enforced here:
 *  - when billing is unconfigured the CTA is replaced by a configuration notice that names
 *    the missing variables — no button that could imply a purchase is possible;
 *  - only features whose availability is not `planned` are listed as included;
 *  - annual billing is not offered until a plan declares it.
 */
export function PricingCards({ locale, billing, variant = "section" }: PricingCardsProps) {
  const t = getDictionary(locale).pricing;
  const [interval, setInterval] = useState<BillingInterval>(DEFAULT_INTERVAL);
  const [pendingPlan, setPendingPlan] = useState<PlanId | null>(null);
  const [error, setError] = useState("");

  const intervals = [...new Set(PLAN_IDS.flatMap((id) => PLANS[id].intervalsOffered))];

  async function startCheckout(planId: PlanId) {
    setError("");
    if (!billing.canCheckout || !billing.workspaceId) return;
    setPendingPlan(planId);
    try {
      const response = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ workspaceId: billing.workspaceId, planId, interval, locale }),
      });
      const payload = (await response.json()) as {
        url?: string;
        error?: { message?: string };
      };
      if (!response.ok || !payload.url) {
        setError(payload.error?.message ?? t.checkoutUnavailableCopy);
        return;
      }
      window.location.assign(payload.url);
    } catch {
      setError(t.checkoutUnavailableCopy);
    } finally {
      setPendingPlan(null);
    }
  }

  return (
    <section className={variant === "page" ? "container pricing-section" : "section container pricing-section"} id="pricing">
      <div className="pricing-head">
        <div className="eyebrow">{t.eyebrow}</div>
        <h2>{t.title}</h2>
        <p>{t.copy}</p>
        {intervals.length > 1 && (
          <div className="interval-toggle" role="group" aria-label={t.monthly}>
            {intervals.map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={interval === option}
                onClick={() => setInterval(option)}
              >
                {option === "month" ? t.monthly : option}
              </button>
            ))}
          </div>
        )}
      </div>

      {!billing.configured && (
        <div className="plan-config-note" role="status">
          <h3>{t.checkoutUnavailableTitle}</h3>
          <p>{t.checkoutUnavailableCopy}</p>
          <p>
            <strong>{t.requiredEnv}:</strong>{" "}
            {billing.missingEnv.length > 0 ? (
              billing.missingEnv.map((name) => <code key={name}>{name}</code>)
            ) : (
              <code>SUPABASE_SERVICE_ROLE_KEY</code>
            )}
          </p>
        </div>
      )}

      <div className="pricing-grid">
        {PLAN_IDS.map((planId) => {
          const plan = PLANS[planId];
          const featured = plan.rank === 2;
          const price = plan.prices[interval];
          const limits = plan.entitlements;
          return (
            <article
              key={planId}
              className={`plan-card${featured ? " featured" : ""}`}
              data-plan-id={planId}
              data-plan-interval={interval}
              data-trial-days={plan.trialDays}
              data-price-halalas={price.amount}
              data-currency={price.currency}
            >
              {featured && <span className="plan-badge">{t.mostPopular}</span>}
              <div>
                <h3 className="plan-name" data-plan-name>
                  {plan.name[locale]}
                </h3>
                <p className="plan-tagline">{plan.tagline[locale]}</p>
              </div>

              <div className="plan-price">
                <strong>{formatPlanPrice(price.amount, locale, PRICE_LABELS[locale], interval)}</strong>
              </div>
              <p className="plan-trial">
                {t.trialBadge.replace("{{days}}", String(plan.trialDays))}
              </p>

              <dl className="plan-limits">
                <div>
                  <dt>{t.limitsLabel.workspaces}</dt>
                  <span>{limits.workspaces ?? t.limitValue.unlimited}</span>
                </div>
                <div>
                  <dt>{t.limitsLabel.analyses}</dt>
                  <span>
                    {limits.analysesPerMonth === null
                      ? t.limitValue.unlimited
                      : `${limits.analysesPerMonth} ${t.limitValue.perMonth}`}
                  </span>
                </div>
                <div>
                  <dt>{t.limitsLabel.providers}</dt>
                  <span>
                    {limits.connectedProviders === null
                      ? t.limitValue.unlimited
                      : limits.connectedProviders}
                  </span>
                </div>
                <div>
                  <dt>{t.limitsLabel.retention}</dt>
                  <span>
                    {limits.dataRetentionDays === null
                      ? t.limitValue.unlimited
                      : `${limits.dataRetentionDays} ${t.limitValue.days}`}
                  </span>
                </div>
                <div>
                  <dt>{t.limitsLabel.support}</dt>
                  <span>{t.support[limits.supportTier === "dedicated" ? "dedicated" : limits.supportTier]}</span>
                </div>
              </dl>

              <ul className="plan-features">
                {plan.highlights.map((key) => (
                  <li key={key}>
                    <Check size={15} aria-hidden="true" />
                    <span>{FEATURES[key].name[locale]}</span>
                  </li>
                ))}
              </ul>

              {billing.canCheckout ? (
                <button
                  type="button"
                  className={featured ? "button button-primary" : "button button-outline"}
                  onClick={() => startCheckout(planId)}
                  disabled={pendingPlan !== null}
                >
                  <Sparkles size={16} aria-hidden="true" />
                  {pendingPlan === planId ? "…" : t.cta}
                </button>
              ) : (
                <Link
                  href={`/${locale}/sign-up`}
                  className={featured ? "button button-primary" : "button button-outline"}
                >
                  {billing.configured ? t.cta : t.ctaSignIn}
                </Link>
              )}
            </article>
          );
        })}
      </div>

      {error && (
        <p className="plan-error" role="alert">
          <AlertTriangle size={14} aria-hidden="true" /> {error}
        </p>
      )}

      <p className="pricing-honest">{t.honestNotice}</p>

      {variant === "page" && (
        <div className="faq-grid">
          {t.faq.map(([question, answer]) => (
            <details key={question}>
              <summary>{question}</summary>
              <p>{answer}</p>
            </details>
          ))}
        </div>
      )}
    </section>
  );
}
