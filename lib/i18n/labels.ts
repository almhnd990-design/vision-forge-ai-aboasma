import type { Locale } from "@/lib/locale";

/**
 * Label sets shared between the plan registry and the pricing UI.
 *
 * Kept separate from the dictionaries so that `lib/plans.ts` stays free of translation
 * dependencies, while the UI still gets one typed place for the words it needs.
 */

export type PriceLabels = {
  perMonth: string;
  perYear: string;
  unlimited: string;
  none: string;
};

export const PRICE_LABELS: Record<Locale, PriceLabels> = {
  en: {
    perMonth: "/month",
    perYear: "/year",
    unlimited: "Unlimited",
    none: "Not included",
  },
  ar: {
    perMonth: "/شهريًا",
    perYear: "/سنويًا",
    unlimited: "غير محدود",
    none: "غير مشمول",
  },
};

export const FEATURE_STATUS_LABELS: Record<
  Locale,
  { live: string; beta: string; planned: string }
> = {
  en: { live: "Available", beta: "Beta", planned: "Coming soon" },
  ar: { live: "متاح", beta: "تجريبي", planned: "قريبًا" },
};

export const SUPPORT_LABELS: Record<
  Locale,
  { standard: string; priority: string; dedicated: string }
> = {
  en: {
    standard: "Standard email support",
    priority: "Priority support",
    dedicated: "Dedicated support",
  },
  ar: {
    standard: "دعم بالبريد الإلكتروني",
    priority: "دعم بأولوية",
    dedicated: "دعم مخصص",
  },
};
