/**
 * Commercial architecture unit tests.
 *
 * These run without any external credentials and assert the properties that make the
 * product honest: central pricing, availability gating, server-side entitlement logic,
 * deterministic analysis, approval state machine and AI anti-fabrication.
 *
 * Run with: npm run test:unit
 */

import assert from "node:assert/strict";
import {
  PLANS,
  PLAN_IDS,
  FEATURES,
  NO_PLAN,
  getEntitlements,
  isPlanPurchasable,
  isShippable,
  planHasFeature,
} from "../lib/plans.ts";
import { PRICE_LABELS } from "../lib/i18n/labels.ts";
import { formatPlanPrice, formatHalalas } from "../lib/pricing-format.ts";
import {
  checkAnalysisQuota,
  checkConnectionQuota,
  entitlementState,
  resolveActivePlanId,
} from "../lib/db/access.ts";
import {
  safeRedirectPath,
  signUpSchema,
  signInSchema,
  describeAuthError,
} from "../lib/auth/client.ts";
import { LEGAL_DOC_KEYS, getLegalDoc } from "../lib/legal/content.ts";
import { cadenceToMs, nextRunFrom } from "../lib/agent/schedule.ts";
import { runDeterministicEngine, engineSignature, stableInsightId } from "../lib/agent/engine.ts";
import { canTransition, ALLOWED_TRANSITIONS } from "../lib/agent/service.ts";
import { validateAiOutput, resolveProvider, AI_UNAVAILABLE } from "../lib/ai/reason.ts";
import { CONNECTOR_SPECS, PROVIDER_KEYS, isConnectorImplemented } from "../lib/connectors/registry.ts";
import { stripeConnectorSpec } from "../lib/connectors/stripe-connector.ts";

let checks = 0;
const check = (condition, label) => {
  assert.ok(condition, label);
  checks++;
  console.log(`PASS ${label}`);
};

// ---------------------------------------------------------------------------
// 1. Central pricing
// ---------------------------------------------------------------------------

check(PLAN_IDS.length === 3, "exactly three plans are defined");
check(
  JSON.stringify(PLAN_IDS) === JSON.stringify(["starter", "growth", "scale"]),
  "plans are ordered by rank: starter, growth, scale",
);
check(PLANS.starter.prices.month.amount === 9900, "Starter is SAR 99/month as integer halalas");
check(PLANS.growth.prices.month.amount === 29900, "Growth is SAR 299/month as integer halalas");
check(PLANS.scale.prices.month.amount === 79900, "Scale is SAR 799/month as integer halalas");
check(
  Object.values(PLANS).every((p) => p.prices.month.currency === "SAR"),
  "every plan is priced in SAR",
);
check(
  Object.values(PLANS).every((p) => p.intervalsOffered.includes("month")),
  "monthly billing is offered on every plan",
);
check(
  Object.values(PLANS).every((p) => p.prices.year.amount > 0),
  "annual price data exists so yearly billing can be enabled without a schema change",
);
check(
  Object.values(PLANS).every((p) => !p.intervalsOffered.includes("year")),
  "annual billing is NOT offered yet (prices exist but the UI is gated)",
);
check(
  new Set(Object.values(PLANS).map((p) => p.stripePriceEnvKey)).size === 3,
  "each plan maps to a distinct Stripe price environment variable",
);
check(
  Object.values(PLANS).every((p) => p.stripePriceEnvKey.startsWith("STRIPE_PRICE_")),
  "Stripe price env keys use the documented naming",
);
check(
  formatPlanPrice(9900, "en", PRICE_LABELS.en, "month").includes("99"),
  "formatPlanPrice renders the launch price",
);
check(
  formatPlanPrice(9900, "ar", PRICE_LABELS.ar, "month").length > 0,
  "formatPlanPrice works for Arabic",
);
check(
  formatHalalas(79900, "en").includes("799") && formatHalalas(79900, "en").includes("SAR"),
  "formatHalalas renders SAR with the configured amount",
);

// ---------------------------------------------------------------------------
// 2. Availability gating — never advertise an unimplemented feature
// ---------------------------------------------------------------------------

