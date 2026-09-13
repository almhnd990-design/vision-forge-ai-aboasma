import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { isLocale } from "@/lib/i18n/dictionaries";
import { Brand, LanguageSwitch } from "@/components/brand";
import { OnboardingForm, type ConnectorOption } from "@/components/onboarding-form";
import { isSupabaseConfigured } from "@/lib/config";
import { getSessionUser } from "@/lib/auth/server";
import { createServerSupabase } from "@/lib/db/server";
import { listWorkspaces } from "@/lib/db/access";
import { connectorEnvState, specFor } from "@/lib/connectors/registry";
import { CONNECTOR_ENV_KEYS } from "@/lib/env-contract";

export const metadata: Metadata = {
  title: "Set up your workspace",
  robots: { index: false, follow: false },
};

/**
 * Onboarding entry point.
 *
 * Requires a real session when accounts are configured. When they are not, the page still
 * renders so the configuration state is explained rather than 404-ing.
 */
export default async function OnboardingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const authConfigured = isSupabaseConfigured();
  const user = authConfigured ? await getSessionUser() : null;
  if (authConfigured && !user) {
    redirect(`/${locale}/sign-in?next=${encodeURIComponent(`/${locale}/onboarding`)}`);
  }

  let existingWorkspaceName: string | null = null;
  if (user) {
    const supabase = await createServerSupabase();
    if (supabase) {
      const workspaces = await listWorkspaces(supabase);
      existingWorkspaceName = workspaces[0]?.name ?? null;
    }
  }

  const stripeSpec = specFor("stripe");
  const env = connectorEnvState("stripe");
  const encryptionMissing = CONNECTOR_ENV_KEYS.stripe.filter(
    (name) => !(process.env[name] ?? "").trim(),
  );
  const connector: ConnectorOption = {
    key: "stripe",
    label: stripeSpec.name[locale],
    available: env.configured && encryptionMissing.length === 0,
    reason:
      encryptionMissing.length > 0
        ? locale === "ar"
          ? "ربط المزوّد يتطلب تشفير بيانات الاعتماد، وهو غير مهيأ."
          : "Connecting a provider requires credential encryption, which is not configured."
        : undefined,
    requiredEnv: [...stripeSpec.requiredEnv, ...CONNECTOR_ENV_KEYS.stripe],
  };

  return (
    <>
      <header className="site-header">
        <div className="container nav-inner">
          <Brand locale={locale} />
          <div className="nav-actions">
            <LanguageSwitch locale={locale} />
          </div>
        </div>
      </header>
      <main className="onboarding-shell">
        <OnboardingForm
          locale={locale}
          email={user?.email ?? null}
          authConfigured={authConfigured}
          connector={connector}
          existingWorkspaceName={existingWorkspaceName}
        />
      </main>
    </>
  );
}
