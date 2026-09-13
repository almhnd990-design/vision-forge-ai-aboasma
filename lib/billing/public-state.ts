import "server-only";

import { isSupabaseConfigured } from "@/lib/config";
import { BILLING_ENV_KEYS, missingEnv } from "@/lib/env-contract";
import { isStripeConfigured } from "@/lib/billing/stripe";
import { createServerSupabase } from "@/lib/db/server";
import { listWorkspaces } from "@/lib/db/access";
import type { PricingBillingState } from "@/components/pricing";

/**
 * Resolve what the pricing UI may offer right now.
 *
 * `canCheckout` requires all three: a fully configured Stripe account, a configured
 * Supabase project, and a signed-in customer who owns a workspace. Anything less and the
 * UI shows a configuration or sign-in state instead of a purchase button.
 */
export async function resolvePricingBillingState(): Promise<PricingBillingState> {
  const missing = missingEnv(BILLING_ENV_KEYS);
  const configured = isStripeConfigured() && isSupabaseConfigured();

  if (!configured) {
    return { configured: false, missingEnv: missing, canCheckout: false, workspaceId: null };
  }

  try {
    const supabase = await createServerSupabase();
    if (!supabase) {
      return { configured: true, missingEnv: [], canCheckout: false, workspaceId: null };
    }
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return { configured: true, missingEnv: [], canCheckout: false, workspaceId: null };
    }
    const workspaces = await listWorkspaces(supabase);
    const workspaceId = workspaces[0]?.id ?? null;
    return {
      configured: true,
      missingEnv: [],
      canCheckout: Boolean(workspaceId),
      workspaceId,
    };
  } catch {
    // Never let a transient auth/db failure turn into an apparent purchase path.
    return { configured: true, missingEnv: [], canCheckout: false, workspaceId: null };
  }
}
