import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { APP_URL, isSupabaseConfigured } from "@/lib/config";
import "./globals.css";
import "./commercial.css";

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: {
    default: "GhostOps AI — Your invisible operator",
    template: "%s | GhostOps AI",
  },
  description:
    "Find the signals that matter. Evidence-led business intelligence, recovery, and operations for ecommerce operators.",
  applicationName: "GhostOps AI",
  icons: { icon: "/brand/ghostops-mascot.png" },
  openGraph: {
    type: "website",
    siteName: "GhostOps AI",
    title: "GhostOps AI — Your invisible operator",
    description:
      "Connect business signals, detect recoverable money and operational risk, review the evidence, and act. Built for ecommerce operators.",
    images: [{ url: "/brand/ghostops-mascot.png", width: 760, height: 760, alt: "GhostOps AI" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "GhostOps AI — Your invisible operator",
    description:
      "Evidence-led business intelligence for ecommerce operators. Human approval on every action.",
    images: ["/brand/ghostops-mascot.png"],
  },
  robots: { index: true, follow: true },
  /**
   * Canonical and hreflang alternates are declared per page. `/en` and `/ar` are the real
   * document URLs, so each localized page declares both plus an x-default.
   */
  alternates: {
    canonical: "/en",
    languages: {
      en: "/en",
      ar: "/ar",
      "x-default": "/en",
    },
  },
};

export const viewport: Viewport = {
  themeColor: "#090b10",
  colorScheme: "dark",
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const locale = (await headers()).get("x-ghost-locale") === "ar" ? "ar" : "en";
  return (
    <html lang={locale} dir={locale === "ar" ? "rtl" : "ltr"}>
      {/*
        Auth capability is published as a data attribute so styling and tests can assert
        the honest configured/unconfigured state without shipping server env values.
      */}
      <body data-auth-configured={isSupabaseConfigured() ? "true" : "false"}>
        {children}
      </body>
    </html>
  );
}
