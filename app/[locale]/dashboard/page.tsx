import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n/dictionaries";
import { Dashboard } from "@/components/dashboard";
import { isSupabaseConfigured } from "@/lib/config";
import { getSessionUser } from "@/lib/auth/server";
import { createServerSupabase } from "@/lib/db/server";
import { analysesUsedThisPeriod, entitlementState, listWorkspaces } from "@/lib/db/access";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const ar = locale === "ar";
  return {
    title: ar ? "مركز القيادة" : "Command center",
    // The command center is a private workspace: never indexed.
    robots: { index: false, follow: false },
  };
}

/**
 * Command center.
 *
 * Two deliberate modes, resolved on the server so the client never has to guess:
 *  - Accounts configured and a workspace exists -> cloud mode. Findings, review history and
 *    plan limits come from the database through RLS, and analyses run server-side.
 *  - Accounts not configured -> the original local workspace, with a prominent banner saying
 *    that nothing is stored server-side. The product never implies persistence it lacks.
 */
export default async function Page({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const authConfigured = isSupabaseConfigured();
  const user = authConfigured ? await getSessionUser() : null;

  // Resolve workspace + plan state only when there is a real account to resolve it for.
  let workspaceId: string | null = null;
  let workspaceName: string | null = null;
  let plan: {
    planId: string | null;
    billingStatus: string;
    analysesUsed: number;
    analysesLimit: number | null;
    blockedReason: string | null;
  } | null = null;

  if (user) {
    try {
      const supabase = await createServerSupabase();
      if (supabase) {
        const workspaces = await listWorkspaces(supabase);
        const workspace = workspaces[0] ?? null;
        if (workspace) {
          const state = entitlementState(workspace);
          const used = await analysesUsedThisPeriod(supabase, workspace.id);
          workspaceId = workspace.id;
          workspaceName = workspace.name;
          plan = {
            planId: state.planId,
            billingStatus: state.billingStatus,
            analysesUsed: used,
            analysesLimit: state.entitlements.analysesPerMonth,
            blockedReason: state.blockedReason ?? null,
          };
        }
      }
    } catch {
      // A transient database failure must not break the page: fall back to local mode rather
      // than showing a broken command center.
    }
  }

  return (
    <Dashboard
      locale={locale}
      cloud={{
        configured: authConfigured,
        signedIn: Boolean(user),
        email: user?.email ?? null,
        workspaceId,
        workspaceName,
        plan,
      }}
    />
  );
}
