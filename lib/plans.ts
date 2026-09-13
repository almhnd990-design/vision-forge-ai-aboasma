/**
 * Single source of truth for commercial plans, prices, limits and entitlements.
 *
 * RULES (do not break these):
 * 1. No price, plan name, limit or Stripe price ID may be hard-coded anywhere else
 *    in the application. Every UI, entitlement check, billing call and limit
 *    enforcement must read from this file.
 * 2. Prices are stored as INTEGER HALALAS (1 SAR = 100 halalas) to avoid float drift.
 * 3. A plan may only advertise a feature whose `availability` is `live` (or that is
 *    explicitly labelled otherwise in the UI). Never list an unimplemented feature
 *    as included.
 * 4. Changing a price, name, limit or Stripe Price ID must require editing only this file.
 */

import type { Locale } from "./locale";

export type { Locale };
export type Currency = "SAR";
export type BillingInterval = "month" | "year";
export type PlanId = "starter" | "growth" | "scale";

/** Billing lifecycle is derived from provider status; never from the client. */
export type BillingStatus =
  | "none"
  | "trialing"
  | "active"
  | "past_due"
  | "canceled"
  | "incomplete"
  | "unpaid"
  | "paused";

/** What a feature can honestly claim about itself. */
export type FeatureAvailability =
  | "live" // genuinely implemented and usable
  | "beta" // implemented but limited; UI must say so
  | "planned"; // not implemented; UI must say "Coming soon" and show no action

export type FeatureKey =
  | "deterministic_analysis"
  | "ai_reasoning"
  | "manual_snapshot"
  | "cloud_persistence"
  | "audit_trail"
  | "human_approval"
  | "data_export"
  | "connector_stripe"
  | "connector_shopify"
  | "connector_amazon"
  | "connector_gmail"
  | "scheduled_scans"
  | "team_seats"
  | "priority_support";

export type Feature = {
  key: FeatureKey;
  availability: FeatureAvailability;
  name: Record<Locale, string>;
  /** Short honest description of what it actually does today. */
  description: Record<Locale, string>;
};

/**
 * Central feature registry. `availability` is the ONLY place that decides whether
 * the marketing UI may present a feature as included or must present it as planned.
 */
