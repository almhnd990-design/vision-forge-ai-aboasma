import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, Languages } from "lucide-react";
import { Locale, getDictionary } from "@/lib/i18n/dictionaries";
export function Brand({
  locale,
  compact = false,
}: {
  locale: Locale;
  compact?: boolean;
}) {
  return (
    <Link
      className={`brand ${compact ? "compact" : ""}`}
      href={`/${locale}`}
      aria-label="GhostOps AI"
    >
      <span className="brand-avatar">
        <Image src="/brand/ghostops-mascot.png" alt="" width={48} height={48} />
      </span>
      <span dir="ltr">
        GhostOps<span className="brand-ai"> AI</span>
      </span>
    </Link>
  );
}
export function LanguageSwitch({
  locale,
  dashboard = false,
}: {
  locale: Locale;
  dashboard?: boolean;
}) {
  return (
    <a
      className="language-switch"
      href={`/${locale === "en" ? "ar" : "en"}${dashboard ? "/dashboard" : ""}`}
      lang={locale === "en" ? "ar" : "en"}
      hrefLang={locale === "en" ? "ar" : "en"}
    >
      <Languages size={16} />
      {getDictionary(locale).lang}
    </a>
  );
}
export function Arrow({ size = 18 }: { size?: number }) {
  return (
    <ArrowUpRight size={size} className="direction-arrow" aria-hidden="true" />
  );
}
