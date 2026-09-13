import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { AgentInsight, BusinessSnapshot } from "@/lib/agent/types";
import type { FindingRow, SnapshotRow, WorkspaceRow, FindingStatus } from "@/lib/db/types";
import {
  analysesUsedThisPeriod,
  checkAnalysisQuota,
  entitlementState,
  hasFeature,
} from "@/lib/db/access";
import { INSIGHT_LIMITS, snapshotSchema } from "@/lib/workspace";
import { reasonAboutFindings, type AiResult } from "@/lib/ai/reason";
import { runDeterministicEngine } from "@/lib/agent/engine";

export const ENGINE_VERSION = "ghostops-deterministic-1.0.0";

export type AnalysisOutcome =
  | {
      ok: true;
      analysisId: string;
      snapshotId: string;
      findings: FindingRow[];
      ai: AiResult;
      used: number;
      limit: number | null;
    }
  | { ok: false; code: string; message: string; requiredEnv?: string[] };

function rowFromInsight(
  insight: AgentInsight,
  workspaceId: string,
  analysisId: string,
): Record<string, unknown> {
  return {
    workspace_id: workspaceId,
    analysis_id: analysisId,
    kind: insight.kind,
    severity: insight.severity,
    confidence: insight.confidence,
    title: insight.title,
    summary: insight.summary,
    recommended_action: insight.recommendedAction,
    estimated_impact_cents: insight.estimatedImpactCents ?? null,
    requires_approval: insight.requiresApproval,
    evidence: insight.evidence,
    status: "detected",
  };
}

/**
 * Run the deterministic engine and persist everything.
 *
 * Guarantees:
 *  - the engine runs on the SERVER, so the browser cannot alter or skip it;
 *  - quota is enforced here before any work happens;
 *  - only deterministic evidence is written to `evidence`. AI output is stored in
 *    separate columns and can never overwrite it;
 *  - a snapshot is stored even when the engine finds nothing, so the account has a
 *    truthful history.
 */