export const FEATURES: Record<FeatureKey, Feature> = {
  deterministic_analysis: {
    key: "deterministic_analysis",
    availability: "live",
    name: { en: "Deterministic business analysis", ar: "تحليل أعمال حتمي" },
    description: {
      en: "Auditable rule-based engine: revenue decline, pending refunds, duplicate charge candidates, inventory cover. Same input always yields the same findings.",
      ar: "محرك قواعد قابل للتدقيق: انخفاض الإيراد، الاستردادات المعلقة، الرسوم المكررة المحتملة، تغطية المخزون. نفس المدخل يعطي نفس النتائج دائمًا.",
    },
  },
  ai_reasoning: {
    key: "ai_reasoning",
    availability: "live",
    name: { en: "AI reasoning layer", ar: "طبقة استدلال بالذكاء الاصطناعي" },
    description: {
      en: "Server-side summarisation, prioritisation and next-step drafting built strictly on top of the deterministic findings. It never invents numbers.",
      ar: "تلخيص وترتيب أولويات واقتراح خطوات على الخادم، مبنية فقط على النتائج الحتمية. لا تختلق أرقامًا أبدًا.",
    },
  },
  manual_snapshot: {
    key: "manual_snapshot",
    availability: "live",
    name: { en: "Manual snapshot & JSON import", ar: "إدخال يدوي واستيراد JSON" },
    description: {
      en: "Enter business figures directly or import a validated JSON snapshot.",
      ar: "أدخل أرقام أعمالك مباشرة أو استورد لقطة JSON مُتحقَّقًا منها.",
    },
  },
  cloud_persistence: {
    key: "cloud_persistence",
    availability: "live",
    name: { en: "Cloud workspaces", ar: "مساحات عمل سحابية" },
    description: {
      en: "Workspaces, snapshots and findings are stored server-side per account instead of a single browser.",
      ar: "مساحات العمل واللقطات والنتائج تُخزَّن على الخادم لكل حساب بدل متصفح واحد.",
    },
  },
  audit_trail: {
    key: "audit_trail",
    availability: "live",
    name: { en: "Server-side audit trail", ar: "سجل تدقيق على الخادم" },
    description: {
      en: "Every state change of a finding is recorded server-side with actor and timestamp.",
      ar: "كل تغيير في حالة النتيجة يُسجَّل على الخادم مع الفاعل والوقت.",
    },
  },
  human_approval: {
    key: "human_approval",
    availability: "live",
    name: { en: "Human approval workflow", ar: "مسار موافقة بشرية" },
    description: {
      en: "Findings move through detected → reviewed → approved. No money-moving action executes without explicit approval.",
      ar: "تمر النتائج بمراحل: مُكتشفة ← مُراجعة ← مُعتمدة. لا يُنفَّذ أي إجراء مالي دون موافقة صريحة.",
    },
  },
  data_export: {
    key: "data_export",
    availability: "live",
    name: { en: "Data export", ar: "تصدير البيانات" },
    description: {
      en: "Export your workspace data as JSON at any time.",
      ar: "صدّر بيانات مساحة عملك بصيغة JSON في أي وقت.",
    },
  },
  connector_stripe: {
    key: "connector_stripe",
    availability: "live",
    name: { en: "Stripe payments connector", ar: "موصل مدفوعات Stripe" },
    description: {
      en: "Read-only import of charges, refunds and payouts to build snapshots automatically.",
      ar: "استيراد للقراءة فقط للرسوم والاستردادات والمدفوعات لبناء اللقطات تلقائيًا.",
    },
  },
  connector_shopify: {
    key: "connector_shopify",
    availability: "planned",
    name: { en: "Shopify connector", ar: "موصل Shopify" },
    description: {
      en: "Orders, refunds and storefront performance. Requires OAuth app credentials, which are not configured.",
      ar: "الطلبات والاستردادات وأداء المتجر. يتطلب بيانات تطبيق OAuth وهي غير مهيأة.",
    },
  },
  connector_amazon: {
    key: "connector_amazon",
    availability: "planned",
    name: { en: "Amazon SP-API connector", ar: "موصل Amazon SP-API" },
    description: {
      en: "Seller fees, orders and reimbursements. Requires Amazon developer registration.",
      ar: "رسوم البائع والطلبات والتعويضات. يتطلب تسجيل مطوّر لدى Amazon.",
    },
  },
  connector_gmail: {
    key: "connector_gmail",
    availability: "planned",
    name: { en: "Gmail connector", ar: "موصل Gmail" },
    description: {
      en: "Business correspondence and supporting records. Requires Google OAuth credentials.",
      ar: "مراسلات العمل والمستندات الداعمة. يتطلب بيانات Google OAuth.",
    },
  },
  scheduled_scans: {
    key: "scheduled_scans",
    availability: "planned",
    name: { en: "Scheduled background scans", ar: "فحوصات مجدولة في الخلفية" },
    description: {
      en: "The backend is architected to support scheduled scans, but no scheduler is running yet. GhostOps does not monitor continuously today.",
      ar: "الخادم مهيأ معماريًا لفحوصات مجدولة، لكن لا يوجد مجدول يعمل بعد. GhostOps لا يراقب بشكل مستمر اليوم.",
    },
  },
  team_seats: {
    key: "team_seats",
    availability: "planned",
    name: { en: "Team seats", ar: "مقاعد للفريق" },
    description: {
      en: "Invite colleagues with role-based access. Not implemented in this release.",
      ar: "دعوة زملاء بصلاحيات محددة. غير مُنفَّذ في هذا الإصدار.",
    },
  },
  priority_support: {
    key: "priority_support",
    availability: "live",
    name: { en: "Priority support", ar: "دعم بأولوية" },
    description: {
      en: "Support requests are routed with a priority flag. Human response, not an automated SLA guarantee.",
      ar: "طلبات الدعم تُوجَّه بعلامة أولوية. رد بشري، وليس ضمان اتفاقية مستوى خدمة آلي.",
    },
  },
};

