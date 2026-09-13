/**
 * Runtime configuration state.
 *
 * Every optional capability in GhostOps is gated on configuration that actually
 * exists at runtime. Nothing is simulated: if Supabase, Stripe or an AI provider
 * is not configured, the corresponding capability reports itself as unavailable and
 * the UI must say so instead of pretending to work.
 *
 * This module must stay importable from both server and browser code. Therefore it
 * only exposes NON-SECRET values (or booleans) and never reads service-role or
 * secret keys in a way that could leak them to the client bundle.
 */

/** Public values inlined at build time by Next.js. */
const publicUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const publicAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

/**
 * Public app URL. Used for canonical links, OAuth redirects and Stripe return URLs.
 */
export const APP_URL = (
  process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"
).replace(/\/$/, "");

export function isSupabaseConfigured(): boolean {
  return (
    publicUrl.startsWith("http") &&
    publicAnonKey.length > 20 &&
    !publicUrl.includes("your-project")
  );
}

export const supabasePublicConfig = {
  url: publicUrl,
  anonKey: publicAnonKey,
} as const;

/**
 * Identity/audit metadata surfaced in the UI so operators can see exactly which
 * capabilities are active in this deployment.
 */
export type CapabilityState = {
  key:
    | "auth"
    | "cloud_persistence"
    | "billing"
    | "ai_reasoning"
    | "connector_stripe";
  available: boolean;
  /** Why it is unavailable — shown verbatim to the operator. */
  reason?: string;
  /** Environment variables an operator must set to enable it. */
  requiredEnv?: string[];
};

function missingEnv(names: string[]): string[] {
  return names.filter((n) => {
    const raw = process.env[n];
    return !raw || raw.trim().length === 0;
  });
}

export function authCapability(): CapabilityState {
  const required = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"];
  const missing = missingEnv(required);
  return missing.length === 0 && isSupabaseConfigured()
    ? { key: "auth", available: true }
    : {
        key: "auth",
        available: false,
        reason:
          "Account authentication requires a Supabase project. No project is configured for this deployment, so accounts, sign-in and cloud storage are disabled.",
        requiredEnv: required,
      };
}

/**
 * Server-only configuration snapshot. Import from server code only.
 */
export type ServerCapabilities = {
  database: { available: boolean; reason?: string; requiredEnv: string[] };
  billing: { available: boolean; reason?: string; requiredEnv: string[] };
  ai: {
    available: boolean;
    providers: Array<"openai" | "deepseek">;
    reason?: string;
    requiredEnv: string[];
  };
};

export function serverCapabilities(): ServerCapabilities {
  const serviceMissing = missingEnv(["SUPABASE_SERVICE_ROLE_KEY"]);
  const stripeMissing = missingEnv([
    "STRIPE_SECRET_KEY",
    "STRIPE_WEBHOOK_SECRET",
    "STRIPE_PRICE_STARTER",
    "STRIPE_PRICE_GROWTH",
    "STRIPE_PRICE_SCALE",
  ]);
  const aiProviders: Array<"openai" | "deepseek"> = [];
  if ((process.env.OPENAI_API_KEY ?? "").trim()) aiProviders.push("openai");
  if ((process.env.DEEPSEEK_API_KEY ?? "").trim()) aiProviders.push("deepseek");

  const auth = authCapability();
  const dbAvailable = auth.available && serviceMissing.length === 0;

  return {
    database: {
      available: dbAvailable,
      reason: dbAvailable
        ? undefined
        : "Cloud persistence requires Supabase plus a server-side service role key.",
      requiredEnv: [...(auth.requiredEnv ?? []), "SUPABASE_SERVICE_ROLE_KEY"],
    },
    billing: {
      available: dbAvailable && stripeMissing.length === 0,
      reason:
        dbAvailable && stripeMissing.length === 0
          ? undefined
          : "Billing requires Supabase (to persist subscription state) and a fully configured Stripe account: secret key, webhook signing secret and one price ID per plan.",
      requiredEnv: ["SUPABASE_SERVICE_ROLE_KEY", ...stripeMissing],
    },
    ai: {
      available: aiProviders.length > 0,
      providers: aiProviders,
      reason:
        aiProviders.length > 0
          ? undefined
          : "No AI provider key is configured. Deterministic analysis still runs; advanced reasoning is unavailable.",
      requiredEnv: ["OPENAI_API_KEY or DEEPSEEK_API_KEY"],
    },
  };
}

/** Convenience flags for server routes. */
export function isBillingConfigured(): boolean {
  return serverCapabilities().billing.available;
}

export function isAiConfigured(): boolean {
  return serverCapabilities().ai.available;
}