export async function runAnalysis(
  admin: SupabaseClient,
  input: {
    workspace: WorkspaceRow;
    userId: string;
    /** Either provide a snapshot to validate and store, or an existing snapshot id. */
    snapshot?: unknown;
    snapshotId?: string;
    locale?: "en" | "ar";
    withAi?: boolean;
  },
): Promise<AnalysisOutcome> {
  const state = entitlementState(input.workspace);
  if (!hasFeature(state, "deterministic_analysis")) {
    return {
      ok: false,
      code: "no_plan",
      message: "An active subscription is required to run an analysis.",
    };
  }

  const used = await analysesUsedThisPeriod(admin, input.workspace.id);
  const quota = checkAnalysisQuota(state, used);
  if (!quota.allowed) {
    return {
      ok: false,
      code: "quota_exceeded",
      message: `Your plan allows ${quota.limit} analyses per month and ${quota.used} have been used.`,
    };
  }

  let snapshotId: string;
  let businessSnapshot: BusinessSnapshot;

  if (input.snapshotId) {
    const { data } = await admin
      .from("snapshots")
      .select("*")
      .eq("id", input.snapshotId)
      .eq("workspace_id", input.workspace.id)
      .maybeSingle<SnapshotRow>();
    if (!data) {
      return { ok: false, code: "snapshot_not_found", message: "Snapshot not found." };
    }
    snapshotId = data.id;
    businessSnapshot = {
      workspaceId: data.workspace_id,
      revenueCents: Number(data.revenue_cents),
      previousRevenueCents: Number(data.previous_revenue_cents),
      refundPendingCents: Number(data.refund_pending_cents),
      duplicateChargeCandidates: data.duplicate_charge_candidates ?? [],
      inventoryDays: data.inventory_days ?? undefined,
      conversionRate: data.conversion_rate ?? undefined,
      previousConversionRate: data.previous_conversion_rate ?? undefined,
    };
  } else {
    const parsed = snapshotSchema.safeParse(input.snapshot);
    if (!parsed.success) {
      return {
        ok: false,
        code: "invalid_snapshot",
        message: "The submitted snapshot failed validation.",
      };
    }
    const clean = parsed.data;
    if (clean.duplicateChargeCandidates.length > INSIGHT_LIMITS.maxDuplicateCandidates) {
      return {
        ok: false,
        code: "invalid_snapshot",
        message: `At most ${INSIGHT_LIMITS.maxDuplicateCandidates} duplicate charge candidates are accepted.`,
      };
    }

    const { data, error } = await admin
      .from("snapshots")
      .insert({
        workspace_id: input.workspace.id,
        business_id: null,
        source: "manual",
        provider_key: null,
        revenue_cents: clean.revenueCents,
        previous_revenue_cents: clean.previousRevenueCents,
        refund_pending_cents: clean.refundPendingCents,
        duplicate_charge_candidates: clean.duplicateChargeCandidates,
        inventory_days: clean.inventoryDays ?? null,
        conversion_rate: clean.conversionRate ?? null,
        previous_conversion_rate: clean.previousConversionRate ?? null,
        created_by: input.userId,
      })
      .select("id")
      .single<{ id: string }>();
    if (error || !data) {
      return {
        ok: false,
        code: "storage_failed",
        message: `The snapshot could not be stored: ${error?.message ?? "unknown error"}`,
      };
    }
    snapshotId = data.id;
    businessSnapshot = {
      workspaceId: clean.workspaceId,
      revenueCents: clean.revenueCents,
      previousRevenueCents: clean.previousRevenueCents,
      refundPendingCents: clean.refundPendingCents,
      duplicateChargeCandidates: clean.duplicateChargeCandidates,
      inventoryDays: clean.inventoryDays,
      conversionRate: clean.conversionRate,
      previousConversionRate: clean.previousConversionRate,
    };
  }

  const insights: AgentInsight[] = runDeterministicEngine(businessSnapshot);

  const { data: analysisRow, error: analysisError } = await admin
    .from("analyses")
    .insert({
      workspace_id: input.workspace.id,
      snapshot_id: snapshotId,
      status: "deterministic_complete",
      engine_version: ENGINE_VERSION,
      finding_count: insights.length,
      ai_available: false,
      created_by: input.userId,
    })
    .select("*")
    .single<{ id: string }>();

  if (analysisError || !analysisRow) {
    return {
      ok: false,
      code: "storage_failed",
      message: `The analysis could not be recorded: ${analysisError?.message ?? "unknown error"}`,
    };
  }

  const analysisId = analysisRow.id;

  let findingRows: FindingRow[] = [];
  if (insights.length > 0) {
    const { data: inserted, error: findingsError } = await admin
      .from("findings")
      .insert(insights.map((insight) => rowFromInsight(insight, input.workspace.id, analysisId)))
      .select("*");
    if (findingsError || !inserted) {
      await admin
        .from("analyses")
        .update({ status: "failed", error_message: findingsError?.message ?? "insert failed" })
        .eq("id", analysisId);
      return {
        ok: false,
        code: "storage_failed",
        message: `Findings could not be stored: ${findingsError?.message ?? "unknown error"}`,
      };
    }
    findingRows = inserted as FindingRow[];
  }

  // Usage metering happens only after a successful deterministic run.
  await admin.from("usage_events").insert({
    workspace_id: input.workspace.id,
    kind: "analysis",
    quantity: 1,
    period_start: new Date().toISOString().slice(0, 10).replace(/-\d{2}$/, "-01"),
    actor_id: input.userId,
  });

  await admin.from("audit_events").insert({
    workspace_id: input.workspace.id,
    actor_id: input.userId,
    actor_type: "user",
    action: "analysis.deterministic_complete",
    target_type: "analysis",
    target_id: analysisId,
    metadata: {
      engine_version: ENGINE_VERSION,
      finding_count: insights.length,
      snapshot_id: snapshotId,
    },
  });

  // ---- optional AI reasoning -------------------------------------------------
  let ai: AiResult = {
    available: false,
    reason:
      "Advanced AI reasoning was not requested for this analysis. Deterministic findings are complete.",
    requiredEnv: [],
  };

  if (input.withAi) {
    if (!hasFeature(state, "ai_reasoning")) {
      ai = {
        available: false,
        reason: "Your current plan does not include the AI reasoning layer.",
        requiredEnv: [],
      };
    } else {
      ai = await reasonAboutFindings({
        locale: input.locale ?? "en",
        snapshot: businessSnapshot,
        findings: insights,
      });
    }

    if (ai.available) {
      for (const item of ai.reasoning) {
        const target = findingRows.find((row) => row.id === item.findingId);
        if (!target) continue;
        await admin
          .from("findings")
          .update({
            ai_priority_rank: item.priorityRank,
            ai_explanation: item.explanation,
            ai_next_steps: item.nextSteps,
            ai_missing_information: item.missingInformation,
            ai_provider: ai.provider,
            ai_model: ai.model,
          })
          .eq("id", target.id)
          .eq("workspace_id", input.workspace.id);
      }
      await admin
        .from("analyses")
        .update({
          status: "ai_complete",
          ai_available: true,
          ai_provider: ai.provider,
          ai_model: ai.model,
          ai_notes: ai.summary,
        })
        .eq("id", analysisId);
      await admin.from("audit_events").insert({
        workspace_id: input.workspace.id,
        actor_id: input.userId,
        actor_type: "user",
        action: "analysis.ai_reasoning_complete",
        target_type: "analysis",
        target_id: analysisId,
        metadata: { provider: ai.provider, model: ai.model, findings: ai.reasoning.length },
      });
    } else {
      // Record that reasoning was requested but unavailable — never fabricate output.
      await admin
        .from("analyses")
        .update({ ai_available: false, ai_notes: ai.reason })
        .eq("id", analysisId);
    }
  }

  const { data: refreshed } = await admin
    .from("findings")
    .select("*")
    .eq("analysis_id", analysisId)
    .order("created_at", { ascending: true });

  return {
    ok: true,
    analysisId,
    snapshotId,
    findings: (refreshed ?? findingRows) as FindingRow[],
    ai,
    used: used + 1,
    limit: quota.limit,
  };
}

/**
 * The approval state machine.
 *
 * Allowed transitions are centralised here so a finding can never jump straight from
 * `detected` to `completed`. Nothing in the current product executes a money-moving
 * action, so `executing`/`completed` are only reachable by future trusted executors.
 */
export const ALLOWED_TRANSITIONS: Record<FindingStatus, FindingStatus[]> = {
  detected: ["reviewed", "dismissed"],
  reviewed: ["approved", "dismissed", "detected"],
  approved: ["executing", "dismissed", "reviewed"],
  executing: ["completed", "failed"],
  completed: [],
  failed: ["reviewed", "dismissed"],
  dismissed: ["detected"],
};

export function canTransition(from: FindingStatus, to: FindingStatus): boolean {
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}