const advertised = new Set();
for (const id of PLAN_IDS) {
  for (const key of PLANS[id].highlights) advertised.add(key);
}
const dishonest = [...advertised].filter((key) => !isShippable(key));
check(
  dishonest.length === 0,
  `no plan advertises a planned feature (offenders: ${dishonest.join(", ") || "none"})`,
);
check(
  Object.values(PLANS).every((p) =>
    p.entitlements.features.every((f) => isShippable(f)),
  ),
  "no plan grants an entitlement for an unimplemented feature",
);
check(
  FEATURES.connector_shopify.availability === "planned" &&
    FEATURES.connector_amazon.availability === "planned" &&
    FEATURES.connector_gmail.availability === "planned",
  "Shopify, Amazon and Gmail are recorded as planned, not live",
);
check(
  FEATURES.scheduled_scans.availability === "planned",
  "scheduled/background scans are recorded as planned (no scheduler exists)",
);
check(
  FEATURES.team_seats.availability === "planned",
  "team seats are recorded as planned",
);
check(
  FEATURES.deterministic_analysis.availability === "live" &&
    FEATURES.connector_stripe.availability === "live",
  "the deterministic engine and the Stripe connector are recorded as live",
);

// ---------------------------------------------------------------------------
// 3. Entitlements and billing state
// ---------------------------------------------------------------------------

check(getEntitlements("growth").workspaces === 3, "Growth allows 3 workspaces");
check(
  getEntitlements("scale").analysesPerMonth === 1000,
  "Scale allows 1000 analyses per month",
);
check(NO_PLAN.workspaces === 0 && NO_PLAN.features.length === 0, "the no-plan state grants nothing");
check(!planHasFeature(null, "deterministic_analysis"), "an unknown plan has no features");

check(
  resolveActivePlanId({ plan_id: "growth", billing_status: "active" }) === "growth",
  "an active subscription resolves to its plan",
);
check(
  resolveActivePlanId({ plan_id: "growth", billing_status: "past_due" }) === null,
  "past_due grants no paid entitlements",
);
check(
  resolveActivePlanId({ plan_id: "growth", billing_status: "canceled" }) === null,
  "a canceled subscription grants no entitlements",
);
check(
  resolveActivePlanId({
    plan_id: "growth",
    billing_status: "trialing",
    trial_ends_at: new Date(Date.now() + 86_400_000).toISOString(),
  }) === "growth",
  "an unexpired trial grants its plan",
);
check(
  resolveActivePlanId({
    plan_id: "growth",
    billing_status: "trialing",
    trial_ends_at: new Date(Date.now() - 86_400_000).toISOString(),
  }) === null,
  "an expired trial grants nothing",
);
check(
  resolveActivePlanId({ plan_id: "growth", billing_status: "active", trial_ends_at: null }) ===
    "growth",
  "trial expiry does not affect an active subscription",
);

const blocked = entitlementState({ plan_id: "starter", billing_status: "past_due" });
check(blocked.planId === null && blocked.blockedReason === "past_due", "past_due is reported as a blocked reason");

// ---------------------------------------------------------------------------
// 4. Server-side quota enforcement
// ---------------------------------------------------------------------------

const starterState = entitlementState({ plan_id: "starter", billing_status: "active" });
check(
  checkAnalysisQuota(starterState, 29).allowed === true,
  "an analysis is allowed below the plan limit",
);
check(
  checkAnalysisQuota(starterState, 30).allowed === false &&
    checkAnalysisQuota(starterState, 30).reason === "quota_exceeded",
  "the analysis limit is enforced at the boundary",
);

const scaleState = entitlementState({ plan_id: "scale", billing_status: "active" });
check(checkAnalysisQuota(scaleState, 999).allowed === true, "Scale allows an analysis below 1000");
check(checkAnalysisQuota(scaleState, 1000).allowed === false, "Scale blocks at 1000 analyses");

const noPlanQuota = checkAnalysisQuota(NO_PLAN && entitlementState({ plan_id: null, billing_status: "none" }), 0);
check(noPlanQuota.allowed === false, "an account without a plan cannot run an analysis");

