import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { isLocale } from "@/lib/i18n/dictionaries";
import { Brand, LanguageSwitch } from "@/components/brand";
import { ConfigNotice } from "@/components/config-notice";
import { ConnectionsClient, type ConnectionsView } from "@/components/connections-client";
import { isSupabaseConfigured } from "@/lib/config";
import { getSessionUser } from "@/lib/auth/server";
import { createServerSupabase } from "@/lib/db/server";
import {
  analysesUsedThisPeriod,
  checkConnectionQuota,
  entitlementState,
  listWorkspaces,
} from "@/lib/db/access";
import {
  PROVIDER_KEYS,
  connectorEnvState,
  specFor,
} from "@/lib/connectors/registry";
import { listConnectionViews } from "@/lib/connectors/service";

export const metadata: Metadata = {
  title: "Connected services",
  robots: { index: false, follow: false },
};

/**
 * Connections page. Rendered on the server from the same registry the API uses, so the page
 * cannot advertise a provider the backend cannot actually connect.
 */
export default async function ConnectionsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const authConfigured = isSupabaseConfigured();
  const user = authConfigured ? await getSessionUser() : null;
  if (authConfigured && !user) {
    redirect(`/${locale}/sign-in?next=${encodeURIComponent(`/${locale}/connections`)}`);
  }

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
            title={locale === "ar" ? "الحسابات غير مُهيَّأة" : "Accounts are not configured"}
            body={
              locale === "ar"
                ? "لا يمكن عرض الخدمات المرتبطة أو ربط مزوّد قبل تهيئة Supabase."
                : "Connected services cannot be listed or connected before Supabase is configured."
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
  const workspaces = supabase ? await listWorkspaces(supabase) : [];
  const workspace = workspaces[0] ?? null;

  if (!workspace || !supabase) {
    redirect(`/${locale}/onboarding`);
  }

  const state = entitlementState(workspace);
  const connections = await listConnectionViews(supabase, workspace.id);
  const connected = connections.filter((connection) => connection.status === "connected").length;
  const used = await analysesUsedThisPeriod(supabase, workspace.id);
  const quota = checkConnectionQuota(state, connected);

  const view: ConnectionsView = {
    locale,
    workspaceId: workspace.id,
    plan: {
      planId: state.planId,
      blockedReason: state.blockedReason ?? null,
      connectedProviders: state.entitlements.connectedProviders,
      analysesPerMonth: state.entitlements.analysesPerMonth,
      usage: { connected, analysesThisMonth: used },
    },
    providers: PROVIDER_KEYS.map((key) => {
      const spec = specFor(key);
      const env = connectorEnvState(key);
      return {
        key,
        status: spec.status,
        name: spec.name,
        reads: spec.reads,
        doesNot: spec.doesNot,
        credentialFields: spec.credentialFields,
        requiredEnv: spec.requiredEnv,
        missingEnv: env.missing,
        configured: env.configured,
        performsWrites: spec.performsWrites,
        canConnect: spec.status === "live" && env.configured && quota.allowed,
        blockedBy: !env.configured ? "configuration" : !quota.allowed ? "plan_limit" : null,
      };
    }),
    connections: connections.map((connection) => ({
      providerKey: connection.providerKey,
      status: connection.status,
      accountLabel: connection.accountLabel,
      lastSyncAt: connection.lastSyncAt,
      lastSyncStatus: connection.lastSyncStatus,
      lastError: connection.lastError,
      scopes: connection.scopes,
    })),
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
          {locale === "ar" ? "الخدمات المرتبطة" : "Connected services"}
        </h1>
        <p className="muted" style={{ fontSize: 14, marginTop: 0 }}>
          {locale === "ar"
            ? "اربط مصدر بيانات واحدًا على الأقل لبناء اللقطات تلقائيًا. كل ربط للقراءة فقط."
            : "Connect at least one data source to build snapshots automatically. Every connection is read-only."}
        </p>
        <ConnectionsClient view={view} />
      </main>
    </>
  );
}
