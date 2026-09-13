import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createServiceSupabase } from "@/lib/db/server";
import { jsonError, logServerError, requireWorkspaceOwner } from "@/lib/api/guard";
import { runAnalysis } from "@/lib/agent/service";
import { syncProvider } from "@/lib/connectors/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Provider sync endpoint.
 *
 * Pipeline: read provider data (read-only) -> store a snapshot with provenance ->
 * run the deterministic engine server-side. The AI layer is NOT invoked here: a sync
 * must stay fast, free and reproducible. AI reasoning is a separate explicit action.
 */

const bodySchema = z.object({
  workspaceId: z.string().uuid(),
  providerKey: z.enum(["stripe", "shopify", "amazon", "gmail"]),
  days: z.number().int().min(1).max(90).default(30),
  locale: z.enum(["en", "ar"]).default("en"),
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

  // Authentication precedes full input validation on every endpoint.
  const guard = await requireWorkspaceOwner(preParse.data.workspaceId);
  if (!("ok" in guard)) return guard.response;

  const parsed = bodySchema.safeParse(payload);
  if (!parsed.success) {
    return jsonError(400, "invalid_request", "Invalid sync request.");
  }
  const { workspaceId, providerKey, days, locale } = parsed.data;

  const admin = createServiceSupabase();
  if (!admin) {
    return jsonError(503, "database_not_configured", "Server-side database access is not configured.");
  }

  try {
    const sync = await syncProvider(admin, {
      workspace: guard.workspace,
      userId: guard.userId,
      providerKey,
      days,
    });

    if (!sync.ok) {
      const status =
        sync.code === "quota_exceeded"
          ? 402
          : sync.code === "not_connected" || sync.code === "not_implemented"
            ? 409
            : sync.code === "credentials_unreadable"
              ? 409
              : sync.code === "no_data"
                ? 200
                : 502;
      return jsonError(status, sync.code, sync.message);
    }

    // Deterministic analysis of the freshly imported snapshot.
    const analysis = await runAnalysis(admin, {
      workspace: guard.workspace,
      userId: guard.userId,
      snapshotId: sync.snapshotId,
      locale,
      withAi: false,
    });

    if (!analysis.ok) {
      return NextResponse.json(
        {
          ok: true,
          snapshotId: sync.snapshotId,
          imported: true,
          analysisFailed: true,
          message: analysis.message,
          provenance: { windowStart: sync.windowStart, windowEnd: sync.windowEnd, notes: sync.notes },
        },
        { status: 207 },
      );
    }

    return NextResponse.json({
      ok: true,
      snapshotId: sync.snapshotId,
      analysisId: analysis.analysisId,
      findingCount: analysis.findings.length,
      provenance: { windowStart: sync.windowStart, windowEnd: sync.windowEnd, notes: sync.notes },
      usage: { used: analysis.used, limit: analysis.limit },
      ai: { available: false, reason: analysis.ai.available ? undefined : analysis.ai.reason },
    });
  } catch (error) {
    logServerError("connection.sync", error, { workspaceId, providerKey });
    return jsonError(
      502,
      "sync_failed",
      "The provider could not be read. No data was imported and nothing was changed in your account.",
    );
  }
}
