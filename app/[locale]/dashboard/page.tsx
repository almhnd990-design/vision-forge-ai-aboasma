import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n/dictionaries";
import { Dashboard } from "@/components/dashboard";
import { isSupabaseConfigured } from "@/lib/config";
import { getSessionUser } from "@/lib/auth/server";

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
 * Two deliberate modes:
 *  - Accounts configured and signed in  -> the account's own workspace (cloud storage).
 *  - Accounts not configured            -> the original local workspace, with a prominent
 *    banner stating that nothing is stored server-side. The product never implies cloud
 *    persistence that does not exist.
 *
 * The dashboard UI itself is unchanged; only the explanations around it differ.
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

  return (
    <Dashboard
      locale={locale}
      cloud={{
        configured: authConfigured,
        signedIn: Boolean(user),
        email: user?.email ?? null,
      }}
    />
  );
}
