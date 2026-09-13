import { FEATURES } from "@/lib/plans";
import type { ProviderKey } from "@/lib/db/types";
import { stripeConnector, stripeConnectorSpec } from "./stripe-connector";
import type { ConnectorSpec, ProviderConnector } from "./types";

/**
 * The connector registry is the single place that decides what the Connections UI may
 * offer. A connector whose `status` is `planned` can never render a working action, and
 * a connector whose environment is incomplete reports an explicit configuration
 * requirement instead of a fake "Connect".
 */

export const CONNECTORS: Record<ProviderKey, ProviderConnector | null> = {
  stripe: stripeConnector,
  // No implementation exists for these yet. `null` + a `planned` spec is the honest
  // representation: the UI lists them as coming soon and offers no action.
  shopify: null,
  amazon: null,
  gmail: null,
};

/** Specs for every provider, including the ones with no implementation. */
export const CONNECTOR_SPECS: Record<ProviderKey, ConnectorSpec> = {
  stripe: stripeConnectorSpec,
  shopify: plannedSpec("shopify"),
  amazon: plannedSpec("amazon"),
  gmail: plannedSpec("gmail"),
};

export const PROVIDER_KEYS: ProviderKey[] = ["stripe", "shopify", "amazon", "gmail"];

function plannedSpec(key: Exclude<ProviderKey, "stripe">): ConnectorSpec {
  const labels: Record<typeof key, { en: string; ar: string; env: string[] }> = {
    shopify: {
      en: "Shopify",
      ar: "Shopify",
      env: ["SHOPIFY_CLIENT_ID", "SHOPIFY_CLIENT_SECRET"],
    },
    amazon: {
      en: "Amazon SP-API",
      ar: "Amazon SP-API",
      env: [
        "AMAZON_SP_API_CLIENT_ID",
        "AMAZON_SP_API_CLIENT_SECRET",
        "AMAZON_SP_API_REFRESH_TOKEN",
      ],
    },
    gmail: {
      en: "Gmail",
      ar: "Gmail",
      env: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"],
    },
  };
  const meta = labels[key];
  return {
    key,
    status: "planned",
    name: { en: meta.en, ar: meta.ar },
    reads: {
      en: FEATURES[`connector_${key}` as const].description.en,
      ar: FEATURES[`connector_${key}` as const].description.ar,
    },
    doesNot: [],
    credentialFields: [],
    requiresEncryptionKey: false,
    requiredEnv: meta.env,
    performsWrites: false,
  };
}

export function connectorFor(key: ProviderKey): ProviderConnector | null {
  return CONNECTORS[key];
}

export function specFor(key: ProviderKey): ConnectorSpec {
  return CONNECTOR_SPECS[key];
}

export function isConnectorImplemented(key: ProviderKey): boolean {
  return CONNECTORS[key] !== null && CONNECTOR_SPECS[key].status === "live";
}

/** Environment state for one provider, used to render configure-vs-connect states. */
export function connectorEnvState(key: ProviderKey): {
  configured: boolean;
  missing: string[];
  status: "live" | "planned";
} {
  const spec = CONNECTOR_SPECS[key];
  const missing = spec.requiredEnv.filter((name) => !(process.env[name] ?? "").trim());
  return {
    configured: missing.length === 0 && spec.status === "live",
    missing: spec.status === "live" ? missing : spec.requiredEnv,
    status: spec.status,
  };
}
