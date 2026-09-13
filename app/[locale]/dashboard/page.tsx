import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n/dictionaries";
import { Dashboard } from "@/components/dashboard";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  return {
    title: (await params).locale === "ar" ? "مركز القيادة" : "Command center",
  };
}
export default async function Page({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return <Dashboard locale={locale} />;
}
