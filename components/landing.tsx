import Image from "next/image";
import Link from "next/link";
import {
  Activity,
  ArrowDown,
  ArrowRight,
  ChartNoAxesCombined,
  Check,
  Fingerprint,
  LockKeyhole,
  Radar,
  ScanLine,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { Locale, getDictionary } from "@/lib/i18n/dictionaries";
import { PricingCards, type PricingBillingState } from "./pricing";
import { Arrow, Brand, LanguageSwitch } from "./brand";
const partners = ["Shopify", "stripe", "amazon", "Gmail"];
export function Landing({
  locale,
  billing,
}: {
  locale: Locale;
  billing: PricingBillingState;
}) {
  const t = getDictionary(locale);
  const features = [Wallet, ChartNoAxesCombined, Radar];
  const trust = [ScanLine, ShieldCheck, Fingerprint];
  return (
    <>
      <a className="skip-link" href="#main">
        {locale === "ar" ? "انتقل إلى المحتوى" : "Skip to content"}
      </a>
      <header className="site-header">
        <div className="container nav-inner">
          <Brand locale={locale} />
          <nav
            className="desktop-nav"
            aria-label={locale === "ar" ? "التنقل الرئيسي" : "Main navigation"}
          >
            {t.nav.map((label, i) => (
              <a key={label} href={`#${["platform", "workflow", "trust"][i]}`}>
                {label}
              </a>
            ))}
          </nav>
          <div className="nav-actions">
            <LanguageSwitch locale={locale} />
            <Link href={`/${locale}/pricing`} className="nav-link">
              {locale === "ar" ? "الأسعار" : "Pricing"}
            </Link>
            <Link
              href={`/${locale}/dashboard`}
              className="button button-small button-outline nav-cta"
            >
              {t.enter}
              <Arrow size={16} />
            </Link>
          </div>
        </div>
      </header>
      <main id="main">
        <section className="hero container">
          <div className="hero-copy">
            <div className="eyebrow">
              <span className="tiny-star">✦</span>
              {t.eyebrow}
            </div>
            <h1>
              {t.hero1}
              <br />
              <span className="gradient-text">{t.hero2}</span>
            </h1>
            <p className="lead">{t.heroCopy}</p>
            <div className="hero-actions">
              <Link
                className="button button-primary"
                href={`/${locale}/dashboard`}
              >
                {t.cta}
                <Arrow />
              </Link>
              <a className="button button-quiet" href="#workflow">
                {t.secondary}
                <ArrowDown size={16} />
              </a>
            </div>
            <p className="hero-note">
              <ShieldCheck size={15} />
              {t.heroNote}
            </p>
          </div>
          <div className="hero-visual">
            <div className="orbital orbital-one" />
            <div className="orbital orbital-two" />
            <div className="mascot-glow" />
            <Image
              className="hero-mascot"
              src="/brand/ghostops-mascot.png"
              alt={
                locale === "ar"
                  ? "شخصية GhostOps بغطاء رأس داكن وعيون سماوية مضيئة وحرف G"
                  : "GhostOps hooded guardian with glowing cyan eyes and a G on its chest"
              }
              width={760}
              height={760}
              priority
              sizes="(max-width: 760px) 90vw, 52vw"
            />
            <div className="signal-badge signal-one">
              <span className="signal-icon">
                <ScanLine size={18} />
              </span>
              <span>{t.orbit1}</span>
              <span className="status-dot" />
            </div>
            <div className="signal-badge signal-two">
              <span className="signal-icon purple">
                <TrendingUp size={18} />
              </span>
              {t.orbit2}
            </div>
            <div className="hero-caption">
              <span />
              GHOSTOPS / YOUR INVISIBLE OPERATOR
              <span />
            </div>
          </div>
        </section>
        <section className="partners container">
          <p>{t.platforms}</p>
          <div className="partner-logos" dir="ltr">
            {partners.map((p, i) => (
              <span className={`partner partner-${i}`} key={p}>
                {p}
              </span>
            ))}
          </div>
          <small>{t.integrationNote}</small>
        </section>
        <section className="section container" id="platform">
          <div className="section-head">
            <div>
              <div className="eyebrow">{t.valueEyebrow}</div>
              <h2>{t.valueTitle}</h2>
            </div>
            <p>{t.valueCopy}</p>
          </div>
          <div className="feature-grid">
            {t.features.map(([title, desc], i) => {
              const Icon = features[i];
              return (
                <article className={`feature-card feature-${i}`} key={title}>
                  <div className="feature-art" aria-hidden="true">
                    {i === 0 ? (
                      <div className="recovery-art">
                        <span className="art-ring" />
                        <Wallet size={46} strokeWidth={1.2} />
                        <span className="art-check">
                          <Check size={17} />
                        </span>
                        <span className="art-line" />
                      </div>
                    ) : i === 1 ? (
                      <div className="bars-art">
                        {[32, 51, 42, 68, 61, 90, 100].map((h, j) => (
                          <i key={j} style={{ height: `${h}%` }} />
                        ))}
                        <TrendingUp size={62} />
                      </div>
                    ) : (
                      <div className="radar-art">
                        <span />
                        <span />
                        <span />
                        <i />
                        <Radar size={66} strokeWidth={0.7} />
                      </div>
                    )}
                  </div>
                  <div className="feature-title">
                    <Icon size={20} />
                    <h3>{title}</h3>
                  </div>
                  <p>{desc}</p>
                </article>
              );
            })}
          </div>
        </section>
        <section className="workflow-section" id="workflow">
          <div className="container">
            <div className="center-heading">
              <div className="eyebrow">{t.workflowEyebrow}</div>
              <h2>{t.workflowTitle}</h2>
            </div>
            <div className="steps-grid">
              {t.steps.map(([title, desc], i) => (
                <article key={title}>
                  <div className="step-top">
                    <span className="step-number">0{i + 1}</span>
                    {i < 2 && (
                      <span className="step-line">
                        <ArrowRight size={16} />
                      </span>
                    )}
                  </div>
                  <h3>{title}</h3>
                  <p>{desc}</p>
                </article>
              ))}
            </div>
          </div>
        </section>
        <section className="section container trust-section" id="trust">
          <div className="trust-visual">
            <div className="trust-orbit" />
            <div className="shield-glow">
              <ShieldCheck size={90} strokeWidth={0.8} />
            </div>
            <span className="trust-mini mini-lock">
              <LockKeyhole size={24} />
            </span>
            <span className="trust-mini mini-scan">
              <ScanLine size={24} />
            </span>
            <span className="trust-mini mini-fingerprint">
              <Fingerprint size={24} />
            </span>
            <div className="trust-caption">
              <span className="status-dot" />
              {t.orbit3}
            </div>
          </div>
          <div>
            <div className="eyebrow">{t.trustEyebrow}</div>
            <h2>{t.trustTitle}</h2>
            <p className="trust-copy">{t.trustCopy}</p>
            <div className="trust-list">
              {t.trust.map(([h, p], i) => {
                const Icon = trust[i];
                return (
                  <div key={h}>
                    <Icon size={20} />
                    <div>
                      <h3>{h}</h3>
                      <p>{p}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
        <PricingCards locale={locale} billing={billing} variant="section" />
        <section className="container final-section">
          <div className="final-card">
            <div className="eyebrow">
              <Sparkles size={16} />
              GHOSTOPS AI
            </div>
            <h2>{t.finalTitle}</h2>
            <p>{t.finalCopy}</p>
            <Link
              href={`/${locale}/dashboard`}
              className="button button-primary"
            >
              {t.cta}
              <Arrow />
            </Link>
            <div className="final-orbit" aria-hidden="true" />
          </div>
        </section>
      </main>
      <footer className="container footer">
        <div>
          <Brand locale={locale} />
          <p>{t.footer}</p>
        </div>
        <div className="footer-end">
          <span>© {new Date().getFullYear()} GhostOps AI</span>
          <p>{t.footerNote}</p>
          <a href={`/${locale}/dashboard`}>
            <Activity size={13} />
            {t.enter}
            <Arrow size={13} />
          </a>
        </div>
      </footer>
    </>
  );
}
