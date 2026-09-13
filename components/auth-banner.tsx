"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, LogIn } from "lucide-react";
import type { Locale } from "@/lib/locale";

/**
 * The banner shown when a deployment has no Supabase project.
 *
 * It is deliberately prominent and non-dismissible: without accounts there is no way to
 * save anything, and letting a visitor believe otherwise would be the exact dishonesty
 * this product is built to avoid.
 */
export function AuthNotConfiguredBanner({ locale }: { locale: Locale }) {
  const ar = locale === "ar";
  const [open, setOpen] = useState(false);

  return (
    <div className="auth-banner" role="status">
      <LogIn size={17} aria-hidden="true" />
      <div>
        <strong>
          {ar ? "الحسابات غير مُهيَّأة في هذه النسخة" : "Accounts are not configured on this deployment"}
        </strong>
        <p>
          {ar
            ? "مركز القيادة يعمل الآن محليًا في هذا المتصفح فقط. لا يوجد حساب ولا حفظ على الخادم."
            : "The command center currently runs locally in this browser only. There is no account and no server-side storage."}
        </p>
        <button className="text-button" type="button" onClick={() => setOpen((value) => !value)}>
          {open ? (ar ? "إخفاء التفاصيل" : "Hide details") : ar ? "لماذا؟" : "Why?"}
        </button>
        {open && (
          <p className="muted" style={{ fontSize: 12.5, lineHeight: 1.7 }}>
            {ar
              ? "الحسابات والتخزين السحابي يتطلبان مشروع Supabase. المتغيرات المطلوبة: "
              : "Accounts and cloud storage require a Supabase project. Required variables: "}
            <code>NEXT_PUBLIC_SUPABASE_URL</code>
            <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code>
            <code>SUPABASE_SERVICE_ROLE_KEY</code>
          </p>
        )}
      </div>
      <Link className="button button-small button-outline" href={`/${locale}/pricing`}>
        {ar ? "الأسعار" : "Pricing"}
        <ArrowLeft size={14} className="direction-arrow" aria-hidden="true" />
      </Link>
    </div>
  );
}
