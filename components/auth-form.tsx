"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, Loader2 } from "lucide-react";
import { createBrowserSupabase } from "@/lib/db/browser";
import type { Locale } from "@/lib/locale";
import {
  describeAuthError,
  safeRedirectPath,
  signInSchema,
  signUpSchema,
} from "@/lib/auth/client";

/**
 * Sign-in / sign-up form.
 *
 * When no Supabase project is configured the component renders nothing interactive and
 * explains the configuration requirement instead: it never presents a form that cannot
 * possibly authenticate. Field validation mirrors the server-side schema exactly.
 */
export function AuthForm({
  locale,
  mode,
  next,
}: {
  locale: Locale;
  mode: "sign-in" | "sign-up";
  next: string | null;
}) {
  const router = useRouter();
  const ar = locale === "ar";
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const supabase = createBrowserSupabase();
  const target = safeRedirectPath(next) ?? `/${locale}/onboarding`;

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");
    if (!supabase) return;

    const form = new FormData(event.currentTarget);
    setPending(true);
    try {
      if (mode === "sign-up") {
        const parsed = signUpSchema.safeParse({
          email: form.get("email"),
          password: form.get("password"),
          fullName: form.get("fullName"),
          locale,
          acceptedTerms: form.get("acceptedTerms") === "on",
        });
        if (!parsed.success) {
          setError(parsed.error.issues[0]?.message ?? "Check the form.");
          return;
        }
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: parsed.data.email,
          password: parsed.data.password,
          options: {
            data: {
              full_name: parsed.data.fullName,
              locale: parsed.data.locale,
              terms_accepted_at: new Date().toISOString(),
            },
            emailRedirectTo: `${window.location.origin}/${locale}/auth/callback?next=${encodeURIComponent(target)}`,
          },
        });
        if (signUpError) {
          setError(describeAuthError(signUpError.message, locale));
          return;
        }
        if (!data.session) {
          setNotice(
            ar
              ? "تم إنشاء الحساب. تحقق من بريدك الإلكتروني لتأكيد الحساب ثم سجّل الدخول."
              : "Account created. Check your email to confirm it, then sign in.",
          );
          return;
        }
        router.push(target);
        router.refresh();
        return;
      }

      const parsed = signInSchema.safeParse({
        email: form.get("email"),
        password: form.get("password"),
      });
      if (!parsed.success) {
        setError(parsed.error.issues[0]?.message ?? "Check the form.");
        return;
      }
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: parsed.data.email,
        password: parsed.data.password,
      });
      if (signInError) {
        setError(describeAuthError(signInError.message, locale));
        return;
      }
      router.push(target);
      router.refresh();
    } catch {
      setError(describeAuthError(undefined, locale));
    } finally {
      setPending(false);
    }
  }

  if (!supabase) {
    return (
      <div className="capability-notice" role="status">
        <AlertTriangle size={19} aria-hidden="true" />
        <div>
          <h3>{ar ? "الحسابات غير مُهيَّأة في هذه النسخة" : "Accounts are not configured on this deployment"}</h3>
          <p>
            {ar
              ? "تسجيل الدخول وإنشاء الحسابات يتطلبان مشروع Supabase. لا يوجد مشروع مهيأ، لذلك لا يمكن إنشاء حساب أو الدخول."
              : "Sign-in and registration require a Supabase project. No project is configured, so no account can be created and nobody can sign in."}
          </p>
          <p>
            <strong>{ar ? "الإعدادات المطلوبة" : "Required configuration"}:</strong>{" "}
            <code>NEXT_PUBLIC_SUPABASE_URL</code>
            <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code>
            <code>SUPABASE_SERVICE_ROLE_KEY</code>
          </p>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="onboarding-card" noValidate>
      <h1 style={{ marginTop: 0, fontSize: 26 }}>
        {mode === "sign-up"
          ? ar
            ? "أنشئ حسابك"
            : "Create your account"
          : ar
            ? "تسجيل الدخول"
            : "Sign in"}
      </h1>
      <p className="muted" style={{ fontSize: 14, lineHeight: 1.7 }}>
        {mode === "sign-up"
          ? ar
            ? "حساب واحد لمتابعة أعمالك، باكتشافات محفوظة وسجل تدقيق."
            : "One account for your businesses, with saved findings and an audit trail."
          : ar
            ? "أدخل بياناتك للوصول إلى مركز القيادة."
            : "Enter your details to reach your command center."}
      </p>

      {mode === "sign-up" && (
        <div className="form-row">
          <label htmlFor="fullName">{ar ? "الاسم" : "Your name"}</label>
          <input id="fullName" name="fullName" autoComplete="name" required maxLength={120} />
        </div>
      )}

      <div className="form-row">
        <label htmlFor="email">{ar ? "البريد الإلكتروني" : "Email"}</label>
        <input id="email" name="email" type="email" autoComplete="email" required maxLength={254} dir="ltr" />
      </div>

      <div className="form-row">
        <label htmlFor="password">
          {mode === "sign-up"
            ? ar
              ? "كلمة المرور (10 أحرف على الأقل)"
              : "Password (at least 10 characters)"
            : ar
              ? "كلمة المرور"
              : "Password"}
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete={mode === "sign-up" ? "new-password" : "current-password"}
          required
          minLength={mode === "sign-up" ? 10 : undefined}
          maxLength={200}
          dir="ltr"
        />
      </div>

      {mode === "sign-up" && (
        <label className="form-row" style={{ gridTemplateColumns: "auto 1fr", alignItems: "center" }}>
          <input type="checkbox" name="acceptedTerms" style={{ width: 18, height: 18 }} />
          <span style={{ fontSize: 13, color: "var(--muted)" }}>
            {ar ? "أوافق على " : "I accept the "}
            <Link href={`/${locale}/legal/terms`}>{ar ? "الشروط" : "Terms"}</Link>
            {ar ? " و" : " and "}
            <Link href={`/${locale}/legal/privacy`}>{ar ? "سياسة الخصوصية" : "Privacy Policy"}</Link>
            .
          </span>
        </label>
      )}

      {error && (
        <p className="plan-error" role="alert">
          <AlertTriangle size={14} aria-hidden="true" /> {error}
        </p>
      )}
      {notice && (
        <p className="muted" role="status">
          {notice}
        </p>
      )}

      <div className="form-actions">
        <button className="button button-primary" type="submit" disabled={pending}>
          {pending && <Loader2 size={16} className="spin" aria-hidden="true" />}
          {mode === "sign-up"
            ? ar
              ? "إنشاء الحساب"
              : "Create account"
            : ar
              ? "دخول"
              : "Sign in"}
        </button>
        <Link
          className="button button-outline"
          href={mode === "sign-up" ? `/${locale}/sign-in` : `/${locale}/sign-up`}
        >
          {mode === "sign-up"
            ? ar
              ? "لدي حساب بالفعل"
              : "I already have an account"
            : ar
              ? "إنشاء حساب جديد"
              : "Create an account"}
        </Link>
      </div>
    </form>
  );
}
