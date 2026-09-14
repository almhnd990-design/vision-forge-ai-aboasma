import { NextResponse, type NextRequest } from "next/server";
import { jsonError, logServerError, requireWorkspaceOwner } from "@/lib/api/guard";
import { analysesUsedThisPeriod, entitlementState } from "@/lib/db/access";
import type { FindingRow, ReviewRow, SnapshotRow } from "@/lib/db/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Read the signed-in customer's workspace state.
 *
 * This is what makes server-side persistence useful rather than decorative: the dashboard
 * loads the SAME findings and review history on any device, from the database, with RLS
 * deciding what is visible. A customer can only ever receive their own workspace.
 */
export async function GET(request: NextRequest) {
  const workspaceId = request.nextUrl.searchParams.get("workspaceId");
  const guard = await requireWorkspaceOwner(workspaceId);
  if (!("ok" in guard)) return guard.response;

  try {
    const supabase = guard.supabase;

    const entitlements = entitlementState(guard.workspace);
    const used = await analysesUsedThisPeriod(supabase, guard.workspace.id);

    // Latest analysis for this workspace, then its findings.
    const { data: analyses } = await supabase
      .from("analyses")
      .select("*")
      .eq("workspace_id", guard.workspace.id)
      .order("started_at", { ascending: false })
      .limit(1);

    const latest = (analyses ?? [])[0] ?? null;

    let findings: FindingRow[] = [];
    if (latest) {
      const { data } = await supabase
        .from("findings")
        .select("*")
        .eq("analysis_id", latest.id)
        .order("created_at", { ascending: true });
      findings = (data ?? []) as FindingRow[];
    }

    // Most recent decision per finding decides whether it counts as reviewed.
    const { data: reviews } = await supabase
      .from("reviews")
      .select("*")
      .eq("workspace_id", guard.workspace.id)
      .order("created_at", { ascending: true });
    const latestDecision = new Map<string, string>();
    for (const review of (reviews ?? []) as ReviewRow[]) {
      latestDecision.set(review.finding_id, review.decision);
    }
    const reviewed = findings
      .filter((finding) => {
        const decision = latestDecision.get(finding.id);
        return decision === "reviewed" || decision === "approved";
      })
      .map((finding) => finding.id);

    const { data: snapshots } = await supabase
      .from("snapshots")
      .select("*")
      .eq("workspace_id", guard.workspace.id)
      .order("created_at", { ascending: false })
      .limit(1);
    const snapshot = ((snapshots ?? [])[0] ?? null) as SnapshotRow | null;

    return NextResponse.json({
      workspace: {
        id: guard.workspace.id,
        name: guard.workspace.name,
        businessType: guard.workspace.business_type,
        onboardingCompleted: guard.workspace.onboarding_completed,
      },
      plan: {
        planId: entitlements.planId,
        billingStatus: entitlements.billingStatus,
        blockedReason: entitlements.blockedReason ?? null,
        analysesUsed: used,
        analysesLimit: entitlements.entitlements.analysesPerMonth,
        workspaces: entitlements.entitlements.workspaces,
        connectedProviders: entitlements.entitlements.connectedProviders,
      },
      analysis: latest
        ? {
            id: latest.id,
            status: latest.status,
            startedAt: latest.started_at,
            completedAt: latest.completed_at,
            engineVersion: latest.engine_version,
            findingCount: latest.finding_count,
            /** Honest record of whether the AI layer actually ran. */
            ai: {
              available: latest.ai_available,
              provider: latest.ai_provider,
              model: latest.ai_model,
              summary: latest.ai_notes,
            },
          }
        : null,
      snapshot: snapshot
        ? {
            id: snapshot.id,
            source: snapshot.source,
            providerKey: snapshot.provider_key,
            revenueCents: snapshot.revenue_cents,
            previousRevenueCents: snapshot.previous_revenue_cents,
            refundPendingCents: snapshot.refund_pending_cents,
            inventoryDays: snapshot.inventory_days,
            createdAt: snapshot.created_at,
          }
        : null,
      findings: findings.map((finding) => ({
        id: finding.id,
        kind: finding.kind,
        severity: finding.severity,
        confidence: finding.confidence,
        title: finding.title,
        summary: finding.summary,
        recommendedAction: finding.recommended_action,
        estimatedImpactCents: finding.estimated_impact_cents,
        requiresApproval: finding.requires_approval,
        /** Deterministic evidence. Never authored by a language model. */
        evidence: finding.evidence,
        status: finding.status,
        decidedAt: finding.decided_at,
        ai: finding.ai_explanation
          ? {
              priorityRank: finding.ai_priority_rank,
              explanation: finding.ai_explanation,
              nextSteps: finding.ai_next_steps ?? [],
              missingInformation: finding.ai_missing_information ?? [],
              provider: finding.ai_provider,
              model: finding.ai_model,
            }
          : null,
      })),
      reviewed,
    });
  } catch (error) {
    logServerError("workspace.snapshot", error, { workspaceId: workspaceId ?? undefined });
    return jsonError(
      500,
      "snapshot_failed",
      "The workspace could not be read. Nothing was modified.",
    );
  }
}
