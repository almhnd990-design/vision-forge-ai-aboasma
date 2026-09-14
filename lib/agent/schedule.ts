import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { WorkspaceRow, ScheduledScanJobRow, ProviderKey } from "@/lib/db/types";
import { entitlementState, analysesUsedThisPeriod, checkAnalysisQuota } from "@/lib/db/access";
import { syncProvider } from "@/lib/connectors/service";
import { isBillingConfigured } from "@/lib/config";

/** Local helper: the commercial project has no shared util module for this. */
const nowIso = () => new Date().toISOString();

/**
 * Scheduled scans.
 *
 * This is the piece that turns "you must open the dashboard and press a button" into an
 * operator that works while nobody is watching. It is deliberately conservative:
 *
 *  - nothing runs unless a job is EXPLICITLY enabled for the workspace;
 *  - a job is due only when `next_run_at` has passed;
 *  - the plan's monthly analysis quota is checked before anything is fetched, so a scheduler
 *    cannot burn a customer's allowance;
 *  - the AI layer is NOT invoked on a schedule (cost control); reasoning stays a deliberate
 *    user action;
 *  - every run writes an audit event and updates `last_status`, so a silent failure is
 *    visible rather than invisible.
 */

export type DueJob = {
  job: ScheduledScanJobRow;
  workspace: WorkspaceRow;
};

export function cadenceToMs(cadence: "daily" | "weekly"): number {
  return cadence === "daily" ? 86_400_000 : 7 * 86_400_000;
}

export function nextRunFrom(cadence: "daily" | "weekly", from = new Date()): string {
  return new Date(from.getTime() + cadenceToMs(cadence)).toISOString();
}

/**
 * Which jobs are due right now.
 *
 * `admin` is the service-role client because a scheduler has no user session; that is safe
 * here because the job table itself decides what work exists, and RLS still governs what a
 * customer can see.
 */
export async function findDueJobs(
  admin: SupabaseClient,
  { limit = 25, now = new Date() }: { limit?: number; now?: Date } = {},
): Promise<DueJob[]> {
  const { data, error } = await admin
    .from("scheduled_scan_jobs")
    .select("*")
    .eq("enabled", true)
    .not("next_run_at", "is", null)
    .lte("next_run_at", now.toISOString())
    .order("next_run_at", { ascending: true })
    .limit(limit);

  if (error || !data) return [];

  const jobs = data as ScheduledScanJobRow[];
  if (jobs.length === 0) return [];

  const workspaceIds = [...new Set(jobs.map((job) => job.workspace_id))];
  const { data: workspaces } = await admin
    .from("workspaces")
    .select("*")
    .in("id", workspaceIds);
  const byId = new Map(((workspaces ?? []) as WorkspaceRow[]).map((w) => [w.id, w]));

  return jobs
    .map((job) => ({ job, workspace: byId.get(job.workspace_id) }))
    .filter((entry): entry is DueJob => Boolean(entry.workspace));
}

export type ScanOutcome = {
  jobId: string;
  workspaceId: string;
  status: "completed" | "skipped" | "failed";
  reason?: string;
  providerKey?: ProviderKey;
  findingCount?: number;
};

/**
 * Execute one due job.
 *
 * A workspace with no connected provider is SKIPPED with an explanation rather than being
 * marked failed: there is simply nothing to read yet, and saying so is more useful than a red
 * status the customer cannot act on.
 */
