"use client";

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  CreditCard,
  Download,
  Loader2,
  LogOut,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import type { Locale } from "@/lib/locale";
import { PRICE_LABELS } from "@/lib/i18n/labels";
import { formatPlanPrice, formatDateTime } from "@/lib/pricing-format";
import { PLANS, type PlanId } from "@/lib/plans";
import {
  renameWorkspaceAction,
  signOutAction,
  updateLocaleAction,
  type ActionState,
} from "@/lib/actions/workspace";
import {
  deleteAccountAction,
  exportWorkspaceAction,
  type DeleteState,
  type ExportState,
} from "@/lib/actions/account";

export type ConnectionSummary = {
  providerKey: string;
  status: string;
  accountLabel: string | null;
  lastSyncAt: string | null;
  lastSyncStatus: string | null;
  lastError: string | null;
};

export type SettingsView = {
  locale: Locale;
  email: string | null;
  fullName: string | null;
  workspace: {
    id: string;
    name: string;
    businessType: string | null;
    createdAt: string;
  } | null;
  plan: {
    planId: PlanId | null;
    billingStatus: string;
    interval: string | null;
    currentPeriodEnd: string | null;
    trialEndsAt: string | null;
  };
  usage: { analysesThisMonth: number; analysesLimit: number | null };
  connections: ConnectionSummary[];
  billingConfigured: boolean;
  missingBillingEnv: string[];
  authConfigured: boolean;
};