check(
  checkConnectionQuota(starterState, 1).allowed === false,
  "Starter cannot connect a second provider",
);
check(
  checkConnectionQuota(entitlementState({ plan_id: "scale", billing_status: "active" }), 3).allowed ===
    true,
  "Scale allows up to four connected providers",
);

// ---------------------------------------------------------------------------
// 5. Deterministic engine
// ---------------------------------------------------------------------------

const snapshot = {
  workspaceId: "ws-1",
  revenueCents: 800_000,
  previousRevenueCents: 1_000_000,
  refundPendingCents: 25_000,
  inventoryDays: 3,
  duplicateChargeCandidates: [
    { id: "candidate-1", amountCents: 12_000, description: "Duplicate candidate" },
  ],
};

const first = runDeterministicEngine(snapshot);
const second = runDeterministicEngine(snapshot);
check(first.length === 4, "a distressed snapshot yields the four documented findings");
check(
  engineSignature(first) === engineSignature(second),
  "identical input produces an identical finding signature",
);
check(
  first.every((f, i) => f.id === stableInsightId(f, i)),
  "finding ids are stable across runs (required for persistence)",
);
check(
  first.some((f) => f.kind === "operations" && f.severity === "critical"),
  "inventory under 5 days is critical",
);
check(
  first.filter((f) => f.requiresApproval).length === 1,
  "only the duplicate-charge finding requires human approval",
);
check(
  first.every((f) => f.evidence.length > 0),
  "every finding carries deterministic evidence",
);

const healthy = runDeterministicEngine({
  ...snapshot,
  revenueCents: 1_000_000,
  refundPendingCents: 0,
  inventoryDays: 30,
  duplicateChargeCandidates: [],
});
check(healthy.length === 0, "a healthy snapshot produces no invented findings");

// ---------------------------------------------------------------------------
// 6. Approval state machine
// ---------------------------------------------------------------------------

check(canTransition("detected", "reviewed"), "detected -> reviewed is allowed");
check(canTransition("reviewed", "approved"), "reviewed -> approved is allowed");
check(!canTransition("detected", "approved"), "detected -> approved is NOT allowed (must be reviewed)");
check(!canTransition("detected", "completed"), "detected -> completed is NOT allowed");
check(
  !canTransition("dismissed", "completed"),
  "a dismissed finding cannot be completed",
);
check(
  ALLOWED_TRANSITIONS.completed.length === 0,
  "completed is terminal",
);
check(canTransition("approved", "executing"), "an approved finding may move to executing");
check(canTransition("executing", "failed"), "a failed execution is representable");

// ---------------------------------------------------------------------------
// 7. AI anti-fabrication
// ---------------------------------------------------------------------------

const findings = runDeterministicEngine(snapshot);

const fabricated = validateAiOutput(
  {
    summary: "Looks fine",
    reasoning: [
      {
        findingId: "invented-finding-id",
        priorityRank: 1,
        explanation: "There is an extra 5000 SAR charge",
        nextSteps: ["Refund it"],
        missingInformation: [],
      },
    ],
  },
  findings,
);
check(
  fabricated === null || fabricated.reasoning.length === 0,
  "AI output referencing an unknown finding id is rejected",
);

const valid = validateAiOutput(
  {
    summary: "Two issues need review",
    reasoning: [
      {
        findingId: findings[0].id,
        priorityRank: 1,
        explanation: "Revenue fell against the comparison window.",
        nextSteps: ["Check conversion rate"],
        missingInformation: ["Traffic sources"],
      },
      { findingId: findings[0].id, priorityRank: 2, explanation: "duplicate", nextSteps: [], missingInformation: [] },
      { findingId: "nope", priorityRank: 3, explanation: "x", nextSteps: [], missingInformation: [] },
    ],
  },
  findings,
);
check(valid !== null && valid.reasoning.length === 1, "duplicate and unknown reasoning entries are dropped");
check(
  valid.reasoning[0].nextSteps.length === 1 && valid.reasoning[0].missingInformation.length === 1,
  "validated reasoning keeps next steps and missing information",
);

