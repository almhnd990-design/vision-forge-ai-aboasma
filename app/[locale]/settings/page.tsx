import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { isLocale } from "@/lib/i18n/dictionaries";
import { Brand, LanguageSwitch } from "@/components/brand";
import { SettingsClient, type SettingsView } from "@/components/settings-client";
import { ConfigNotice } from "@/components/config-notice";
import { isSupabaseConfigured } from "@/lib/config";
import { BILLING_ENV_KEYS, missingEnv } from "@/lib/env-contract";
import { getProfile, getSessionUser } from "@/lib/auth/server";
import { createServerSupabase } from "@/lib/db/server";
import {
  analysesUsedThisPeriod,
  entitlementState,
  listWorkspaces,
} from "@/lib/db/access";
import { billingEnvStatus } from "@/lib/billing/stripe";
import { listConnectionViews } from "@/lib/connectors/service";

export const metadata: Metadata = {
  title: "Account settings",
  robots: { index: false, follow: false },
};

export default async function SettingsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const authConfigured = isSupabaseConfigured();
  const user = authConfigured ? await getSessionUser() : null;
  if (authConfigured && !user) {
    redirect(`/${locale}/sign-in?next=${encodeURIComponent(`/${locale}/settings`)}`);
  }

  const billing = billingEnvStatus();

  if (!user) {
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
          <ConfigNotice
            locale={locale}
            title={
              locale === "ar"
                ? "الحسابات غير مُهيَّأة في هذه النسخة"
                : "Accounts are not configured on this deployment"
            }
            body={
              locale === "ar"
                ? "لا يوجد مشروع Supabase مهيأ، لذلك لا يوجد حساب لعرض إعداداته."
                : "No Supabase project is configured, so there is no account whose settings could be shown."
            }
            missingEnv={[
              "NEXT_PUBLIC_SUPABASE_URL",
              "NEXT_PUBLIC_SUPABASE_ANON_KEY",
              "SUPABASE_SERVICE_ROLE_KEY",
            ]}
          />
        </main>
      </>
    );
  }

  const supabase = await createServerSupabase();
  const profile = await getProfile(user.id);
  const workspaces = supabase ? await listWorkspaces(supabase) : [];
  const workspace = workspaces[0] ?? null;
  const state = entitlementState(workspace ?? {});
  const usage = supabase && workspace ? await analysesUsedThisPeriod(supabase, workspace.id) : 0;
  const connections = supabase && workspace ? await listConnectionViews(supabase, workspace.id) : [];

  const view: SettingsView = {
    locale,
    email: user.email ?? null,
    fullName: profile?.full_name ?? null,
    workspace: workspace
      ? {
          id: workspace.id,
          name: workspace.name,
          businessType: workspace.business_type,
          createdAt: workspace.created_at,
        }
      : null,
    plan: {
      planId: state.planId,
      billingStatus: workspace?.billing_status ?? "none",
      interval: workspace?.billing_interval ?? null,
      currentPeriodEnd: workspace?.current_period_end ?? null,
      trialEndsAt: workspace?.trial_ends_at ?? null,
    },
    usage: { analysesThisMonth: usage, analysesLimit: state.entitlements.analysesPerMonth },
    connections: connections.map((connection) => ({
      providerKey: connection.providerKey,
      status: connection.status,
      accountLabel: connection.accountLabel,
      lastSyncAt: connection.lastSyncAt,
      lastSyncStatus: connection.lastSyncStatus,
      lastError: connection.lastError,
    })),
    billingConfigured: billing.configured,
    missingBillingEnv: billing.configured ? [] : missingEnv(BILLING_ENV_KEYS),
    authConfigured,
  };

  return (
    <>
      <header className="site-header">
        <div className="container nav-inner">
          <Brand locale={locale} />
          <div className="nav-actions">
            <LanguageSwitch locale={locale} />
            <a className="button button-small button-outline nav-cta" href={`/${locale}/dashboard`}>
              {locale === "ar" ? "مركز القيادة" : "Command center"}
            </a>
          </div>
        </div>
      </header>
      <main className="onboarding-shell">
        <h1 style={{ fontSize: 28, marginBottom: 6 }}>
          {locale === "ar" ? "إعدادات الحساب" : "Account settings"}
        </h1>
        <p className="muted" style={{ fontSize: 14, marginTop: 0 }}>
          {locale === "ar"
            ? "الملف الشخصي، مساحة العمل، الاشتراك، الخدمات المرتبطة، وبياناتك."
            : "Your profile, workspace, subscription, connected services and data."}
        </p>
        <SettingsClient view={view} />
      </main>
    </>
  );
}
