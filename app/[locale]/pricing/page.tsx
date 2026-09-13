import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n/dictionaries";
import { PricingCards } from "@/components/pricing";
import { Brand, LanguageSwitch } from "@/components/brand";
import { resolvePricingBillingState } from "@/lib/billing/public-state";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const ar = locale === "ar";
  return {
    title: ar ? "الأسعار" : "Pricing",
    description: ar
      ? "خطط GhostOps AI بالريال السعودي. ابدأ بتجربة مجانية، وألغِ في أي وقت."
      : "GhostOps AI plans in Saudi Riyal. Start with a free trial and cancel whenever you want.",
    alternates: {
      canonical: `/${ar ? "ar" : "en"}/pricing`,
      languages: { en: "/en/pricing", ar: "/ar/pricing", "x-default": "/en/pricing" },
    },
  };
}

/**
 * Dedicated pricing route.
 *
 * Rendered on the server so the configuration state is resolved before any HTML is sent:
 * a visitor never receives a purchase button that cannot work.
 */
export default async function PricingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const billing = await resolvePricingBillingState();
  const t = (await import("@/lib/i18n/dictionaries")).getDictionary(locale);

  return (
    <>
      <header className="site-header">
        <div className="container nav-inner">
          <Brand locale={locale} />
          <div className="nav-actions">
            <LanguageSwitch locale={locale} />
            <a className="button button-small button-outline nav-cta" href={`/${locale}/dashboard`}>
              {t.enter}
            </a>
          </div>
        </div>
      </header>
      <main>
        <PricingCards locale={locale} billing={billing} variant="page" />
      </main>
      <footer className="container footer">
        <div>
          <Brand locale={locale} />
          <p>{t.footer}</p>
        </div>
        <div className="footer-end">
          <span>© {new Date().getFullYear()} GhostOps AI</span>
          <a href={`/${locale}/legal/terms`}>{locale === "ar" ? "الشروط" : "Terms"}</a>
          <a href={`/${locale}/legal/privacy`}>{locale === "ar" ? "الخصوصية" : "Privacy"}</a>
          <a href={`/${locale}/legal/refunds`}>
            {locale === "ar" ? "الاسترداد والإلغاء" : "Refunds & cancellation"}
          </a>
        </div>
      </footer>
    </>
  );
}