check(validateAiOutput({ reasoning: [] }, findings) === null, "empty AI output is rejected rather than stored");
check(validateAiOutput(null, findings) === null, "null AI output is rejected");

const savedOpenAi = process.env.OPENAI_API_KEY;
const savedDeepSeek = process.env.DEEPSEEK_API_KEY;
delete process.env.OPENAI_API_KEY;
delete process.env.DEEPSEEK_API_KEY;
check(resolveProvider() === null, "no provider resolves when both keys are absent");
check(
  AI_UNAVAILABLE.available === false && AI_UNAVAILABLE.reason.length > 0,
  "the unavailable state carries a human-readable reason (never fake AI output)",
);
process.env.OPENAI_API_KEY = "test-key";
check(resolveProvider()?.provider.key === "openai", "OpenAI is selected when its key exists");
delete process.env.OPENAI_API_KEY;
process.env.DEEPSEEK_API_KEY = "test-key";
check(resolveProvider()?.provider.key === "deepseek", "DeepSeek is used when it is the only configured provider");
if (savedOpenAi === undefined) delete process.env.OPENAI_API_KEY;
else process.env.OPENAI_API_KEY = savedOpenAi;
if (savedDeepSeek === undefined) delete process.env.DEEPSEEK_API_KEY;
else process.env.DEEPSEEK_API_KEY = savedDeepSeek;

// ---------------------------------------------------------------------------
// 8. Connector registry honesty
// ---------------------------------------------------------------------------

check(PROVIDER_KEYS.length === 4, "four providers are known to the product");
check(isConnectorImplemented("stripe") === true, "Stripe is implemented");
check(isConnectorImplemented("shopify") === false, "Shopify is not implemented");
check(isConnectorImplemented("amazon") === false, "Amazon is not implemented");
check(isConnectorImplemented("gmail") === false, "Gmail is not implemented");
check(
  CONNECTOR_SPECS.shopify.status === "planned" && CONNECTOR_SPECS.shopify.credentialFields.length === 0,
  "a planned connector exposes no credential fields, so the UI cannot offer a fake form",
);
check(
  stripeConnectorSpec.status === "live" && stripeConnectorSpec.credentialFields.length === 1,
  "the Stripe connector exposes exactly one credential field",
);
check(
  stripeConnectorSpec.performsWrites === false,
  "the Stripe connector declares that it performs no writes",
);
check(
  stripeConnectorSpec.doesNot.length >= 3,
  "the Stripe connector documents what it does not do",
);
check(
  stripeConnectorSpec.requiredEnv.includes("CONNECTOR_ENCRYPTION_KEY"),
  "the Stripe connector requires the credential encryption key",
);

// ---------------------------------------------------------------------------
// 9. Purchasability gate
// ---------------------------------------------------------------------------

check(
  isPlanPurchasable("starter", false) === false,
  "a plan is not purchasable while billing is unconfigured",
);
check(
  isPlanPurchasable("starter", true) === true,
  "a plan becomes purchasable once billing is configured",
);

// ---------------------------------------------------------------------------
// 10. Redirect safety (open-redirect defence)
// ---------------------------------------------------------------------------

const rejected = [
  "https://evil.com",
  "//evil.com",
  "/\\evil.com",
  "http://evil.com/en",
  "/en\\@evil.com",
  "/%2F%2Fevil.com",
  "javascript:alert(1)",
  "  ",
  "",
  null,
  undefined,
  "/en\u0000/settings",
  "en/settings",
  `/${"a".repeat(600)}`,
];
for (const value of rejected) {
  check(safeRedirectPath(value) === null, `safeRedirectPath rejects ${JSON.stringify(value)}`);
}
const accepted = ["/en/settings", "/ar/dashboard", "/en/onboarding?step=2", "/"];
for (const value of accepted) {
  check(safeRedirectPath(value) === value, `safeRedirectPath accepts ${value}`);
}

// ---------------------------------------------------------------------------
// 11. Authentication input rules
// ---------------------------------------------------------------------------

