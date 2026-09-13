/**
 * Environment contract for every optional capability.
 *
 * Isomorphic on purpose: the pricing UI needs to name the missing variables and the
 * server needs to verify them, and duplicating the list would let the two drift apart.
 * Only variable NAMES live here — never values.
 */

export const BILLING_ENV_KEYS = [
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "STRIPE_PRICE_STARTER",
  "STRIPE_PRICE_GROWTH",
  "STRIPE_PRICE_SCALE",
] as const;

export const AUTH_ENV_KEYS = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
] as const;

export const SERVER_DB_ENV_KEYS = ["SUPABASE_SERVICE_ROLE_KEY"] as const;

export const CONNECTOR_ENV_KEYS = {
  stripe: ["CONNECTOR_ENCRYPTION_KEY"],
  shopify: ["SHOPIFY_CLIENT_ID", "SHOPIFY_CLIENT_SECRET"],
  amazon: [
    "AMAZON_SP_API_CLIENT_ID",
    "AMAZON_SP_API_CLIENT_SECRET",
    "AMAZON_SP_API_REFRESH_TOKEN",
  ],
  gmail: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"],
} as const;

export const AI_ENV_KEYS = ["OPENAI_API_KEY", "DEEPSEEK_API_KEY"] as const;

export function isEnvPresent(name: string): boolean {
  return Boolean((process.env[name] ?? "").trim());
}

export function missingEnv(keys: readonly string[]): string[] {
  return keys.filter((key) => !isEnvPresent(key));
}
