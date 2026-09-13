import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n/dictionaries";
import { Brand, LanguageSwitch } from "@/components/brand";
import { AuthForm } from "@/components/auth-form";
import { safeRedirectPath } from "@/lib/auth/client";

export const metadata: Metadata = {
  title: "Sign in",
  robots: { index: false, follow: false },
};

export default async function SignInPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ next?: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const { next } = await searchParams;
  const target = safeRedirectPath(next);

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
        <AuthForm locale={locale} mode="sign-in" next={target} />
      </main>
    </>
  );
}