export function SettingsClient({ view }: { view: SettingsView }) {
  const { locale } = view;
  const ar = locale === "ar";
  const [renameState, renameAction, renaming] = useActionState<ActionState, FormData>(
    renameWorkspaceAction,
    null,
  );
  const [localeState, localeAction, savingLocale] = useActionState<ActionState, FormData>(
    updateLocaleAction,
    null,
  );
  const [exportState, exportAction, exporting] = useActionState<ExportState, FormData>(
    exportWorkspaceAction,
    null,
  );
  const [deleteState, deleteAction, deleting] = useActionState<DeleteState, FormData>(
    deleteAccountAction,
    null,
  );
  const [portalError, setPortalError] = useState("");
  const [portalPending, setPortalPending] = useState(false);

  // Trigger the download in the browser from JSON returned by the server action.
  useEffect(() => {
    if (!exportState || !exportState.ok) return;
    const blob = new Blob([exportState.json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = exportState.filename;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, [exportState]);

  async function openPortal() {
    if (!view.workspace) return;
    setPortalError("");
    setPortalPending(true);
    try {
      const response = await fetch("/api/billing/portal", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ workspaceId: view.workspace.id, locale }),
      });
      const payload = (await response.json()) as { url?: string; error?: { message?: string } };
      if (!response.ok || !payload.url) {
        setPortalError(payload.error?.message ?? (ar ? "تعذّر فتح بوابة الفوترة." : "The billing portal could not be opened."));
        return;
      }
      window.location.assign(payload.url);
    } catch {
      setPortalError(ar ? "تعذّر فتح بوابة الفوترة." : "The billing portal could not be opened.");
    } finally {
      setPortalPending(false);
    }
  }

  const plan = view.plan.planId ? PLANS[view.plan.planId] : null;
  const admin = (key: string) =>
    ar
      ? (
          {
            profile: "الملف الشخصي",
            account: "الحساب",
            workspace: "مساحة العمل",
            language: "اللغة",
            subscription: "الاشتراك",
            connections: "الخدمات المرتبطة",
            data: "البيانات",
            plan: "الخطة الحالية",
            status: "الحالة",
            renews: "ينتهي في",
            trialEnds: "تنتهي التجربة في",
            usage: "الاستخدام هذا الشهر",
            manage: "إدارة الفوترة",
            save: "حفظ",
            noPlan: "لا توجد خطة نشطة",
            notConnected: "لا توجد خدمات مرتبطة",
            exportCta: "تصدير بيانات مساحة العمل",
            deleteCta: "حذف الحساب وكل البيانات",
            deleteWarning:
              "الحذف نهائي ويزيل مساحات العمل واللقطات والنتائج والمراجعات وسجل التدقيق. اكتب DELETE للتأكيد.",
            confirmLabel: "اكتب DELETE للتأكيد",
            deleteButton: "حذف نهائي",
            signOut: "تسجيل الخروج",
            configured: "مهيأ",
            notConfigured: "غير مهيأ",
            missing: "المتغيرات الناقصة",
            languageHint: "تُستخدم لغتك المفضلة في رسائل الحساب.",
          } as Record<string, string>
        )[key]
      : (
          {
            profile: "Profile",
            account: "Account",
            workspace: "Workspace",
            language: "Language",
            subscription: "Subscription",
            connections: "Connected services",
            data: "Data",
            plan: "Current plan",
            status: "Status",
            renews: "Renews",
            trialEnds: "Trial ends",
            usage: "Usage this month",
            manage: "Manage billing",
            save: "Save",
            noPlan: "No active plan",
            notConnected: "No services connected",
            exportCta: "Export workspace data",
            deleteCta: "Delete account and all data",
            deleteWarning:
              "Deletion is permanent and removes workspaces, snapshots, findings, reviews and the audit trail. Type DELETE to confirm.",
            confirmLabel: "Type DELETE to confirm",
            deleteButton: "Delete permanently",
            signOut: "Sign out",
            configured: "Configured",
            notConfigured: "Not configured",
            missing: "Missing variables",
            languageHint: "Used for account messages.",
          } as Record<string, string>
        )[key];

  return (
    <div className="settings-grid">
      {/* Profile */}
      <section className="panel">
        <div className="panel-heading">
          <h2>{admin("profile")}</h2>
        </div>
        <div className="settings-row">
          <span>{admin("account")}</span>
          <strong dir="ltr">{view.email ?? "—"}</strong>
        </div>
        <div className="settings-row">
          <span>{admin("language")}</span>
          <form action={localeAction} style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input type="hidden" name="locale" value={locale} />
            <select name="preferred" defaultValue={locale} aria-label={admin("language")}>
              <option value="en">English</option>
              <option value="ar">العربية</option>
            </select>
            <button className="button button-small button-outline" type="submit" disabled={savingLocale}>
              {savingLocale && <Loader2 size={14} className="spin" aria-hidden="true" />}
              {admin("save")}
            </button>
          </form>
        </div>
        {localeState && (
          <p className={localeState.ok ? "muted" : "plan-error"} role="status">
            {localeState.message}
          </p>
        )}
        <div className="settings-row">
          <span>{admin("languageHint")}</span>
          <form action={signOutAction}>
            <input type="hidden" name="locale" value={locale} />
            <button className="button button-small button-quiet" type="submit">
              <LogOut size={14} aria-hidden="true" /> {admin("signOut")}
            </button>
          </form>
        </div>
      </section>

      {/* Workspace */}
      {view.workspace && (
        <section className="panel">
          <div className="panel-heading">
            <h2>{admin("workspace")}</h2>
          </div>
          <form action={renameAction} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12 }}>
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="workspaceId" value={view.workspace.id} />
            <input
              name="name"
              defaultValue={view.workspace.name}
              maxLength={120}
              aria-label={admin("workspace")}
              style={{ flex: 1, minWidth: 180 }}
            />
            <button className="button button-small button-outline" type="submit" disabled={renaming}>
              {renaming && <Loader2 size={14} className="spin" aria-hidden="true" />}
              {admin("save")}
            </button>
          </form>
          {renameState && (
            <p className={renameState.ok ? "muted" : "plan-error"} role="status">
              {renameState.message}
            </p>
          )}
          <div className="settings-row">
            <span>{ar ? "أُنشئت" : "Created"}</span>
            <span>{formatDateTime(view.workspace.createdAt, locale)}</span>
          </div>
          <div className="settings-row">
            <span>{ar ? "النوع" : "Type"}</span>
            <span>{view.workspace.businessType ?? "—"}</span>
          </div>
        </section>
      )}

      {/* Subscription */}
      <section className="panel">
        <div className="panel-heading">
          <h2>{admin("subscription")}</h2>
        </div>
        <div className="settings-row">
          <span>{admin("plan")}</span>
          <strong>
            {plan
              ? `${plan.name[locale]} · ${formatPlanPrice(plan.prices.month.amount, locale, PRICE_LABELS[locale], "month")}`
              : admin("noPlan")}
          </strong>
        </div>
        <div className="settings-row">
          <span>{admin("status")}</span>
          <span className={`status-pill ${view.plan.billingStatus}`}>{view.plan.billingStatus}</span>
        </div>
        {view.plan.currentPeriodEnd && (
          <div className="settings-row">
            <span>{admin("renews")}</span>
            <span>{formatDateTime(view.plan.currentPeriodEnd, locale)}</span>
          </div>
        )}
        {view.plan.trialEndsAt && (
          <div className="settings-row">
            <span>{admin("trialEnds")}</span>
            <span>{formatDateTime(view.plan.trialEndsAt, locale)}</span>
          </div>
        )}
        <div className="settings-row">
          <span>{admin("usage")}</span>
          <span>
            {view.usage.analysesThisMonth}
            {view.usage.analysesLimit === null ? "" : ` / ${view.usage.analysesLimit}`}
          </span>
        </div>

        {view.billingConfigured ? (
          <div className="form-actions">
            <button
              className="button button-outline button-small"
              type="button"
              onClick={openPortal}
              disabled={portalPending}
            >
              {portalPending ? (
                <Loader2 size={14} className="spin" aria-hidden="true" />
              ) : (
                <CreditCard size={14} aria-hidden="true" />
              )}
              {admin("manage")}
            </button>
            <Link className="button button-quiet button-small" href={`/${locale}/pricing`}>
              {ar ? "عرض الخطط" : "View plans"}
            </Link>
          </div>
        ) : (
          <div className="capability-notice" role="status" style={{ marginTop: 14 }}>
            <AlertTriangle size={18} aria-hidden="true" />
            <div>
              <h3>{ar ? "الفوترة غير مهيأة" : "Billing is not configured"}</h3>
              <p>
                {ar
                  ? "لا يمكن عرض اشتراك أو تغييره لأن Stripe غير مهيأ في هذه النسخة."
                  : "No subscription can be shown or changed because Stripe is not configured on this deployment."}
              </p>
              <p>
                <strong>{admin("missing")}:</strong>{" "}
                {view.missingBillingEnv.map((name) => (
                  <code key={name}>{name}</code>
                ))}
              </p>
            </div>
          </div>
        )}
        {portalError && (
          <p className="plan-error" role="alert">
            {portalError}
          </p>
        )}
      </section>

      {/* Connections */}
      <section className="panel">
        <div className="panel-heading">
          <h2>{admin("connections")}</h2>
        </div>
        {view.connections.length === 0 ? (
          <p className="muted" style={{ fontSize: 13 }}>
            {admin("notConnected")}
          </p>
        ) : (
          view.connections.map((connection) => (
            <div className="settings-row" key={connection.providerKey}>
              <span>
                {connection.providerKey}
                {connection.accountLabel ? ` · ${connection.accountLabel}` : ""}
              </span>
              <span className={`status-pill ${connection.status === "connected" ? "active" : "none"}`}>
                {connection.status}
              </span>
            </div>
          ))
        )}
        <p className="muted" style={{ fontSize: 12.5, marginTop: 10 }}>
          {ar
            ? "لا تُخزَّن بيانات اعتماد المزوّدين في المتصفح، ولا تُعاد إليه أبدًا."
            : "Provider credentials are never stored in the browser and are never returned to it."}
        </p>
      </section>

      {/* Data rights */}
      <section className="panel">
        <div className="panel-heading">
          <h2>{admin("data")}</h2>
        </div>
        {view.workspace && (
          <form action={exportAction} className="form-actions" style={{ marginTop: 0 }}>
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="workspaceId" value={view.workspace.id} />
            <button className="button button-outline button-small" type="submit" disabled={exporting}>
              {exporting ? (
                <Loader2 size={14} className="spin" aria-hidden="true" />
              ) : (
                <Download size={14} aria-hidden="true" />
              )}
              {admin("exportCta")}
            </button>
          </form>
        )}
        {exportState && !exportState.ok && (
          <p className="plan-error" role="alert">
            {exportState.message}
          </p>
        )}

        <div className="capability-notice" role="note" style={{ marginTop: 16 }}>
          <ShieldCheck size={18} aria-hidden="true" />
          <div>
            <h3>{admin("deleteCta")}</h3>
            <p>{admin("deleteWarning")}</p>
          </div>
        </div>
        <form action={deleteAction} style={{ display: "grid", gap: 8 }}>
          <input type="hidden" name="locale" value={locale} />
          <div className="form-row">
            <label htmlFor="confirm">{admin("confirmLabel")}</label>
            <input id="confirm" name="confirm" dir="ltr" autoComplete="off" placeholder="DELETE" />
          </div>
          <button className="button button-quiet button-small" type="submit" disabled={deleting}>
            {deleting ? (
              <Loader2 size={14} className="spin" aria-hidden="true" />
            ) : (
              <Trash2 size={14} aria-hidden="true" />
            )}
            {admin("deleteButton")}
          </button>
        </form>
        {deleteState && !deleteState.ok && (
          <p className="plan-error" role="alert">
            {deleteState.message}
          </p>
        )}
      </section>
    </div>
  );
}