check(
  signUpSchema.safeParse({
    email: "owner@example.com",
    password: "a-long-enough-password",
    fullName: "Owner",
    locale: "en",
    acceptedTerms: true,
  }).success,
  "a valid sign-up payload is accepted",
);
check(
  !signUpSchema.safeParse({
    email: "owner@example.com",
    password: "short",
    fullName: "Owner",
    locale: "en",
    acceptedTerms: true,
  }).success,
  "a password under 10 characters is rejected",
);
check(
  !signUpSchema.safeParse({
    email: "not-an-email",
    password: "a-long-enough-password",
    fullName: "Owner",
    locale: "en",
    acceptedTerms: true,
  }).success,
  "an invalid email is rejected",
);
check(
  !signUpSchema.safeParse({
    email: "owner@example.com",
    password: "a-long-enough-password",
    fullName: "Owner",
    locale: "en",
    acceptedTerms: false,
  }).success,
  "sign-up requires explicit terms acceptance (it is not pre-ticked)",
);
check(
  !signUpSchema.safeParse({ email: "owner@example.com", password: "a-long-enough-password" }).success,
  "sign-up rejects a missing name and consent",
);
check(
  !signInSchema.safeParse({ email: "owner@example.com", password: "" }).success,
  "sign-in rejects an empty password",
);

check(
  describeAuthError("Invalid login credentials", "en").includes("not correct"),
  "auth errors are mapped to a controlled message instead of being echoed raw",
);
check(
  describeAuthError("Invalid login credentials", "ar").length > 0,
  "auth error messages are localized",
);
check(
  describeAuthError("some internal provider failure", "en").length > 0,
  "an unknown auth error still produces a safe generic message",
);

// ---------------------------------------------------------------------------
// 12. Legal content integrity
// ---------------------------------------------------------------------------

check(LEGAL_DOC_KEYS.length === 5, "five legal documents are defined");
for (const locale of ["en", "ar"]) {
  for (const key of LEGAL_DOC_KEYS) {
    const doc = getLegalDoc(locale, key);
    check(
      doc.title.length > 0 && doc.sections.length >= 3 && doc.draftNotice.length > 0,
      `${locale}/${key}: has a title, at least three sections and a draft notice`,
    );
  }
}
const allLegalText = ["en", "ar"]
  .flatMap((locale) => LEGAL_DOC_KEYS.map((key) => JSON.stringify(getLegalDoc(locale, key))))
  .join(" ")
  .toLowerCase();
for (const forbidden of ["soc 2 certified", "iso 27001 certified", "pci dss compliant", "gdpr certified"]) {
  check(!allLegalText.includes(forbidden), `legal pages make no unearned claim: "${forbidden}"`);
}
check(
  allLegalText.includes("not implemented") ||
    allLegalText.includes("no independent penetration test") ||
    allLegalText.includes("not claim"),
  "legal pages disclose that controls and audits are not certified",
);

// ---------------------------------------------------------------------------
// 13. Scan schedule arithmetic
// ---------------------------------------------------------------------------

check(cadenceToMs("daily") === 86_400_000, "a daily schedule is 24 hours");
check(cadenceToMs("weekly") === 604_800_000, "a weekly schedule is 7 days");

const scheduleAnchor = new Date("2026-01-01T00:00:00.000Z");
check(
  nextRunFrom("daily", scheduleAnchor) === "2026-01-02T00:00:00.000Z",
  "a daily job's next run is exactly 24 hours later",
);
check(
  nextRunFrom("weekly", scheduleAnchor) === "2026-01-08T00:00:00.000Z",
  "a weekly job's next run is exactly 7 days later",
);
check(
  Date.parse(nextRunFrom("daily", scheduleAnchor)) > scheduleAnchor.getTime(),
  "the next run is always in the future (a failing job cannot be retried every minute)",
);

const featureKeys = new Set(Object.keys(FEATURES));
const unknownEntitlements = PLAN_IDS.flatMap((id) =>
  PLANS[id].entitlements.features.filter((f) => !featureKeys.has(f)),
);
check(unknownEntitlements.length === 0, "every entitlement references a registered feature");

console.log(`\n${checks} commercial architecture checks passed.`);
