"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Activity,
  ArrowDownToLine,
  ArrowLeft,
  ArrowUpRight,
  ChartNoAxesCombined,
  Check,
  CheckCheck,
  ChevronRight,
  CircleHelp,
  Clock3,
  FileJson,
  Fingerprint,
  LayoutDashboard,
  LockKeyhole,
  Menu,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  Unplug,
  Upload,
  Wallet,
  X,
} from "lucide-react";
import { getDictionary, Locale } from "@/lib/i18n/dictionaries";
import { BusinessSnapshot, AgentInsight } from "@/lib/agent/types";
import {
  ActivityType,
  displayInsight,
  downloadJson,
  insightsFor,
  moneyFormat,
  snapshotSchema,
  STORAGE_KEY,
  Workspace,
  workspaceSchema,
} from "@/lib/workspace";
import { Brand, LanguageSwitch } from "./brand";
import { AuthNotConfiguredBanner } from "./auth-banner";
import { Modal } from "./modal";
import { SnapshotForm } from "./snapshot-form";
const sections = [
  "overview",
  "intelligence",
  "recovery",
  "reviews",
  "connections",
  "activity",
] as const;
type Section = (typeof sections)[number];
const navIcons = [
  LayoutDashboard,
  Sparkles,
  Wallet,
  ShieldCheck,
  Unplug,
  Activity,
];
const providers = ["Shopify", "Stripe", "Amazon", "Gmail"];

/**
 * A finding as the server returns it.
 *
 * `evidence` is the deterministic record and is always present. The `ai` block is separate on
 * purpose: a missing block means reasoning did not run, and the UI must say so rather than
 * rendering empty text that looks like analysis.
 */
type ServerFinding = {
  id: string;
  kind: "recovery" | "growth" | "operations" | "risk";
  severity: "low" | "medium" | "high" | "critical";
  confidence: number;
  title: string;
  summary: string;
  recommendedAction: string | null;
  estimatedImpactCents: number | null;
  requiresApproval: boolean;
  evidence: string[];
  status: string;
  ai: {
    priorityRank: number | null;
    explanation: string;
    nextSteps: string[];
    missingInformation: string[];
    provider: string | null;
    model: string | null;
  } | null;
};

/** Convert a persisted finding into the shape the dashboard already renders. */
function findingToInsight(finding: ServerFinding): AgentInsight {
  return {
    id: finding.id,
    kind: finding.kind,
    severity: finding.severity,
    title: finding.title,
    summary: finding.summary,
    confidence: finding.confidence,
    estimatedImpactCents: finding.estimatedImpactCents ?? undefined,
    evidence: finding.evidence,
    recommendedAction: finding.recommendedAction ?? "",
    requiresApproval: finding.requiresApproval,
    createdAt: new Date().toISOString(),
  };
}

