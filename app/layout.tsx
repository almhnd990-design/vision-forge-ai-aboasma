import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";
export const metadata: Metadata = {
  title: {
    default: "GhostOps AI — Your invisible operator",
    template: "%s | GhostOps AI",
  },
  description:
    "Find the signals that matter. Evidence-led business intelligence, recovery, and operations.",
  icons: { icon: "/brand/ghostops-mascot.png" },
};
export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const locale = (await headers()).get("x-ghost-locale") === "ar" ? "ar" : "en";
  return (
    <html lang={locale} dir={locale === "ar" ? "rtl" : "ltr"}>
      <body>{children}</body>
    </html>
  );
}
