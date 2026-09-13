import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n/dictionaries";
import { Brand, LanguageSwitch } from "@/components/brand";
import {
  getLegalDoc,
  isLegalDocKey,
  LEGAL_DOC_KEYS,
  type LegalDocKey,
} from "@/lib/legal/content";

/** Pre-render every legal document in both languages. */
export function generateStaticParams() {
  return LEGAL_DOC_KEYS.flatMap((doc) => [
    { locale: "en", doc },
    { locale: "ar", doc },
  ]);
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; doc: string }>;
}): Promise<Metadata> {
  const { locale, doc } = await params;
  if (!isLocale(locale) || !isLegalDocKey(doc)) return { title: "Not found" };
  const content = getLegalDoc(locale, doc);
  return {
    title: content.title,
    description: content.draftNotice.slice(0, 180),
    alternates: {
      canonical: `/${locale}/legal/${doc}`,
      languages: {
        en: `/en/legal/${doc}`,
        ar: `/ar/legal/${doc}`,
        "x-default": `/en/legal/${doc}`,
      },
    },
    // Draft legal pages must not be indexed while they still need review.
    robots: { index: false, follow: true },
  };
}

/**
 * Legal / trust documents.
 *
 * Rendered from a typed content module so the wording lives in one place per language.
 * The draft notice is always displayed: these pages must not read as final legal text.
 */
export default async function LegalPage({
  params,
}: {
  params: Promise<{ locale: string; doc: string }>;
}) {
  const { locale, doc } = await params;
  if (!isLocale(locale) || !isLegalDocKey(doc)) notFound();
  const content = getLegalDoc(locale, doc as LegalDocKey);
  const t = (await import("@/lib/i18n/dictionaries")).getDictionary(locale);

  return (
    <>
      <header className="site-header">
        <div className="container nav-inner">
          <Brand locale={locale} />
          <div className="nav-actions">
            <LanguageSwitch locale={locale} />
            <a className="button button-small button-outline nav-cta" href={`/${locale}/pricing`}>
              {locale === "ar" ? "الأسعار" : "Pricing"}
            </a>
          </div>
        </div>
      </header>
      <main className="legal-page">
        <h1>{content.title}</h1>
        <p className="legal-updated">
          {locale === "ar" ? "آخر تحديث: " : "Last updated: "}
          {content.updated}
        </p>
        <p className="legal-draft" role="note">
          {content.draftNotice}
        </p>
        {content.sections.map((section) => (
          <section key={section.heading}>
            <h2>{section.heading}</h2>
            {section.body.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
            {section.list && (
              <ul>
                {section.list.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </main>
      <footer className="container footer">
        <div>
          <Brand locale={locale} />
          <p>{t.footer}</p>
        </div>
        <div className="footer-end">
          <span>© {new Date().getFullYear()} GhostOps AI</span>
          {LEGAL_DOC_KEYS.map((key) => (
            <a key={key} href={`/${locale}/legal/${key}`}>
              {getLegalDoc(locale, key).title}
            </a>
          ))}
        </div>
      </footer>
    </>
  );
}
