"use client";

import { useState } from "react";
import {
  AlertTriangle,
  Check,
  Loader2,
  PlugZap,
  RefreshCw,
  Unplug,
} from "lucide-react";
import type { Locale } from "@/lib/locale";
import { formatDateTime } from "@/lib/pricing-format";

export type ProviderState = {
  key: string;
  status: "live" | "planned";
  name: { en: string; ar: string };
  reads: { en: string; ar: string };
  doesNot: { en: string; ar: string }[];
  credentialFields: Array<{
    name: string;
    label: { en: string; ar: string };
    help: { en: string; ar: string };
    secret: boolean;
    placeholder?: string;
  }>;
  requiredEnv: string[];
  missingEnv: string[];
  configured: boolean;
  performsWrites: boolean;
  canConnect: boolean;
  blockedBy: "configuration" | "plan_limit" | null;
};

export type ConnectionState = {
  providerKey: string;
  status: string;
  accountLabel: string | null;
  lastSyncAt: string | null;
  lastSyncStatus: string | null;
  lastError: string | null;
  scopes: string[];
};

export type ConnectionsView = {
  locale: Locale;
  workspaceId: string;
  plan: {
    planId: string | null;
    blockedReason: string | null;
    connectedProviders: number | null;
    analysesPerMonth: number | null;
    usage: { connected: number; analysesThisMonth: number };
  };
  providers: ProviderState[];
  connections: ConnectionState[];
};

/**
 * Connections UI.
 *
 * Honesty rules enforced here:
 *  - a provider whose `status` is `planned` renders a "Coming soon" label and NO action;
 *  - a provider that is live but unconfigured shows exactly which variables are missing;
 *  - the credential form appears only when a real connection attempt can succeed;
 *  - sync reports what the connector actually imported, including its own limitations.
 */