/** Hard limits. `null` means unlimited. */
export type Entitlements = {
  workspaces: number | null;
  /** Analyses per billing month. `null` = unlimited. */
  analysesPerMonth: number | null;
  connectedProviders: number | null;
  /** Provided now, enforced once a scheduler exists. */
  scheduledScans: number | null;
  /** Provided now, enforced once team seats exist. */
  teamSeats: number | null;
  dataRetentionDays: number | null;
  supportTier: "standard" | "priority" | "dedicated";
  features: FeatureKey[];
};

export type Plan = {
  id: PlanId;
  /** Marketing name. Keep it stable so invoices/receipts stay readable. */
  name: Record<Locale, string>;
  tagline: Record<Locale, string>;
  /** Position in the pricing table; 1 = entry. */
  rank: number;
  /** Whether this plan can be purchased today through the configured provider. */
  purchasable: boolean;
  prices: Record<BillingInterval, { amount: number; currency: Currency }>;
  /** Only the intervals actually offered right now. */
  intervalsOffered: BillingInterval[];
  trialDays: number;
  entitlements: Entitlements;
  /** Keys of FEATURES this plan includes. Rendered in pricing tables. */
  highlights: FeatureKey[];
  /** Environment variable that must hold this plan's provider price ID. */
  stripePriceEnvKey: string;
};

export const CURRENCY: Currency = "SAR";
export const DEFAULT_INTERVAL: BillingInterval = "month";

/**
 * Launch pricing. Draft figures approved for the initial MVP; change them here only.
 * Annual prices are intentionally not offered yet — `intervalsOffered` gates the UI.
 */
