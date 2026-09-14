import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createServiceSupabase } from "@/lib/db/server";
import { jsonError, logServerError, requireWorkspaceOwner } from "@/lib/api/guard";
import { upsertScanSettings } from "@/lib/agent/schedule";
import type { ScheduledScanJobRow } from "@/lib/db/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Scan schedule for one workspace.
 *
 * Read and write both prove ownership first. The write goes through the service-role client
 * because RLS intentionally exposes this table read-only: a customer may choose whether to be
 * scanned and how often, but may not forge `last_status` or run timestamps.
 */
export async function GET(request: NextRequest) {
  const workspaceId = request.nextUrl.searchParams.get("workspaceId");
  const guard = await requireWorkspaceOwner(workspaceId);
  if (!("ok" in guard)) return guard.response;

  const { data } = await guard.supabase
    .from("scheduled_scan_jobs")
    .select("*")
    .eq("workspace_id", guard.workspace.id)
    .limit(1)
    .maybeSingle<ScheduledScanJobRow>();

  const { data: connection } = await guard.supabase
    .from("connections")
    .select("provider_key, status")
    .eq("workspace_id", guard.workspace.id)
    .eq("status", "connected")
    .limit(1)
    .maybeSingle<{ provider_key: string; status: string }>();

  return NextResponse.json({
    job: data
      ? {
          id: data.id,
          enabled: data.enabled,
          cadence: data.cadence,
          nextRunAt: data.next_run_at,
          lastRunAt: data.last_run_at,
          lastStatus: data.last_status,
        }
      : null,
    /** A schedule with nothing to read is pointless; the UI says so before it is enabled. */
    connectedProvider: connection?.provider_key ?? null,
    schedulerConfigured: Boolean((process.env.AGENT_RUN_SECRET ?? "").trim()),
  });
}

const bodySchema = z.object({
  workspaceId: z.string().uuid(),
  enabled: z.boolean(),
  cadence: z.enum(["daily", "weekly"]).default("daily"),
});

export async function POST(request: NextRequest) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return jsonError(400, "invalid_json", "Request body must be JSON.");
  }

  const preParse = z.object({ workspaceId: z.string().uuid() }).safeParse(payload);
  if (!preParse.success) return jsonError(400, "invalid_request", "A workspace id is required.");

  const guard = await requireWorkspaceOwner(preParse.data.workspaceId);
  if (!("ok" in guard)) return guard.response;

  const parsed = bodySchema.safeParse(payload);
  if (!parsed.success) return jsonError(400, "invalid_request", "Invalid schedule request.");

  const admin = createServiceSupabase();
  if (!admin) {
    return jsonError(
      503,
      "database_not_configured",
      "Changing the scan schedule requires server-side database access.",
    );
  }

  try {
    // Refuse to enable a schedule that cannot possibly do anything, instead of leaving the
    // customer with a green switch and a job that skips forever.
    if (parsed.data.enabled) {
      const { data: connection } = await guard.supabase
        .from("connections")
        .select("id")
        .eq("workspace_id", guard.workspace.id)
        .eq("status", "connected")
        .limit(1)
        .maybeSingle();
      if (!connection) {
        return jsonError(
          409,
          "no_connected_provider",
          "Connect a provider first. A scheduled scan needs a source to read.",
        );
      }
    }

    const result = await upsertScanSettings(admin, {
      workspaceId: guard.workspace.id,
      enabled: parsed.data.enabled,
      cadence: parsed.data.cadence,
    });
    if (!result.ok) {
      return jsonError(500, "storage_failed", result.message ?? "The schedule could not be saved.");
    }

    await admin.from("audit_events").insert({
      workspace_id: guard.workspace.id,
      actor_id: guard.userId,
      actor_type: "user",
      action: parsed.data.enabled ? "scan.enabled" : "scan.disabled",
      target_type: "scheduled_scan_job",
      target_id: result.job?.id ?? null,
      metadata: { cadence: parsed.data.cadence, next_run_at: result.job?.next_run_at ?? null },
    });

    return NextResponse.json({
      ok: true,
      job: result.job
        ? {
            id: result.job.id,
            enabled: result.job.enabled,
            cadence: result.job.cadence,
            nextRunAt: result.job.next_run_at,
            lastRunAt: result.job.last_run_at,
            lastStatus: result.job.last_status,
          }
        : null,
    });
  } catch (error) {
    logServerError("scan.schedule", error, { workspaceId: guard.workspace.id });
    return jsonError(500, "schedule_failed", "The schedule could not be saved.");
  }
}
