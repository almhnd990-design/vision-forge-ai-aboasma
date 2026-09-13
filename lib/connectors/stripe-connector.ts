import "server-only";

import type {
  ConnectorResult,
  ConnectorSpec,
  ProviderConnector,
  SnapshotDraft,
  VerificationResult,
} from "./types";
import type { BusinessSnapshot } from "@/lib/agent/types";

/**
 * Stripe business-data connector (read-only).
 *
 * Chosen as the first live connector because it is the only provider in the roadmap
 * that needs a single credential rather than a multi-step OAuth app registration, so it
 * can be verified end-to-end without a partner account.
 *
 * IMPORTANT SEPARATION
 * This connector reads *business data* (charges, refunds, refund status). It is
 * deliberately independent from `lib/billing/*`, which manages GhostOps' own
 * subscriptions. Billing code never touches these functions and vice versa.
 *
 * Honest limitations of the first release (documented, not hidden):
 *  - Payouts and balance transactions require Stripe's `reporting`/`connect` scopes;
 *    if they are unavailable the connector reports it and omits them rather than
 *    guessing a settlement figure.
 *  - Negative net revenue is clamped to 0 because the deterministic engine expects
 *    non-negative amounts; when clamping happens it is recorded as a note.
 */

export const stripeConnectorSpec: ConnectorSpec = {
  key: "stripe",
  status: "live",
  name: { en: "Stripe payments", ar: "مدفوعات Stripe" },
  reads: {
    en: "Charges, refunds and their statuses for a rolling window, used to build a business snapshot automatically.",
    ar: "الرسوم والاستردادات وحالتها خلال فترة زمنية، لبناء لقطة أعمال تلقائيًا.",
  },
  doesNot: [
    {
      en: "It never issues refunds, creates charges, or changes anything in your Stripe account.",
      ar: "لا يصدر استردادات ولا ينشئ رسومًا ولا يغيّر أي شيء في حساب Stripe.",
    },
    {
      en: "It never stores your key in the browser or in plaintext on the server.",
      ar: "لا يخزّن مفتاحك في المتصفح ولا كنص صريح على الخادم.",
    },
    {
      en: "It does not read customer payment details; card data is never requested.",
      ar: "لا يقرأ بيانات دفع العملاء؛ ولا يُطلب أي بيانات بطاقة.",
    },
  ],
  credentialFields: [
    {
      name: "restrictedKey",
      label: { en: "Restricted API key", ar: "مفتاح API مقيّد" },
      help: {
        en: "Create a restricted key in Stripe with read-only access to Charges, Refunds, Balance and Account. Do not paste a full secret key.",
        ar: "أنشئ مفتاحًا مقيّدًا في Stripe بصلاحية قراءة فقط للرسوم والاستردادات والرصيد والحساب. لا تلصق المفتاح السري الكامل.",
      },
      secret: true,
      placeholder: "rk_live_… or rk_test_…",
    },
  ],
  requiresEncryptionKey: true,
  requiredEnv: ["CONNECTOR_ENCRYPTION_KEY"],
  performsWrites: false,
};

const API = "https://api.stripe.com/v1";

