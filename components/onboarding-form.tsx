"use client";

import { useActionState, useState } from "react";
import { AlertTriangle, Check, Loader2 } from "lucide-react";
import type { Locale } from "@/lib/locale";
import { ConfigNotice } from "@/components/config-notice";
import { createWorkspaceAction, type ActionState } from "@/lib/actions/workspace";

export type ConnectorOption = {
  key: "stripe";
  label: string;
  available: boolean;
  reason?: string;
  requiredEnv: string[];
};

/**
 * Onboarding.
 *
 * Four short steps, each collecting only what the product cannot infer. The final step
 * either connects a provider (only when that connector is genuinely available) or lands the
 * operator in the dashboard with a manual snapshot. Nothing is simulated: an unavailable
 * connector is shown as unavailable with the variables that would enable it.
 */
export function OnboardingForm({
  locale,
  email,
  authConfigured,
  connector,
  existingWorkspaceName,
}: {
  locale: Locale;
  email: string | null;
  authConfigured: boolean;
  connector: ConnectorOption;
  existingWorkspaceName: string | null;
}) {
  const ar = locale === "ar";
  const [step, setStep] = useState(0);
  const [name, setName] = useState(existingWorkspaceName ?? "");
  const [businessType, setBusinessType] = useState("");
  const [goal, setGoal] = useState("");
  const [startProvider, setStartProvider] = useState<"stripe" | "manual">("manual");
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    createWorkspaceAction,
    null,
  );

  const businessTypes = ar
    ? [
        ["store", "متجر إلكتروني"],
        ["marketplace", "بائع على منصة"],
        ["services", "أعمال خدمات"],
        ["retail", "متاجر فعلية + أونلاين"],
        ["other", "أخرى"],
      ]
    : [
        ["store", "Online store"],
        ["marketplace", "Marketplace seller"],
        ["services", "Service business"],
        ["retail", "Retail + online"],
        ["other", "Other"],
      ];

  const goals = ar
    ? [
        ["recover", "استرداد أموال ضائعة"],
        ["margins", "حماية هوامش الربح"],
        ["operations", "تقليل مشاكل التشغيل"],
        ["growth", "نمو الإيرادات"],
      ]
    : [
        ["recover", "Recover lost money"],
        ["protect", "Protect margins"],
        ["operations", "Reduce operational problems"],
        ["growth", "Grow revenue"],
      ];

  const steps = ar
    ? ["الترحيب", "النشاط التجاري", "الهدف", "البيانات"]
    : ["Welcome", "Business", "Goal", "Data"];

  if (!authConfigured) {
    return (
      <ConfigNotice
        locale={locale}
        title={ar ? "الحسابات غير مُهيَّأة في هذه النسخة" : "Accounts are not configured on this deployment"}
        body={
          ar
            ? "إنشاء مساحة عمل يتطلب مشروع Supabase لحفظ البيانات على الخادم. لا يوجد مشروع مهيأ، لذلك لا يمكن حفظ أي شيء."
            : "Creating a workspace requires a Supabase project for server-side storage. No project is configured, so nothing can be saved."
        }
        missingEnv={[
          "NEXT_PUBLIC_SUPABASE_URL",
          "NEXT_PUBLIC_SUPABASE_ANON_KEY",
          "SUPABASE_SERVICE_ROLE_KEY",
        ]}
      />
    );
  }

  return (
    <div className="onboarding-card">
      <div className="onboarding-steps">
        {steps.map((label, index) => (
          <span
            key={label}
            className={`onboarding-step-dot${index === step ? " active" : ""}`}
            aria-current={index === step ? "step" : undefined}
          >
            {index + 1}. {label}
          </span>
        ))}
      </div>

      {step === 0 && (
        <div>
          <h1 style={{ marginTop: 0, fontSize: 26 }}>
            {ar ? "مرحبًا بك في GhostOps" : "Welcome to GhostOps"}
          </h1>
          <p className="muted" style={{ fontSize: 14, lineHeight: 1.8 }}>
            {ar
              ? "GhostOps يقرأ أرقام أعمالك، يكشف الأموال القابلة للاسترداد والمخاطر التشغيلية، ويعرض الدليل قبل أي خطوة. القرار يبقى لك دائمًا."
              : "GhostOps reads your business numbers, finds recoverable money and operational risk, and shows the evidence before any step is taken. The decision always stays with you."}
          </p>
          {email && (
            <p className="muted" style={{ fontSize: 13 }}>
              {ar ? "الحساب: " : "Signed in as "}
              <strong dir="ltr">{email}</strong>
            </p>
          )}
          <p className="muted" style={{ fontSize: 13 }}>
            {ar
              ? "لا يحرّك GhostOps أي أموال، ولا يتصرف نيابة عنك."
              : "GhostOps does not move money and does not act on your behalf."}
          </p>
          <div className="form-actions">
            <button className="button button-primary" type="button" onClick={() => setStep(1)}>
              {ar ? "ابدأ" : "Get started"}
            </button>
          </div>
        </div>
      )}

      {step === 1 && (
        <div>
          <h2 style={{ marginTop: 0, fontSize: 21 }}>
            {ar ? "ما اسم نشاطك التجاري؟" : "What should we call your business?"}
          </h2>
          <div className="form-row">
            <label htmlFor="name">{ar ? "اسم النشاط التجاري" : "Business name"}</label>
            <input
              id="name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={120}
              required
              autoFocus
            />
          </div>
          <p className="muted" style={{ fontSize: 13 }}>
            {ar ? "النوع (اختياري)" : "Type (optional)"}
          </p>
          <div className="choice-grid">
            {businessTypes.map(([value, label]) => (
              <button
                key={value}
                type="button"
                aria-pressed={businessType === value}
                onClick={() => setBusinessType(businessType === value ? "" : value)}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="form-actions">
            <button
              className="button button-primary"
              type="button"
              disabled={name.trim().length === 0}
              onClick={() => setStep(2)}
            >
              {ar ? "التالي" : "Continue"}
            </button>
            <button className="button button-quiet" type="button" onClick={() => setStep(0)}>
              {ar ? "رجوع" : "Back"}
            </button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div>
          <h2 style={{ marginTop: 0, fontSize: 21 }}>
            {ar ? "ما أهم هدف لديك الآن؟" : "What matters most right now?"}
          </h2>
          <div className="choice-grid">
            {goals.map(([value, label]) => (
              <button
                key={value}
                type="button"
                aria-pressed={goal === value}
                onClick={() => setGoal(goal === value ? "" : value)}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="form-actions">
            <button className="button button-primary" type="button" onClick={() => setStep(3)}>
              {ar ? "التالي" : "Continue"}
            </button>
            <button className="button button-quiet" type="button" onClick={() => setStep(1)}>
              {ar ? "رجوع" : "Back"}
            </button>
          </div>
        </div>
      )}

      {step === 3 && (
        <form action={formAction}>
          <h2 style={{ marginTop: 0, fontSize: 21 }}>
            {ar ? "كيف تريد إدخال البيانات؟" : "How should we get your data?"}
          </h2>
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="name" value={name} />
          <input type="hidden" name="businessType" value={businessType} />
          <input type="hidden" name="primaryGoal" value={goal} />
          <input type="hidden" name="startProvider" value={startProvider} />

          <div className="choice-grid">
            <button
              type="button"
              aria-pressed={startProvider === "manual"}
              onClick={() => setStartProvider("manual")}
            >
              {ar ? "إدخال الأرقام يدويًا" : "Enter numbers manually"}
              <br />
              <span className="muted" style={{ fontSize: 12 }}>
                {ar ? "يعمل الآن" : "Available now"}
              </span>
            </button>
            <button
              type="button"
              aria-pressed={startProvider === "stripe"}
              disabled={!connector.available}
              onClick={() => connector.available && setStartProvider("stripe")}
            >
              {connector.label}
              <br />
              <span className="muted" style={{ fontSize: 12 }}>
                {connector.available
                  ? ar
                    ? "استيراد للقراءة فقط"
                    : "Read-only import"
                  : ar
                    ? "غير مهيأ في هذه النسخة"
                    : "Not configured here"}
              </span>
            </button>
          </div>

          {!connector.available && (
            <p className="muted" style={{ fontSize: 13, marginTop: 12 }}>
              {connector.reason ?? (ar ? "هذا الموصل غير مهيأ." : "That connector is not configured.")}{" "}
              {connector.requiredEnv.map((name) => (
                <code key={name}>{name}</code>
              ))}
            </p>
          )}

          {state && !state.ok && (
            <p className="plan-error" role="alert">
              <AlertTriangle size={14} aria-hidden="true" /> {state.message}
            </p>
          )}

          <div className="form-actions">
            <button className="button button-primary" type="submit" disabled={pending}>
              {pending ? (
                <Loader2 size={16} className="spin" aria-hidden="true" />
              ) : (
                <Check size={16} aria-hidden="true" />
              )}
              {ar ? "إنشاء مساحة العمل" : "Create workspace"}
            </button>
            <button className="button button-quiet" type="button" onClick={() => setStep(2)}>
              {ar ? "رجوع" : "Back"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
