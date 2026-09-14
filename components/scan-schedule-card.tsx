"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, CalendarClock, Loader2 } from "lucide-react";
import type { Locale } from "@/lib/locale";
import { formatDateTime } from "@/lib/pricing-format";

type ScheduleJob = {
  id: string;
  enabled: boolean;
  cadence: "daily" | "weekly";
  nextRunAt: string | null;
  lastRunAt: string | null;
  lastStatus: string | null;
};

/**
 * Scan schedule control.
 *
 * Honesty rules:
 *  - if the deployment has no scheduler secret, the control is REFUSED rather than silently
 *    saving a preference that can never fire — the customer is told exactly what is missing;
 *  - enabling without a connected provider is blocked by the API and explained in the UI, so
 *    nobody ends up with a green switch attached to a job that skips forever;
 *  - `lastStatus` is shown verbatim, including failures.
 */
export function ScanScheduleCard({
  locale,
  workspaceId,
  scheduledScansAvailable,
}: {
  locale: Locale;
  workspaceId: string;
  scheduledScansAvailable: boolean;
}) {
  const ar = locale === "ar";
  const [job, setJob] = useState<ScheduleJob | null>(null);
  const [provider, setProvider] = useState<string | null>(null);
  const [schedulerReady, setSchedulerReady] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [cadence, setCadence] = useState<"daily" | "weekly">("daily");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch(`/api/workspace/scan-schedule?workspaceId=${workspaceId}`, {
          cache: "no-store",
        });
        if (!response.ok) return;
        const payload = (await response.json()) as {
          job: ScheduleJob | null;
          connectedProvider: string | null;
          schedulerConfigured: boolean;
        };
        if (cancelled) return;
        setJob(payload.job);
        setProvider(payload.connectedProvider);
        setSchedulerReady(payload.schedulerConfigured);
        if (payload.job?.cadence) setCadence(payload.job.cadence);
      } catch {
        /* a read failure leaves the card in its loading-free empty state */
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

  async function apply(enabled: boolean) {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/workspace/scan-schedule", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ workspaceId, enabled, cadence }),
      });
      const payload = (await response.json()) as {
        job?: ScheduleJob | null;
        error?: { message: string };
      };
      if (!response.ok) {
        setError(payload.error?.message ?? (ar ? "تعذّر حفظ الجدولة." : "The schedule could not be saved."));
        return;
      }
      setJob(payload.job ?? null);
    } catch {
      setError(ar ? "تعذّر حفظ الجدولة." : "The schedule could not be saved.");
    } finally {
      setBusy(false);
    }
  }

  const labels = ar
    ? {
        title: "الفحوصات المجدولة",
        subtitle: "دع GhostOps يفحص مصدرك تلقائيًا ويكتب النتائج بدون أن تفتح اللوحة.",
        daily: "يوميًا",
        weekly: "أسبوعيًا",
        enable: "تفعيل",
        disable: "إيقاف",
        next: "الفحص القادم",
        last: "آخر فحص",
        status: "آخر حالة",
        never: "لم يُشغَّل بعد",
        noProvider: "اربط مصدرًا أولًا — الفحص المجدول يحتاج مصدرًا ليقرأه.",
        notReady:
          "المجدول غير مُهيَّأ على هذه النسخة (AGENT_RUN_SECRET). لن يعمل أي فحص تلقائي حتى يُضبط.",
        notImplemented:
          "الفحوصات المجدولة على خطة التطوير وغير مُنفَّذة بعد: لا يوجد مجدول يعمل. البوت لا يراقب بشكل مستمر اليوم.",
      }
    : {
        title: "Scheduled scans",
        subtitle: "Let GhostOps read your source automatically and record the findings without you opening the dashboard.",
        daily: "Daily",
        weekly: "Weekly",
        enable: "Enable",
        disable: "Disable",
        next: "Next scan",
        last: "Last scan",
        status: "Last status",
        never: "Never run yet",
        noProvider: "Connect a provider first — a scheduled scan needs a source to read.",
        notReady:
          "No scheduler is configured on this deployment (AGENT_RUN_SECRET). No automatic scan will fire until it is set.",
        notImplemented:
          "Scheduled scans are on the roadmap and not implemented: no scheduler is running. GhostOps does not monitor continuously today.",
      };

  return (
    <section className="panel">
      <div className="panel-heading">
        <h2>
          <CalendarClock size={15} aria-hidden="true" /> {labels.title}
        </h2>
      </div>

      {/* The feature flag is the single source of truth about availability. */}
      {!scheduledScansAvailable ? (
        <p className="muted" style={{ fontSize: 13, lineHeight: 1.7 }}>
          {labels.notImplemented}
        </p>
      ) : (
        <>
          <p className="muted" style={{ fontSize: 13, lineHeight: 1.7 }}>
            {labels.subtitle}
          </p>

          {!schedulerReady && (
            <div className="capability-notice" role="status" style={{ marginTop: 12 }}>
              <AlertTriangle size={17} aria-hidden="true" />
              <div>
                <h3>{ar ? "المجدول غير مُهيَّأ" : "Scheduler not configured"}</h3>
                <p>{labels.notReady}</p>
              </div>
            </div>
          )}

          <div className="settings-row">
            <span>{ar ? "التكرار" : "Cadence"}</span>
            <select
              value={cadence}
              onChange={(event) => setCadence(event.target.value as "daily" | "weekly")}
              aria-label={ar ? "التكرار" : "Cadence"}
              disabled={busy}
            >
              <option value="daily">{labels.daily}</option>
              <option value="weekly">{labels.weekly}</option>
            </select>
          </div>

          {job && (
            <>
              <div className="settings-row">
                <span>{labels.next}</span>
                <span>{job.nextRunAt ? formatDateTime(job.nextRunAt, locale) : "—"}</span>
              </div>
              <div className="settings-row">
                <span>{labels.last}</span>
                <span>{job.lastRunAt ? formatDateTime(job.lastRunAt, locale) : labels.never}</span>
              </div>
              {job.lastStatus && (
                <div className="settings-row">
                  <span>{labels.status}</span>
                  <span className={`status-pill ${job.lastStatus.startsWith("completed") ? "active" : "past_due"}`}>
                    {job.lastStatus}
                  </span>
                </div>
              )}
            </>
          )}

          {!provider && loaded && (
            <p className="plan-error" role="status" style={{ marginTop: 10 }}>
              <AlertTriangle size={14} aria-hidden="true" /> {labels.noProvider}
            </p>
          )}

          <div className="form-actions">
            {job?.enabled ? (
              <button
                className="button button-quiet button-small"
                type="button"
                onClick={() => apply(false)}
                disabled={busy}
              >
                {busy && <Loader2 size={14} className="spin" aria-hidden="true" />}
                {labels.disable}
              </button>
            ) : (
              <button
                className="button button-outline button-small"
                type="button"
                onClick={() => apply(true)}
                disabled={busy || !provider || !schedulerReady}
              >
                {busy && <Loader2 size={14} className="spin" aria-hidden="true" />}
                {labels.enable}
              </button>
            )}
          </div>

          {error && (
            <p className="plan-error" role="alert">
              {error}
            </p>
          )}
        </>
      )}
    </section>
  );
}
