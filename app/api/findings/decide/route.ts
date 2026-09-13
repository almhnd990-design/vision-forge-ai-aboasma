import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createServiceSupabase } from "@/lib/db/server";
import { jsonError, logServerError, requireWorkspaceOwner } from "@/lib/api/guard";
import { canTransition } from "@/lib/agent/service";
import type { FindingStatus, ReviewDecision } from "@/lib/db/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Human review / approval endpoint.
 *
 * Safety properties:
 *  - ownership is proven with the request-scoped client before anything is written;
 *  - the status change must be a legal move in the state machine (see
 *    `ALLOWED_TRANSITIONS`) — a finding cannot jump from `detected` to `completed`;
 *  - every decision appends to `reviews` and `audit_events`, so the history is
 *    append-only and reconstructable;
 *  - no provider is contacted. Approving is a recorded human decision, not an
 *    executed action, and the response says so explicitly.
 */

const DECISION_TO_STATUS: Record<ReviewDecision, FindingStatus> = {
  reviewed: "reviewed",
  approved: "approved",
  dismissed: "dismissed",
  reopened: "detected",
  execution_failed: "failed",
};

const bodySchema = z.object({
  workspaceId: z.string().uuid(),
  findingId: z.string().uuid(),
  decision: z.enum(["reviewed", "approved", "dismissed", "reopened", "execution_failed"]),
  note: z.string().trim().max(500).optional(),
});

const workspaceOnlySchema = z.object({ workspaceId: z.string().uuid() });

export async function POST(request: NextRequest) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return jsonError(400, "invalid_json", "Request body must be JSON.");
  }

  const preParse = workspaceOnlySchema.safeParse(payload);
  if (!preParse.success) {
    return jsonError(400, "invalid_request", "A workspace id is required.");
  }

  // Authentication precedes full input validation.
  const guard = await requireWorkspaceOwner(preParse.data.workspaceId);
  if (!("ok" in guard)) return guard.response;

  const parsed = bodySchema.safeParse(payload);
  if (!parsed.success) {
    return jsonError(400, "invalid_request", "Invalid decision request.");
  }
  const { workspaceId, findingId, decision, note } = parsed.data;

  const admin = createServiceSupabase();
  if (!admin) {
    return jsonError(503, "database_not_configured", "Server-side database access is not configured.");
  }

  try {
    const { data: finding } = await admin
      .from("findings")
      .select("id, status, workspace_id, requires_approval")
      .eq("id", findingId)
      .eq("workspace_id", workspaceId)
      .maybeSingle<{
        id: string;
        status: FindingStatus;
        workspace_id: string;
        requires_approval: boolean;
      }>();

    if (!finding) {
      return jsonError(404, "finding_not_found", "Finding not found.");
    }

    const target = DECISION_TO_STATUS[decision];
    if (finding.status === target) {
      return jsonError(
        409,
        "no_change",
        `The finding is already in the "${target}" state.`,
      );
    }
    if (!canTransition(finding.status, target)) {
      return jsonError(
        409,
        "invalid_transition",
        `A finding in the "${finding.status}" state cannot move to "${target}".`,
        { from: finding.status, to: target },
      );
    }

    const nowIso = new Date().toISOString();

    const { error: updateError } = await admin
      .from("findings")
      .update({ status: target, decided_by: guard.userId, decided_at: nowIso })
      .eq("id", findingId)
      .eq("workspace_id", workspaceId);
    if (updateError) {
      return jsonError(500, "storage_failed", "The decision could not be recorded.");
    }

    await admin.from("reviews").insert({
      workspace_id: workspaceId,
      finding_id: findingId,
      decision,
      note: note ?? null,
      actor_id: guard.userId,
    });

    await admin.from("audit_events").insert({
      workspace_id: workspaceId,
      actor_id: guard.userId,
      actor_type: "user",
      action: `finding.${decision}`,
      target_type: "finding",
      target_id: findingId,
      metadata: { from: finding.status, to: target, requires_approval: finding.requires_approval },
    });

    return NextResponse.json({
      findingId,
      status: target,
      /**
       * The record is a decision, not an execution. GhostOps has no executor for any
       * money-moving action today, so this flag is reported honestly.
       */
      executed: false,
      executionNote:
        target === "approved"
          ? "Approval recorded. No external action was performed: this build has no executor, and no provider was contacted."
          : undefined,
    });
  } catch (error) {
    logServerError("finding.decide", error, { workspaceId, findingId });
    return jsonError(500, "decision_failed", "The decision could not be completed.");
  }
}