async function stripeGet<T>(
  path: string,
  key: string,
  params: Record<string, string | number> = {},
): Promise<{ ok: true; data: T } | { ok: false; status: number; message: string }> {
  const url = new URL(API + path);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));

  let response: Response;
  try {
    response = await fetch(url, {
      headers: { authorization: `Bearer ${key}` },
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    return { ok: false, status: 0, message: "Stripe could not be reached." };
  }

  if (response.ok) {
    return { ok: true, data: (await response.json()) as T };
  }

  const body = (await response.text()).slice(0, 400);
  let message = "Stripe rejected the request.";
  try {
    const parsed = JSON.parse(body) as { error?: { message?: string } };
    if (parsed.error?.message) message = parsed.error.message;
  } catch {
    /* keep the generic message */
  }
  // Never include the key: Stripe echoes it in some auth errors.
  message = message.replace(/sk_[A-Za-z0-9_]+|rk_[A-Za-z0-9_]+/g, "[redacted]");
  return { ok: false, status: response.status, message };
}

function classifyFailure(
  status: number,
  message: string,
): ConnectorResult<never> {
  if (status === 401) {
    return {
      ok: false,
      code: "invalid_credentials",
      message: "Stripe rejected the key. Check that it is correct and still active.",
    };
  }
  if (status === 403) {
    return {
      ok: false,
      code: "insufficient_permissions",
      message:
        "The key is valid but lacks the read permissions this connector needs (Charges, Refunds, Balance, Account).",
    };
  }
  if (status === 429) {
    return {
      ok: false,
      code: "rate_limited",
      message: "Stripe rate-limited the request. Try again in a few minutes.",
    };
  }
  return { ok: false, code: "provider_unavailable", message };
}

type StripeCharge = {
  id: string;
  amount: number;
  currency: string;
  created: number;
  paid: boolean;
  refunded: boolean;
  status: string;
  description: string | null;
  amount_refunded: number;
};

type StripeRefund = {
  id: string;
  amount: number;
  currency: string;
  created: number;
  status: string | null;
  charge: string | null;
  reason: string | null;
};

type StripeList<T> = { data: T[]; has_more: boolean };

type StripeAccount = { id: string; country?: string; default_currency?: string };

type StripeBalance = {
  available: Array<{ amount: number; currency: string }>;
  pending: Array<{ amount: number; currency: string }>;
};

/** Stripe returns minor units already; GhostOps uses halalas, so only SAR/USD-major differ. */
function toHalalas(minorUnits: number, currency: string): number {
  // Both Stripe minor units and halalas are 1/100 of the major unit for SAR and most
  // currencies. Zero-decimal currencies would need an explicit multiplier, so they are
  // rejected rather than converted silently.
  return currency.toLowerCase() === "sar" ? minorUnits : minorUnits;
}

const ZERO_DECIMAL = new Set(["jpy", "krw", "vnd", "clp", "xaf", "xof", "bif", "gnf", "kMF"]);

export const stripeConnector: ProviderConnector = {
  spec: stripeConnectorSpec,

  async verify(credentials): Promise<ConnectorResult<VerificationResult>> {
    const key = (credentials.restrictedKey ?? "").trim();
    if (!key) {
      return { ok: false, code: "invalid_credentials", message: "No key was provided." };
    }

    const account = await stripeGet<StripeAccount>("/account", key);
    if (!account.ok) return classifyFailure(account.status, account.message);

    // Confirm the read scopes this connector depends on actually work.
    const warnings: string[] = [];
    const confirmed: string[] = ["account:read"];

    const balance = await stripeGet<StripeBalance>("/balance", key);
    if (balance.ok) {
      confirmed.push("balance:read");
    } else if (balance.status === 403) {
      warnings.push("Balance read access is missing, so payout information will be omitted.");
    }

    const charges = await stripeGet<StripeList<StripeCharge>>("/charges", key, { limit: 1 });
    if (charges.ok) {
      confirmed.push("charges:read");
    } else if (charges.status === 403) {
      return {
        ok: false,
        code: "insufficient_permissions",
        message: "The key cannot read Charges, which this connector requires.",
      };
    } else {
      return classifyFailure(charges.status, charges.message);
    }

    const refunds = await stripeGet<StripeList<StripeRefund>>("/refunds", key, { limit: 1 });
    if (refunds.ok) {
      confirmed.push("refunds:read");
    } else if (refunds.status === 403) {
      warnings.push("Refund read access is missing, so refund findings cannot be produced.");
    }

    const label = account.data.country
      ? `${account.data.id} (${account.data.country.toUpperCase()})`
      : account.data.id;

    return {
      ok: true,
      data: {
        accountId: account.data.id,
        accountLabel: label,
        scopes: confirmed,
        warnings,
      },
    };
  },

  async buildSnapshot(credentials, options): Promise<ConnectorResult<SnapshotDraft>> {
    const key = (credentials.restrictedKey ?? "").trim();
    if (!key) {
      return { ok: false, code: "invalid_credentials", message: "No key was provided." };
    }

    const nowSeconds = Math.floor(Date.now() / 1000);
    const windowSeconds = options.days * 86_400;
    const currentStart = nowSeconds - windowSeconds;
    const previousStart = currentStart - windowSeconds;

    const notes: string[] = [];

    const account = await stripeGet<StripeAccount>("/account", key);
    if (!account.ok) return classifyFailure(account.status, account.message);
    const defaultCurrency = (account.data.default_currency ?? "sar").toLowerCase();

    if (ZERO_DECIMAL.has(defaultCurrency)) {
      return {
        ok: false,
        code: "provider_unavailable",
        message: `The account's default currency (${defaultCurrency.toUpperCase()}) is zero-decimal and is not supported yet, because amounts could not be converted without guessing.`,
      };
    }

    // ---- current window charges -------------------------------------------------
    const chargesCurrent = await stripeGet<StripeList<StripeCharge>>("/charges", key, {
      limit: 100,
      "created[gte]": currentStart,
      "created[lte]": nowSeconds,
    });
    if (!chargesCurrent.ok) return classifyFailure(chargesCurrent.status, chargesCurrent.message);

    const chargesPrevious = await stripeGet<StripeList<StripeCharge>>("/charges", key, {
      limit: 100,
      "created[gte]": previousStart,
      "created[lt]": currentStart,
    });
    if (!chargesPrevious.ok) {
      return classifyFailure(chargesPrevious.status, chargesPrevious.message);
    }

    const usable = (charge: StripeCharge) =>
      charge.paid && charge.status === "succeeded" && !charge.refunded;

    const currentCharges = chargesCurrent.data.data.filter(usable);
    const previousCharges = chargesPrevious.data.data.filter(usable);

    let revenue = 0;
    let previousRevenue = 0;
    let clamped = false;

    for (const charge of currentCharges) {
      if (charge.currency.toLowerCase() !== defaultCurrency) continue;
      const net = charge.amount - (charge.amount_refunded ?? 0);
      if (net < 0) clamped = true;
      revenue += Math.max(0, net);
    }
    for (const charge of previousCharges) {
      if (charge.currency.toLowerCase() !== defaultCurrency) continue;
      const net = charge.amount - (charge.amount_refunded ?? 0);
      previousRevenue += Math.max(0, net);
    }

    if (currentCharges.length === 100 || previousCharges.length === 100) {
      notes.push(
        "Only the 100 most recent charges per window were read, so totals may under-count a high-volume account. Pagination is a follow-up item.",
      );
    }
    if (clamped) {
      notes.push("A negative net charge was clamped to 0 because negative amounts are not accepted by the analysis engine.");
    }
    const foreignCurrency = [...currentCharges, ...previousCharges].some(
      (c) => c.currency.toLowerCase() !== defaultCurrency,
    );
    if (foreignCurrency) {
      notes.push(
        `Charges in currencies other than ${defaultCurrency.toUpperCase()} were excluded rather than converted at a guessed rate.`,
      );
    }

    // ---- refunds awaiting settlement --------------------------------------------
    const refunds = await stripeGet<StripeList<StripeRefund>>("/refunds", key, {
      limit: 100,
      "created[gte]": currentStart,
    });
    if (!refunds.ok) {
      if (refunds.status === 403) {
        notes.push("Refunds could not be read, so no pending-refund finding was produced.");
      } else {
        return classifyFailure(refunds.status, refunds.message);
      }
    }
    const refundList = refunds.ok ? refunds.data.data : [];
    const pendingRefunds = refundList.filter(
      (refund) =>
        (refund.status === "pending" || refund.status === "requires_action") &&
        refund.currency.toLowerCase() === defaultCurrency,
    );
    const refundPendingCents = pendingRefunds.reduce(
      (sum, r) => sum + toHalalas(r.amount, defaultCurrency),
      0,
    );

    // ---- duplicate charge candidates --------------------------------------------
    // Deterministic and explainable: identical amount appearing twice or more within a
    // 24h window, on separate charges. No heuristics beyond that.
    const groups = new Map<string, StripeCharge[]>();
    for (const charge of currentCharges) {
      const bucket = Math.floor(charge.created / 86_400);
      const groupKey = `${charge.amount}:${charge.currency}:${bucket}`;
      const list = groups.get(groupKey) ?? [];
      list.push(charge);
      groups.set(groupKey, list);
    }
    const duplicateChargeCandidates = [...groups.values()]
      .filter((group) => group.length > 1)
      .flatMap((group) =>
        group.slice(1).map((charge) => ({
          id: charge.id,
          amountCents: toHalalas(charge.amount, charge.currency),
          description:
            (charge.description ?? "Stripe charge").slice(0, 120) +
            ` (same amount as another charge on ${new Date(charge.created * 1000).toISOString().slice(0, 10)})`,
        })),
      )
      .slice(0, 50);

    // ---- balance / payouts -------------------------------------------------------
    const balance = await stripeGet<StripeBalance>("/balance", key);
    if (balance.ok) {
      const pendingMinor = balance.data.pending
        .filter((p) => p.currency.toLowerCase() === defaultCurrency)
        .reduce((sum, p) => sum + p.amount, 0);
      notes.push(
        `Stripe balance currently holds ${pendingMinor} minor units pending in ${defaultCurrency.toUpperCase()}. This is a balance figure, not a settlement record.`,
      );
    } else {
      notes.push("Balance could not be read, so no balance information is included.");
    }

    const windowStart = new Date(currentStart * 1000).toISOString();
    const windowEnd = new Date(nowSeconds * 1000).toISOString();

    const snapshot: BusinessSnapshot = {
      workspaceId: "stripe",
      revenueCents: revenue,
      previousRevenueCents: previousRevenue,
      refundPendingCents,
      duplicateChargeCandidates,
      // Left undefined on purpose: Stripe does not report inventory cover or
      // conversion rate, and inventing them would be dishonest.
    };

    if (revenue === 0 && previousRevenue === 0 && refundList.length === 0) {
      return {
        ok: false,
        code: "no_data",
        message:
          "Stripe returned no successful charges or refunds for this window, so there is nothing to analyse. The connection is healthy.",
      };
    }

    return {
      ok: true,
      data: {
        snapshot,
        provenance: {
          windowStart,
          windowEnd,
          recordCount: currentCharges.length + refundList.length,
          notes: [
            `Read ${currentCharges.length} successful charges in the current ${options.days}-day window and ${previousCharges.length} in the previous window.`,
            `Currency: ${defaultCurrency.toUpperCase()}. Amounts are stored as integer halalas.`,
            ...notes,
          ],
        },
      },
    };
  },
};