export async function runScheduledJob(
  admin: SupabaseClient,
  { job, workspace }: DueJob,
): Promise<ScanOutcome> {
  const base = { jobId: job.id, workspaceId: workspace.id };

  // Plan gate first: never spend a customer's quota on a background run by surprise.
  const state = entitlementState(workspace);
  if (isBillingConfigured() && !state.planId) {
    await mark(admin, job, "skipped", "no active plan");
    return { ...base, status: "skipped", reason: "no active plan" };
  }

  const { data: connections } = await admin
    .from("connections")
    .select("provider_key, status")
    .eq("workspace_id", workspace.id)
    .eq("status", "connected")
    .limit(1);

  const provider = (connections ?? [])[0] as { provider_key: ProviderKey } | undefined;
  if (!provider) {
    await mark(admin, job, "skipped", "no connected provider");
    return { ...base, status: "skipped", reason: "no connected provider" };
  }

  const used = await analysesUsedThisPeriod(admin, workspace.id);
  const quota = checkAnalysisQuota(state, used);
  if (!quota.allowed) {
    await mark(admin, job, "skipped", "analysis quota reached");
    return { ...base, status: "skipped", reason: "analysis quota reached" };
  }

  const sync = await syncProvider(admin, {
    workspace: workspace,
    userId: workspace.owner_id,
    providerKey: provider.provider_key,
    days: 30,
  });

  if (!sync.ok) {
    await mark(admin, job, "failed", `${sync.code}: ${sync.message}`);
    await admin.from("audit_events").insert({
      workspace_id: workspace.id,
      actor_type: "system",
      action: "scan.failed",
      target_type: "scheduled_scan_job",
      target_id: job.id,
      metadata: { provider: provider.provider_key, code: sync.code, message: sync.message },
    });
    return { ...base, status: "failed", reason: sync.message, providerKey: provider.provider_key };
  }

  // The deterministic engine runs on the imported snapshot. No AI on a schedule.
  const { runAnalysis } = await import("@/lib/agent/service");
  const analysis = await runAnalysis(admin, {
    workspace,
    userId: workspace.owner_id,
    snapshotId: sync.snapshotId,
    withAi: false,
  });

  if (!analysis.ok) {
    await mark(admin, job, "failed", analysis.message);
    return { ...base, status: "failed", reason: analysis.message, providerKey: provider.provider_key };
  }

  await mark(admin, job, "completed", null);

  await admin.from("audit_events").insert({
    workspace_id: workspace.id,
    actor_type: "system",
    action: "scan.completed",
    target_type: "scheduled_scan_job",
    target_id: job.id,
    metadata: {
      provider: provider.provider_key,
      snapshot_id: sync.snapshotId,
      analysis_id: analysis.analysisId,
      finding_count: analysis.findings.length,
      cadence: job.cadence,
    },
  });

  return {
    ...base,
    status: "completed",
    providerKey: provider.provider_key,
    findingCount: analysis.findings.length,
  };
}

async function mark(
  admin: SupabaseClient,
  job: ScheduledScanJobRow,
  status: string,
  note: string | null,
): Promise<void> {
  await admin
    .from("scheduled_scan_jobs")
    .update({
      last_run_at: nowIso(),
      last_status: note ? `${status}: ${note}` : status,
      // Always advance the schedule, otherwise a failing job would be retried every minute.
      next_run_at: nextRunFrom(job.cadence),
      updated_at: nowIso(),
    })
    .eq("id", job.id);
}

/** Create or update the single scan job for a workspace. */
export async function upsertScanSettings(
  admin: SupabaseClient,
  input: {
    workspaceId: string;
    enabled: boolean;
    cadence: "daily" | "weekly";
  },
): Promise<{ ok: boolean; message?: string; job?: ScheduledScanJobRow }> {
  const { data: existing } = await admin
    .from("scheduled_scan_jobs")
    .select("*")
    .eq("workspace_id", input.workspaceId)
    .limit(1)
    .maybeSingle<ScheduledScanJobRow>();

  const nextRunAt = input.enabled
    ? existing?.next_run_at && Date.parse(existing.next_run_at) > Date.now()
      ? existing.next_run_at
      : nextRunFrom(input.cadence)
    : null;

  if (existing) {
    const { data, error } = await admin
      .from("scheduled_scan_jobs")
      .update({
        enabled: input.enabled,
        cadence: input.cadence,
        next_run_at: nextRunAt,
        updated_at: nowIso(),
      })
      .eq("id", existing.id)
      .select("*")
      .single<ScheduledScanJobRow>();
    if (error) return { ok: false, message: error.message };
    return { ok: true, job: data };
  }

  const { data, error } = await admin
    .from("scheduled_scan_jobs")
    .insert({
      workspace_id: input.workspaceId,
      cadence: input.cadence,
      enabled: input.enabled,
      next_run_at: nextRunAt,
    })
    .select("*")
    .single<ScheduledScanJobRow>();
  if (error) return { ok: false, message: error.message };
  return { ok: true, job: data };
}
