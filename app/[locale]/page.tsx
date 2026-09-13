import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n/dictionaries";
import { Landing } from "@/components/landing";
import { resolvePricingBillingState } from "@/lib/billing/public-state";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const ar = locale === "ar";
  return {
    title: ar
      ? "GhostOps AI — مشغّلك الخفي"
      : "GhostOps AI — Your invisible operator",
    description: ar
      ? "حوّل إشارات أعمالك المتفرقة إلى فرص واضحة لاسترداد الأموال وحماية هوامش الربح. مع موافقة بشرية على كل إجراء."
      : "Turn scattered business signals into clear opportunities to recover money and protect margins. Human approval on every action.",
    alternates: {
      canonical: `/${ar ? "ar" : "en"}`,
      languages: { en: "/en", ar: "/ar", "x-default": "/en" },
    },
  };
}

export default async function Page({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  // Resolved on the server so the landing page never renders a purchase path that
  // cannot actually work on this deployment.
  const billing = await resolvePricingBillingState();
  return <Landing locale={locale} billing={billing} />;
}
