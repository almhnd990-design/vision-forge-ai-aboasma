import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createServiceSupabase } from "@/lib/db/server";
import { jsonError, logServerError, requireWorkspaceOwner } from "@/lib/api/guard";
import { runAnalysis } from "@/lib/agent/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The authenticated production analysis endpoint.
 *
 * Trust model: the caller must own the workspace (proven through RLS). Plan limits are
 * enforced server-side inside `runAnalysis`. The AI layer runs only when explicitly
 * requested and only if the plan includes it and a provider key exists.
 */

const bodySchema = z.object({
  workspaceId: z.string().uuid(),
  locale: z.enum(["en", "ar"]).default("en"),
  withAi: z.boolean().default(false),
  /** Either inline snapshot data (validated) or a previously stored snapshot id. */
  snapshot: z.unknown().optional(),
  snapshotId: z.string().uuid().optional(),
});

export async function POST(request: NextRequest) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return jsonError(400, "invalid_json", "Request body must be JSON.");
  }

  const parsed = bodySchema.safeParse(payload);
  if (!parsed.success) {
    return jsonError(400, "invalid_request", "Invalid analysis request.", {
      issues: parsed.error.issues.map((i) => i.path.join(".")),
    });
  }
  const { workspaceId, locale, withAi, snapshot, snapshotId } = parsed.data;

  /*
   * Authentication is checked BEFORE input completeness. Otherwise an anonymous caller
   * could distinguish valid from invalid payloads, and the endpoint would leak a little
   * information about its contract to unauthenticated traffic.
   */
  const guard = await requireWorkspaceOwner(workspaceId);
  if (!("ok" in guard)) return guard.response;

  if (!snapshot && !snapshotId) {
    return jsonError(
      400,
      "nothing_to_analyse",
      "Provide either a snapshot to analyse or the id of a stored snapshot.",
    );
  }

  const admin = createServiceSupabase();
  if (!admin) {
    return jsonError(
      503,
      "database_not_configured",
      "Server-side database access is not configured on this deployment.",
    );
  }

  try {
    const result = await runAnalysis(admin, {
      workspace: guard.workspace,
      userId: guard.userId,
      snapshot,
      snapshotId,
      locale,
      withAi,
    });

    if (!result.ok) {
      const status =
        result.code === "quota_exceeded"
          ? 402
          : result.code === "no_plan"
            ? 402
            : result.code === "invalid_snapshot"
              ? 400
              : 500;
      return jsonError(status, result.code, result.message, {
        ...(result.requiredEnv ? { requiredEnv: result.requiredEnv } : {}),
      });
    }

    return NextResponse.json({
      analysisId: result.analysisId,
      snapshotId: result.snapshotId,
      findingCount: result.findings.length,
      usage: { used: result.used, limit: result.limit },
      /**
       * The AI layer reports its own availability so the client can state plainly whether
       * advanced reasoning ran. A `false` here means no AI text exists — not empty text
       * pretending to be analysis.
       */
      ai: result.ai.available
        ? {
            available: true,
            provider: result.ai.provider,
            model: result.ai.model,
            summary: result.ai.summary,
          }
        : { available: false, reason: result.ai.reason },
      findings: result.findings.map((finding) => ({
        id: finding.id,
        kind: finding.kind,
        severity: finding.severity,
        confidence: finding.confidence,
        title: finding.title,
        summary: finding.summary,
        recommendedAction: finding.recommended_action,
        estimatedImpactCents: finding.estimated_impact_cents,
        requiresApproval: finding.requires_approval,
        /** Deterministic evidence is the source of truth and is always present. */
        evidence: finding.evidence,
        status: finding.status,
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
    });
  } catch (error) {
    logServerError("analysis.run", error, { workspaceId });
    return jsonError(
      500,
      "analysis_failed",
      "The analysis could not be completed. Nothing was charged and no data was lost.",
    );
  }
}