export const PLANS: Record<PlanId, Plan> = {
  starter: {
    id: "starter",
    name: { en: "Starter", ar: "المبتدئ" },
    tagline: {
      en: "For a single store owner who wants recoverable money found.",
      ar: "لمالك متجر واحد يريد اكتشاف الأموال القابلة للاسترداد.",
    },
    rank: 1,
    purchasable: true,
    prices: {
      month: { amount: 9900, currency: CURRENCY },
      year: { amount: 99000, currency: CURRENCY },
    },
    intervalsOffered: ["month"],
    trialDays: 14,
    entitlements: {
      workspaces: 1,
      analysesPerMonth: 30,
      connectedProviders: 1,
      scheduledScans: null,
      teamSeats: 1,
      dataRetentionDays: 90,
      supportTier: "standard",
      features: [
        "deterministic_analysis",
        "ai_reasoning",
        "manual_snapshot",
        "cloud_persistence",
        "human_approval",
        "audit_trail",
        "data_export",
        "connector_stripe",
      ],
    },
    highlights: [
      "deterministic_analysis",
      "ai_reasoning",
      "cloud_persistence",
      "human_approval",
      "audit_trail",
      "connector_stripe",
      "data_export",
    ],
    stripePriceEnvKey: "STRIPE_PRICE_STARTER",
  },
  growth: {
    id: "growth",
    name: { en: "Growth", ar: "النمو" },
    tagline: {
      en: "For operators running several storefronts and channels.",
      ar: "للمشغّلين الذين يديرون عدة متاجر وقنوات.",
    },
    rank: 2,
    purchasable: true,
    prices: {
      month: { amount: 29900, currency: CURRENCY },
      year: { amount: 299000, currency: CURRENCY },
    },
    intervalsOffered: ["month"],
    trialDays: 14,
    entitlements: {
      workspaces: 3,
      analysesPerMonth: 200,
      connectedProviders: 2,
      scheduledScans: null,
      teamSeats: 1,
      dataRetentionDays: 365,
      supportTier: "priority",
      features: [
        "deterministic_analysis",
        "ai_reasoning",
        "manual_snapshot",
        "cloud_persistence",
        "human_approval",
        "audit_trail",
        "data_export",
        "connector_stripe",
        "priority_support",
      ],
    },
    highlights: [
      "deterministic_analysis",
      "ai_reasoning",
      "cloud_persistence",
      "human_approval",
      "audit_trail",
      "connector_stripe",
      "data_export",
      "priority_support",
    ],
    stripePriceEnvKey: "STRIPE_PRICE_GROWTH",
  },
  scale: {
    id: "scale",
    name: { en: "Scale", ar: "التوسّع" },
    tagline: {
      en: "For teams that need higher volume and dedicated support.",
      ar: "للفرق التي تحتاج حجمًا أكبر ودعمًا مخصصًا.",
    },
    rank: 3,
    purchasable: true,
    prices: {
      month: { amount: 79900, currency: CURRENCY },
      year: { amount: 799000, currency: CURRENCY },
    },
    intervalsOffered: ["month"],
    trialDays: 14,
    entitlements: {
      workspaces: 10,
      analysesPerMonth: 1000,
      connectedProviders: 4,
      scheduledScans: null,
      teamSeats: 1,
      dataRetentionDays: 1095,
      supportTier: "dedicated",
      features: [
        "deterministic_analysis",
        "ai_reasoning",
        "manual_snapshot",
        "cloud_persistence",
        "human_approval",
        "audit_trail",
        "data_export",
        "connector_stripe",
        "priority_support",
      ],
    },
    highlights: [
      "deterministic_analysis",
      "ai_reasoning",
      "cloud_persistence",
      "human_approval",
      "audit_trail",
      "connector_stripe",
      "data_export",
      "priority_support",
    ],
    stripePriceEnvKey: "STRIPE_PRICE_SCALE",
  },
};

export const PLAN_IDS: PlanId[] = (Object.keys(PLANS) as PlanId[]).sort(
  (a, b) => PLANS[a].rank - PLANS[b].rank,
);

/** The plan a brand-new account starts on before any purchase. */
export const DEFAULT_PLAN_ID: PlanId = "starter";

/** A safe, explicitly non-paying plan snapshot for unauthenticated or unconfigured states. */
export const NO_PLAN: Entitlements = {
  workspaces: 0,
  analysesPerMonth: 0,
  connectedProviders: 0,
  scheduledScans: null,
  teamSeats: 1,
  dataRetentionDays: 0,
  supportTier: "standard",
  features: [],
};

export function isPlanId(value: unknown): value is PlanId {
  return typeof value === "string" && value in PLANS;
}

export function getPlan(id: PlanId): Plan {
  return PLANS[id];
}

export function getEntitlements(id: PlanId | null | undefined): Entitlements {
  if (!id || !isPlanId(id)) return NO_PLAN;
  return PLANS[id].entitlements;
}

export function planHasFeature(
  id: PlanId | null | undefined,
  feature: FeatureKey,
): boolean {
  return getEntitlements(id).features.includes(feature);
}

export function getFeature(key: FeatureKey): Feature {
  return FEATURES[key];
}

/** True when a feature may be marketed as included rather than as planned. */
export function isShippable(key: FeatureKey): boolean {
  return FEATURES[key].availability !== "planned";
}

/**
 * Whether a plan may be shown as purchasable given the current runtime environment.
 * Billing is only possible when the provider is fully configured for that plan.
 */
export function isPlanPurchasable(
  id: PlanId,
  billingConfigured: boolean,
): boolean {
  return PLANS[id].purchasable && billingConfigured;
}

/**
 * Formatting lives in `lib/pricing-format.ts` so this file stays pure configuration:
 * plan data, limits and pricing only.
 */

