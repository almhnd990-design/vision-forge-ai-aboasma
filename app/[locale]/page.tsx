import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n/dictionaries";
import { Landing } from "@/components/landing";
export default async function Page({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return <Landing locale={locale} />;
}