export type CloudState = {
  configured: boolean;
  signedIn: boolean;
  email: string | null;
  /** Present only when the deployment has accounts and the user owns a workspace. */
  workspaceId?: string | null;
  workspaceName?: string | null;
  /** Quota state so the UI can explain *why* an action is unavailable, not just hide it. */
  plan?: {
    planId: string | null;
    billingStatus: string;
    analysesUsed: number;
    analysesLimit: number | null;
    blockedReason: string | null;
  } | null;
};
export function Dashboard({
  locale,
  cloud,
}: {
  locale: Locale;
  cloud: CloudState;
}) {
  const t = getDictionary(locale).dash;
  const cloudMode = Boolean(cloud.workspaceId);
  const [section, setSection] = useState<Section>("overview");
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [storageError, setStorageError] = useState("");
  const [notice, setNotice] = useState("");
  const [editing, setEditing] = useState(false);
  const [selected, setSelected] = useState<AgentInsight | null>(null);
  const [provider, setProvider] = useState<string | null>(null);
  const [mobile, setMobile] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  /** Findings persisted on the server, used instead of the local engine when signed in. */
  const [serverFindings, setServerFindings] = useState<AgentInsight[]>([]);
  const [serverReviewed, setServerReviewed] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const sidebarRef = useRef<HTMLElement>(null);

  /**
   * Load persisted findings when the account has a cloud workspace.
   *
   * This is the whole point of the migration away from localStorage: the same workspace must
   * open on another device with the same findings and review history.
   */
  useEffect(() => {
    if (!cloudMode || !cloud.workspaceId) return;
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch(`/api/workspace/snapshot?workspaceId=${cloud.workspaceId}`, {
          cache: "no-store",
        });
        if (!response.ok) return;
        const payload = (await response.json()) as {
          findings?: ServerFinding[];
          reviewed?: string[];
        };
        if (cancelled) return;
        setServerFindings((payload.findings ?? []).map(findingToInsight));
        setServerReviewed(payload.reviewed ?? []);
      } catch {
        /* A read failure must not blank the dashboard; the empty state explains itself. */
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [cloudMode, cloud.workspaceId]);

  useEffect(() => {
    if (!mobile) return;
    const previous = document.activeElement as HTMLElement | null;
    const sidebar = sidebarRef.current;
    const focusable = () =>
      Array.from(
        sidebar?.querySelectorAll<HTMLElement>(
          "a[href], button:not([disabled])",
        ) ?? [],
      ).filter((el) => el.getClientRects().length > 0);
    focusable()[0]?.focus();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobile(false);
      if (event.key !== "Tab") return;
      const items = focusable();
      const first = items[0];
      const last = items.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    const onResize = () => {
      if (window.innerWidth > 760) setMobile(false);
    };
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", onResize);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onResize);
      previous?.focus();
    };
  }, [mobile]);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = workspaceSchema.safeParse(JSON.parse(raw));
        if (parsed.success) setWorkspace(parsed.data);
        else setStorageError(t.corrupt);
      }
    } catch {
      setStorageError(t.storageError);
    }
    setLoaded(true);
  }, [t.corrupt, t.storageError]);
  useEffect(() => {
    const hash = window.location.hash.slice(1);
    if (sections.includes(hash as Section)) setSection(hash as Section);
    const onHash = () => {
      const value = window.location.hash.slice(1);
      if (sections.includes(value as Section)) setSection(value as Section);
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 6000);
    return () => clearTimeout(timer);
  }, [notice]);
  /**
   * Which findings are shown.
   *
   * In cloud mode the server is the source of truth (they are persisted, auditable and shared
   * across devices). Locally the deterministic engine runs in the browser as before, so the
   * product still works on a deployment with no accounts.
   */
  const insights = useMemo(() => {
    if (cloudMode) return serverFindings;
    return workspace
      ? insightsFor(workspace.snapshot).map((insight) => ({
          ...insight,
          createdAt: workspace.ranAt,
        }))
      : [];
  }, [cloudMode, serverFindings, workspace]);

  /** Review state, from wherever it actually lives. */
  const reviewedIds = cloudMode ? serverReviewed : (workspace?.reviewed ?? []);
  const open = insights.filter((i) => !reviewedIds.includes(i.id));
  const format = (cents: number) => moneyFormat(cents, locale);
  const date = (at: string) =>
    new Intl.DateTimeFormat(locale === "ar" ? "ar-SA" : "en-GB", {
      dateStyle: "medium",
      timeStyle: "short",
      calendar: "gregory",
    }).format(new Date(at));
  function persist(next: Workspace | null) {
    setWorkspace(next);
    // In cloud mode the account workspace is the store; the browser copy would be a
    // divergent second source of truth, so it is deliberately not written.
    if (cloudMode) return;
    try {
      if (next) localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      else localStorage.removeItem(STORAGE_KEY);
      setStorageError("");
    } catch {
      setStorageError(t.storageError);
    }
  }
  function go(value: Section) {
    setSection(value);
    setMobile(false);
    setQuery("");
    setFilter("all");
    window.history.replaceState(null, "", `#${value}`);
  }
  async function save(snapshot: BusinessSnapshot, imported = false) {
    const at = new Date().toISOString();

    /**
     * Cloud mode: the analysis runs on the SERVER.
     *
     * This is the architectural point of the commercial build — the browser cannot compute,
     * skip or tamper with an analysis, and plan limits are enforced where the customer cannot
     * reach them. The local engine remains the fallback when no account exists.
     */
    if (cloudMode && cloud.workspaceId) {
      setBusy(true);
      try {
        const response = await fetch("/api/analysis/run", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            workspaceId: cloud.workspaceId,
            locale,
            withAi: true,
            snapshot,
          }),
        });
        const payload = (await response.json()) as {
          findings?: ServerFinding[];
          ai?: { available: boolean; reason?: string };
          usage?: { used: number; limit: number | null };
          error?: { code: string; message: string };
        };

        if (!response.ok) {
          setNotice(payload.error?.message ?? t.storageError);
          return;
        }

        setServerFindings((payload.findings ?? []).map(findingToInsight));
        setServerReviewed([]);
        setEditing(false);
        setSelected(null);
        go("overview");

        const aiNote = payload.ai?.available ? "" : ` ${payload.ai?.reason ?? ""}`.trim();
        const usage =
          payload.usage?.limit === null || payload.usage?.limit === undefined
            ? ""
            : ` (${payload.usage.used}/${payload.usage.limit})`;
        setNotice(`${imported ? t.imported : t.saved}${usage}${aiNote ? ` — ${aiNote}` : ""}`);
      } catch {
        setNotice(t.storageError);
      } finally {
        setBusy(false);
      }
      return;
    }

    persist({
      snapshot,
      reviewed: [],
      ranAt: at,
      activity: [
        { id: crypto.randomUUID(), type: "analyzed" as const, at },
        ...(workspace?.activity ?? []),
      ].slice(0, 100),
    });
    setEditing(false);
    setSelected(null);
    go("overview");
    setNotice(imported ? t.imported : t.saved);
  }
  async function importFile(file?: File) {
    if (!file) return;
    try {
      if (file.size > 100 * 1024) throw Error("size");
      const data = JSON.parse(await file.text());
      const parsed = snapshotSchema.safeParse(data.snapshot ?? data);
      if (!parsed.success) throw Error("schema");
      await save(parsed.data, true);
    } catch {
      setNotice(t.importError);
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  }
  /**
   * Record a review decision.
   *
   * Cloud mode posts to the server so the approval state machine and its audit trail are
   * authoritative, and the decision survives a device change. Local mode keeps the original
   * browser-only behaviour.
   */
  async function toggleReview(insight: AgentInsight) {
    const exists = reviewedIds.includes(insight.id);

    if (cloudMode && cloud.workspaceId) {
      setBusy(true);
      try {
        const response = await fetch("/api/findings/decide", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            workspaceId: cloud.workspaceId,
            findingId: insight.id,
            decision: exists ? "reopened" : "reviewed",
          }),
        });
        const payload = (await response.json()) as {
          status?: string;
          executed?: boolean;
          executionNote?: string;
          error?: { message: string };
        };
        if (!response.ok) {
          setNotice(payload.error?.message ?? t.storageError);
          return;
        }
        setServerReviewed((previous) =>
          exists ? previous.filter((id) => id !== insight.id) : [...previous, insight.id],
        );
        setSelected(null);
        // The API reports honestly whether anything was executed. It never is, today.
        setNotice(payload.executionNote ?? t[exists ? "reopened" : "reviewEvent"]);
      } catch {
        setNotice(t.storageError);
      } finally {
        setBusy(false);
      }
      return;
    }

    if (!workspace) return;
    const type: ActivityType = exists ? "reopened" : "reviewEvent";
    persist({
      ...workspace,
      reviewed: exists
        ? workspace.reviewed.filter((id) => id !== insight.id)
        : [...workspace.reviewed, insight.id],
      activity: [
        { id: crypto.randomUUID(), type, at: new Date().toISOString() },
        ...workspace.activity,
      ].slice(0, 100),
    });
    setSelected(null);
    setNotice(t[type]);
  }
  function template() {
    downloadJson(
      {
        workspaceId: "My business",
        revenueCents: 0,
        previousRevenueCents: 0,
        refundPendingCents: 0,
        duplicateChargeCandidates: [],
      },
      "ghostops-snapshot-template.json",
    );
  }
  const list = insights.filter(
    (i) =>
      (section !== "recovery" || i.kind === "recovery") &&
      (section !== "reviews" || i.requiresApproval) &&
      (filter === "all" ||
        (filter === "high"
          ? i.severity === "high" || i.severity === "critical"
          : i.severity === filter)) &&
      (!query ||
        (workspace &&
          Object.values(displayInsight(i, workspace.snapshot, t, locale))
            .flat()
            .join(" ")
            .toLocaleLowerCase()
            .includes(query.toLocaleLowerCase()))),
  );
  const currentTitle = t.titles[sections.indexOf(section)];
  const delta =
    workspace && workspace.snapshot.previousRevenueCents > 0
      ? (workspace.snapshot.revenueCents -
          workspace.snapshot.previousRevenueCents) /
        workspace.snapshot.previousRevenueCents
      : null;
  const metrics = [
    delta === null
      ? "—"
      : new Intl.NumberFormat(locale, {
          style: "percent",
          maximumFractionDigits: 1,
          signDisplay: "exceptZero",
        }).format(delta),
    workspace ? format(workspace.snapshot.refundPendingCents) : "—",
    workspace ? String(insights.length) : "—",
    workspace ? String(open.filter((i) => i.requiresApproval).length) : "—",
  ];
  const selectedText =
    selected && workspace
      ? displayInsight(selected, workspace.snapshot, t, locale)
      : null;
  function insightCard(insight: AgentInsight) {
    if (!workspace) return null;
    const text = displayInsight(insight, workspace.snapshot, t, locale);
    const checked = reviewedIds.includes(insight.id);
    return (
      <button
        className="insight-card"
        key={insight.id}
        onClick={() => setSelected(insight)}
      >
        <div className={`insight-icon ${insight.kind}`}>
          {insight.kind === "recovery" ? (
            <Wallet size={19} />
          ) : insight.kind === "growth" ? (
            <ChartNoAxesCombined size={19} />
          ) : (
            <Activity size={19} />
          )}
        </div>
        <div className="insight-body">
          <div className="insight-meta">
            <span>{t.kind[insight.kind]}</span>
            <span className={`severity ${insight.severity}`}>
              {t.severity[insight.severity]}
            </span>
            {checked && (
              <span className="reviewed">
                <Check size={12} />
                {t.reviewed}
              </span>
            )}
          </div>
          <h3>{text.title}</h3>
          <p>{text.summary}</p>
        </div>
        <ChevronRight className="direction-chevron" size={18} />
      </button>
    );
  }
  return (
    <div className="dashboard-shell">
      <a className="skip-link" href="#dashboard-main">
        {locale === "ar" ? "انتقل إلى المحتوى" : "Skip to content"}
      </a>
      {mobile && (
        <button
          aria-label={t.close}
          className="sidebar-backdrop"
          onClick={() => setMobile(false)}
        />
      )}
      <aside
        ref={sidebarRef}
        role={mobile ? "dialog" : undefined}
        aria-modal={mobile || undefined}
        aria-label={
          locale === "ar" ? "قائمة مركز القيادة" : "Command center menu"
        }
        className={`sidebar ${mobile ? "sidebar-open" : ""}`}
      >
        <div className="sidebar-brand">
          <Brand locale={locale} />
          <button
            className="icon-button mobile-close"
            aria-label={t.close}
            onClick={() => setMobile(false)}
          >
            <X size={19} />
          </button>
        </div>
        <div className="workspace-switch">
          <span className="workspace-symbol">W</span>
          <div>
            <strong>{workspace?.snapshot.workspaceId || t.workspace}</strong>
            <small>{t.local}</small>
          </div>
          <LockKeyhole size={13} />
        </div>
        <nav
          aria-label={
            locale === "ar" ? "أقسام مركز القيادة" : "Command center sections"
          }
        >
          {sections.map((value, i) => {
            const Icon = navIcons[i];
            return (
              <button
                key={value}
                className={`sidebar-link ${section === value ? "active" : ""}`}
                aria-current={section === value ? "page" : undefined}
                onClick={() => go(value)}
              >
                <Icon size={18} />
                <span>{t.nav[i]}</span>
                {value === "reviews" &&
                  open.filter((v) => v.requiresApproval).length > 0 && (
                    <span className="count">
                      {open.filter((v) => v.requiresApproval).length}
                    </span>
                  )}
              </button>
            );
          })}
        </nav>
        <div className="sidebar-bottom">
          <div className="local-card">
            <Fingerprint size={21} />
            <strong>{t.local}</strong>
            <p>{t.localDetail}</p>
          </div>
          <nav className="dash-nav" aria-label={locale === "ar" ? "إعدادات الحساب" : "Account"}>
            <Link href={`/${locale}/connections`} className="sidebar-home">
              <Unplug size={16} aria-hidden="true" />
              {locale === "ar" ? "ربط المصادر" : "Connect providers"}
            </Link>
            <Link href={`/${locale}/settings`} className="sidebar-home">
              <ShieldCheck size={16} aria-hidden="true" />
              {locale === "ar" ? "إعدادات الحساب" : "Account settings"}
            </Link>
          </nav>
          <Link href={`/${locale}`} className="sidebar-home">
            <ArrowLeft size={16} className="direction-chevron" />
            {t.home}
          </Link>
        </div>
      </aside>
      <div className="workspace-main" inert={mobile}>
        <header className="dash-header">
          <div className="breadcrumb">
            <button
              className="icon-button mobile-menu"
              onClick={() => setMobile(true)}
              aria-label={locale === "ar" ? "فتح القائمة" : "Open menu"}
              aria-expanded={mobile}
            >
              <Menu size={20} />
            </button>
            <span>GhostOps</span>
            <span>/</span>
            <strong>{currentTitle}</strong>
          </div>
          <div className="dash-header-right">
            <span className="local-indicator">
              <span className="status-dot" />
              {t.local}
            </span>
            <LanguageSwitch locale={locale} dashboard />
            <Link
              href={`/${locale}/settings`}
              className="user-avatar"
              aria-label={locale === "ar" ? "إعدادات الحساب" : "Account settings"}
            >
              G
            </Link>
          </div>
        </header>
        <main className="dashboard-content" id="dashboard-main">
          {!cloud.configured && <AuthNotConfiguredBanner locale={locale} />}
          <div
            role="status"
            aria-live="polite"
            className={notice ? "toast" : ""}
          >
            {notice}
          </div>
          {storageError && (
            <p role="alert" className="error-message">
              {storageError}
            </p>
          )}
          <div className="dash-title-row">
            <div>
              <div className="eyebrow">{currentTitle}</div>
              <h1>
                {section === "overview"
                  ? t.title
                  : section === "connections"
                    ? t.connectionsTitle
                    : section === "activity"
                      ? t.activityTitle
                      : currentTitle}
              </h1>
              <p>
                {section === "connections"
                  ? t.connectionsCopy
                  : section === "activity"
                    ? t.activityCopy
                    : t.subtitle}
              </p>
            </div>
            <div className="dash-actions">
              <input
                ref={fileRef}
                className="visually-hidden"
                type="file"
                accept=".json,application/json"
                aria-label={t.import}
                onChange={(e) => void importFile(e.target.files?.[0])}
              />
              <button
                disabled={!loaded}
                className="button button-outline button-small"
                onClick={() => fileRef.current?.click()}
              >
                <Upload size={15} />
                {t.import}
              </button>
              <button
                disabled={!loaded}
                className="button button-primary button-small"
                onClick={() => setEditing(true)}
              >
                <Plus size={16} />
                {workspace ? t.edit : t.add}
              </button>
            </div>
          </div>
          {!loaded ? (
            <div className="loading-workspace" aria-busy="true">
              <span className="skeleton" />
              <span className="skeleton" />
              <span className="skeleton" />
            </div>
          ) : (
            <>
              {section === "overview" && (
                <>
                  <div className="metric-grid">
                    {metrics.map((value, i) => {
                      const Icon = [
                        ChartNoAxesCombined,
                        Wallet,
                        Sparkles,
                        ShieldCheck,
                      ][i];
                      return (
                        <article key={i} className="metric-card">
                          <div>
                            <span>{t.metric[i]}</span>
                            <Icon size={17} />
                          </div>
                          <strong
                            className={
                              i === 0 && delta !== null && delta < 0
                                ? "negative"
                                : ""
                            }
                            dir="auto"
                          >
                            {value}
                          </strong>
                          <small>
                            {i === 1
                              ? t.snapshot
                              : i === 3
                                ? t.unreviewed
                                : t.local}
                          </small>
                        </article>
                      );
                    })}
                  </div>
                  <div className="overview-columns">
                    <div className="panel intelligence-panel">
                      <div className="panel-heading">
                        <h2>
                          <Sparkles size={18} />
                          {t.priority}
                        </h2>
                        {workspace && (
                          <button
                            className="text-button"
                            onClick={() => go("intelligence")}
                          >
                            {t.viewAll}
                            <ArrowUpRight size={14} />
                          </button>
                        )}
                      </div>
                      {!workspace ? (
                        <div className="empty-state">
                          <div className="empty-mascot">
                            <Image
                              src="/brand/ghostops-mascot.png"
                              width={210}
                              height={210}
                              alt="GhostOps"
                              priority
                            />
                          </div>
                          <h2>{t.emptyTitle}</h2>
                          <p>{t.emptyCopy}</p>
                          <button
                            className="button button-primary button-small"
                            onClick={() => setEditing(true)}
                          >
                            <Plus size={16} />
                            {t.add}
                          </button>
                          <button
                            className="text-button template-link"
                            onClick={template}
                          >
                            <FileJson size={14} />
                            {t.template}
                          </button>
                        </div>
                      ) : insights.length ? (
                        insights.slice(0, 4).map(insightCard)
                      ) : (
                        <div className="no-results">
                          <CheckCheck size={32} />
                          <h3>{t.none}</h3>
                          <p>{t.noneCopy}</p>
                        </div>
                      )}
                    </div>
                    <div className="overview-aside">
                      <article className="next-move">
                        <div className="next-move-top">
                          <span className="signal-icon purple">
                            <Sparkles size={20} />
                          </span>
                          <span>
                            {locale === "ar"
                              ? "رؤى GHOSTOPS"
                              : "GHOSTOPS INTELLIGENCE"}
                          </span>
                        </div>
                        <h2>{t.panelTitle}</h2>
                        <p>{t.panelCopy}</p>
                        <div className="mini-wave" aria-hidden="true">
                          <i />
                          <i />
                          <i />
                          <i />
                          <i />
                          <i />
                          <i />
                        </div>
                        <button
                          className="text-button"
                          onClick={() => setEditing(true)}
                        >
                          {t.edit}
                          <ArrowUpRight size={16} />
                        </button>
                      </article>
                      <article className="panel workspace-status">
                        <h3>{t.status}</h3>
                        <p>
                          <span
                            className={`status-dot ${!workspace ? "idle" : ""}`}
                          />
                          {workspace ? t.ready : t.waiting}
                        </p>
                        <div>
                          <span>{t.last}</span>
                          <small>
                            {workspace ? date(workspace.ranAt) : t.unknownTime}
                          </small>
                        </div>
                        <p className="small muted">{t.privacy}</p>
                      </article>
                    </div>
                  </div>
                </>
              )}
              {["intelligence", "recovery", "reviews"].includes(section) && (
                <section className="panel">
                  <div className="filter-bar">
                    <label className="search">
                      <Search size={17} />
                      <input
                        placeholder={t.search}
                        aria-label={t.search}
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                      />
                    </label>
                    <select
                      aria-label={t.all}
                      value={filter}
                      onChange={(e) => setFilter(e.target.value)}
                    >
                      <option value="all">{t.all}</option>
                      <option value="high">{t.high}</option>
                      <option value="medium">{t.medium}</option>
                    </select>
                  </div>
                  {list.length ? (
                    list.map(insightCard)
                  ) : (
                    <div className="no-results">
                      <ScanEmpty />
                      <h2>{workspace ? t.none : t.emptyTitle}</h2>
                      <p>{workspace ? t.noneCopy : t.emptyCopy}</p>
                      {!workspace && (
                        <button
                          className="button button-primary button-small"
                          onClick={() => setEditing(true)}
                        >
                          {t.add}
                        </button>
                      )}
                    </div>
                  )}
                </section>
              )}
              {section === "connections" && (
                <>
                  <div className="connection-grid">
                    {providers.map((name, i) => (
                      <article className="panel connection-card" key={name}>
                        <div className="connection-top">
                          <span className={`provider-icon provider-${i}`}>
                            {name[0]}
                          </span>
                          <span className="neutral-tag">{t.notConnected}</span>
                        </div>
                        <h2>{name}</h2>
                        <p>{t.providerDescriptions[i]}</p>
                        <button
                          className="button button-outline button-small"
                          onClick={() => setProvider(name)}
                        >
                          {t.setup}
                          <ArrowUpRight size={15} />
                        </button>
                      </article>
                    ))}
                  </div>
                  <p className="privacy-note">
                    <LockKeyhole size={16} />
                    {t.connectionPrivacy}
                  </p>
                </>
              )}
              {section === "activity" && (
                <section className="panel activity-panel">
                  {workspace?.activity.length ? (
                    workspace.activity.map((event) => (
                      <article className="activity-row" key={event.id}>
                        <span className="activity-symbol">
                          {event.type === "analyzed" ? (
                            <Sparkles size={17} />
                          ) : (
                            <Check size={17} />
                          )}
                        </span>
                        <div>
                          <h3>{t[event.type]}</h3>
                          <p>{t.local}</p>
                        </div>
                        <time dateTime={event.at}>{date(event.at)}</time>
                      </article>
                    ))
                  ) : (
                    <div className="no-results">
                      <Clock3 size={35} />
                      <h2>{t.noActivity}</h2>
                    </div>
                  )}
                </section>
              )}
              <div className="workspace-footer">
                <span>
                  <LockKeyhole size={13} />
                  {t.privacy}
                </span>
                {workspace && (
                  <div>
                    <button
                      className="text-button"
                      onClick={() =>
                        downloadJson(
                          {
                            version: 1,
                            currency: "SAR",
                            ...workspace,
                            insights,
                          },
                          "ghostops-report.json",
                        )
                      }
                    >
                      <ArrowDownToLine size={14} />
                      {t.export}
                    </button>
                    <button
                      className="text-button danger"
                      onClick={() => {
                        if (window.confirm(t.resetConfirm)) {
                          persist(null);
                          setSelected(null);
                          setNotice("");
                        }
                      }}
                    >
                      {t.reset}
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </main>
      </div>
      {editing && (
        <Modal
          title={t.dataTitle}
          closeLabel={t.close}
          onClose={() => setEditing(false)}
        >
          <SnapshotForm
            locale={locale}
            initial={workspace?.snapshot}
            onSave={(snapshot) => void save(snapshot)}
            onCancel={() => setEditing(false)}
            busy={busy}
          />
          <div className="import-tip">
            <FileJson size={17} />
            <p>
              {t.importHelp}
              <button className="text-button" onClick={template}>
                {t.template}
              </button>
            </p>
          </div>
        </Modal>
      )}
      {selected && selectedText && (
        <Modal
          title={selectedText.title}
          closeLabel={t.close}
          onClose={() => setSelected(null)}
        >
          <div className="insight-detail">
            <div className="insight-meta">
              <span>{t.kind[selected.kind]}</span>
              <span className={`severity ${selected.severity}`}>
                {t.severity[selected.severity]}
              </span>
            </div>
            <p>{selectedText.summary}</p>
            <h3>{t.evidence}</h3>
            <ul className="evidence-list">
              {selectedText.evidence.map((line, i) => (
                <li key={i}>
                  <Check size={15} />
                  <bdi>{line}</bdi>
                </li>
              ))}
            </ul>
            <div className="recommendation">
              <h3>
                <Sparkles size={17} />
                {t.nextStep}
              </h3>
              <p>{selectedText.action}</p>
            </div>
            <p className="small muted">{t.decisionNote}</p>
            <button
              className="button button-primary"
              onClick={() => toggleReview(selected)}
            >
              <Check size={17} />
              {reviewedIds.includes(selected.id) ? t.unmark : t.mark}
            </button>
          </div>
        </Modal>
      )}
      {provider && (
        <Modal
          title={`${provider} · ${t.planned}`}
          closeLabel={t.close}
          onClose={() => setProvider(null)}
        >
          <div className="insight-detail">
            <Unplug size={34} className="cyan" />
            <p>{t.integrationDetail}</p>
            <p className="muted">{t.connectionPrivacy}</p>
            <button
              className="button button-outline"
              onClick={() => setProvider(null)}
            >
              {t.close}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
function ScanEmpty() {
  return <CircleHelp size={32} />;
}