export function ConnectionsClient({ view }: { view: ConnectionsView }) {
  const { locale } = view;
  const ar = locale === "ar";
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [syncNotes, setSyncNotes] = useState<string[]>([]);
  const [credentials, setCredentials] = useState<Record<string, string>>({});

  const connectionFor = (key: string) => view.connections.find((c) => c.providerKey === key);

  function t(key: string): string {
    const en: Record<string, string> = {
      connect: "Connect",
      disconnect: "Disconnect",
      sync: "Import data and analyse",
      syncing: "Importing…",
      connected: "Connected",
      disconnected: "Not connected",
      error: "Needs attention",
      comingSoon: "Coming soon",
      readOnly: "Read-only",
      reads: "What it reads",
      doesNot: "What it never does",
      account: "Account",
      lastSync: "Last import",
      never: "Never",
      scopes: "Granted read scopes",
      configurationRequired: "Configuration required",
      planLimit: "Plan limit reached",
      credentialsNeverStored: "Credentials are encrypted on the server and never stored in your browser.",
      syncedOk: "Import complete. A deterministic analysis was run on the imported data.",
      failed: "The last attempt failed",
    };
    const arabic: Record<string, string> = {
      connect: "ربط",
      disconnect: "فصل",
      sync: "استيراد البيانات وتحليلها",
      syncing: "جارٍ الاستيراد…",
      connected: "مرتبط",
      disconnected: "غير مرتبط",
      error: "يحتاج مراجعة",
      comingSoon: "قريبًا",
      readOnly: "قراءة فقط",
      reads: "ما يقرأه",
      doesNot: "ما لا يفعله أبدًا",
      account: "الحساب",
      lastSync: "آخر استيراد",
      never: "أبدًا",
      scopes: "الصلاحيات الممنوحة للقراءة",
      configurationRequired: "يتطلب تهيئة",
      planLimit: "بلغت حد خطتك",
      credentialsNeverStored: "تُشفَّر بيانات الاعتماد على الخادم ولا تُخزَّن في متصفحك إطلاقًا.",
      syncedOk: "تم الاستيراد، وشُغِّل تحليل حتمي على البيانات المستوردة.",
      failed: "فشلت المحاولة الأخيرة",
    };
    return (ar ? arabic : en)[key] ?? key;
  }

  async function connect(providerKey: string) {
    setBusy(providerKey);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/connections", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          workspaceId: view.workspaceId,
          providerKey,
          action: "connect",
          credentials: Object.fromEntries(
            view.providers
              .find((p) => p.key === providerKey)!
              .credentialFields.map((field) => [field.name, credentials[`${providerKey}.${field.name}`] ?? ""]),
          ),
        }),
      });
      const payload = (await response.json()) as {
        error?: { message?: string };
        accountLabel?: string;
        warnings?: string[];
      };
      if (!response.ok) {
        setError(payload.error?.message ?? t("failed"));
        return;
      }
      setMessage(
        ar
          ? `تم الربط بنجاح: ${payload.accountLabel ?? ""}`
          : `Connected successfully: ${payload.accountLabel ?? ""}`,
      );
      if (payload.warnings?.length) setSyncNotes(payload.warnings);
      // Reload so the server-rendered truth replaces local assumptions.
      window.location.reload();
    } catch {
      setError(t("failed"));
    } finally {
      setBusy(null);
    }
  }

  async function disconnect(providerKey: string) {
    setBusy(providerKey);
    setError("");
    try {
      const response = await fetch("/api/connections", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ workspaceId: view.workspaceId, providerKey, action: "disconnect" }),
      });
      if (!response.ok) {
        const payload = (await response.json()) as { error?: { message?: string } };
        setError(payload.error?.message ?? t("failed"));
        return;
      }
      window.location.reload();
    } catch {
      setError(t("failed"));
    } finally {
      setBusy(null);
    }
  }

  async function sync(providerKey: string) {
    setBusy(providerKey);
    setError("");
    setMessage("");
    setSyncNotes([]);
    try {
      const response = await fetch("/api/connections/sync", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ workspaceId: view.workspaceId, providerKey, days: 30, locale }),
      });
      const payload = (await response.json()) as {
        error?: { message?: string };
        note?: string;
        findingCount?: number;
        provenance?: { notes?: string[] };
      };
      if (!response.ok) {
        setError(payload.error?.message ?? t("failed"));
        return;
      }
      setMessage(
        payload.findingCount === undefined
          ? t("syncedOk")
          : ar
            ? `${t("syncedOk")} عدد النتائج: ${payload.findingCount}.`
            : `${t("syncedOk")} Findings: ${payload.findingCount}.`,
      );
      setSyncNotes(payload.provenance?.notes ?? []);
    } catch {
      setError(t("failed"));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="settings-grid">
      <div className="settings-row" style={{ borderBottom: 0 }}>
        <span>
          {ar
            ? `الخطة تسمح بـ ${view.plan.connectedProviders ?? "غير محدود"} مصدر مرتبط`
            : `Your plan allows ${view.plan.connectedProviders ?? "unlimited"} connected provider(s)`}
        </span>
        <span>
          {view.plan.usage.connected} / {view.plan.connectedProviders ?? "∞"}
        </span>
      </div>

      {view.plan.blockedReason && (
        <div className="capability-notice" role="status">
          <AlertTriangle size={18} aria-hidden="true" />
          <div>
            <h3>{ar ? "الاشتراك مطلوب" : "A subscription is required"}</h3>
            <p>
              {ar
                ? `حالة الفوترة: ${view.plan.blockedReason}. لا يمكن ربط مزوّد قبل تفعيل خطة.`
                : `Billing status: ${view.plan.blockedReason}. A provider cannot be connected before a plan is active.`}
            </p>
          </div>
        </div>
      )}

      {error && (
        <p className="plan-error" role="alert">
          <AlertTriangle size={14} aria-hidden="true" /> {error}
        </p>
      )}
      {message && (
        <p className="muted" role="status">
          <Check size={14} aria-hidden="true" /> {message}
        </p>
      )}
      {syncNotes.length > 0 && (
        <ul className="muted" style={{ fontSize: 13, lineHeight: 1.7 }}>
          {syncNotes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      )}

      {view.providers.map((provider) => {
        const connection = connectionFor(provider.key);
        const isConnected = connection?.status === "connected";
        const isPlanned = provider.status === "planned";
        const busyHere = busy === provider.key;

        return (
          <section className="panel" key={provider.key}>
            <div className="panel-heading">
              <h2>{provider.name[locale]}</h2>
              <span className={isPlanned ? "coming-soon-tag" : "status-pill active"}>
                {isPlanned ? t("comingSoon") : t("readOnly")}
              </span>
            </div>

            <p className="muted" style={{ fontSize: 13.5, lineHeight: 1.7 }}>
              {provider.reads[locale]}
            </p>

            {connection && !isPlanned && (
              <div>
                <div className="settings-row">
                  <span>{t("account")}</span>
                  <strong dir="ltr">{connection.accountLabel ?? "—"}</strong>
                </div>
                <div className="settings-row">
                  <span>{t("lastSync")}</span>
                  <span>{formatDateTime(connection.lastSyncAt, locale)}</span>
                </div>
                {connection.scopes.length > 0 && (
                  <div className="settings-row">
                    <span>{t("scopes")}</span>
                    <span dir="ltr">{connection.scopes.join(", ")}</span>
                  </div>
                )}
                {connection.lastError && (
                  <p className="plan-error" role="alert">
                    {t("failed")}: {connection.lastError}
                  </p>
                )}
              </div>
            )}

            {provider.doesNot.length > 0 && (
              <details style={{ marginTop: 10 }}>
                <summary style={{ cursor: "pointer", fontSize: 13.5 }}>{t("doesNot")}</summary>
                <ul className="muted" style={{ fontSize: 13, lineHeight: 1.7 }}>
                  {provider.doesNot.map((item) => (
                    <li key={item[locale]}>{item[locale]}</li>
                  ))}
                </ul>
              </details>
            )}

            {isPlanned ? (
              <p className="muted" style={{ fontSize: 13, marginBottom: 0 }}>
                {ar
                  ? `غير مُنفَّذ في هذا الإصدار. يتطلب: ${provider.requiredEnv.join(", ")}`
                  : `Not implemented in this release. Requires: ${provider.requiredEnv.join(", ")}`}
              </p>
            ) : !provider.configured ? (
              <div className="capability-notice" role="status" style={{ marginTop: 12, marginBottom: 0 }}>
                <AlertTriangle size={17} aria-hidden="true" />
                <div>
                  <h3>{t("configurationRequired")}</h3>
                  <p>
                    {ar
                      ? "لا يمكن ربط هذا المزوّد قبل تهيئة المتغيرات التالية على الخادم."
                      : "This provider cannot be connected until the following server variables are configured."}
                  </p>
                  <p>
                    {provider.missingEnv.map((name) => (
                      <code key={name}>{name}</code>
                    ))}
                  </p>
                </div>
              </div>
            ) : provider.blockedBy === "plan_limit" ? (
              <p className="muted" style={{ fontSize: 13, marginBottom: 0 }}>
                {t("planLimit")}
              </p>
            ) : isConnected ? (
              <div className="form-actions">
                <button
                  className="button button-primary button-small"
                  type="button"
                  onClick={() => sync(provider.key)}
                  disabled={busyHere}
                >
                  {busyHere ? (
                    <Loader2 size={14} className="spin" aria-hidden="true" />
                  ) : (
                    <RefreshCw size={14} aria-hidden="true" />
                  )}
                  {busyHere ? t("syncing") : t("sync")}
                </button>
                <button
                  className="button button-quiet button-small"
                  type="button"
                  onClick={() => disconnect(provider.key)}
                  disabled={busyHere}
                >
                  <Unplug size={14} aria-hidden="true" /> {t("disconnect")}
                </button>
              </div>
            ) : (
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  void connect(provider.key);
                }}
                style={{ display: "grid", gap: 10, marginTop: 12 }}
              >
                {provider.credentialFields.map((field) => (
                  <div className="form-row" key={field.name}>
                    <label htmlFor={`${provider.key}-${field.name}`}>{field.label[locale]}</label>
                    <input
                      id={`${provider.key}-${field.name}`}
                      type={field.secret ? "password" : "text"}
                      autoComplete="off"
                      dir="ltr"
                      placeholder={field.placeholder}
                      value={credentials[`${provider.key}.${field.name}`] ?? ""}
                      onChange={(event) =>
                        setCredentials((previous) => ({
                          ...previous,
                          [`${provider.key}.${field.name}`]: event.target.value,
                        }))
                      }
                      required
                    />
                    <span className="muted" style={{ fontSize: 12.5, lineHeight: 1.6 }}>
                      {field.help[locale]}
                    </span>
                  </div>
                ))}
                <p className="muted" style={{ fontSize: 12.5 }}>
                  {t("credentialsNeverStored")}
                </p>
                <div className="form-actions" style={{ marginTop: 0 }}>
                  <button className="button button-primary button-small" type="submit" disabled={busyHere}>
                    {busyHere ? (
                      <Loader2 size={14} className="spin" aria-hidden="true" />
                    ) : (
                      <PlugZap size={14} aria-hidden="true" />
                    )}
                    {t("connect")}
                  </button>
                </div>
              </form>
            )}
          </section>
        );
      })}
    </div>
  );
}
