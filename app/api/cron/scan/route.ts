import { NextResponse, type NextRequest } from "next/server";
import { createServiceSupabase } from "@/lib/db/server";
import { logServerError, requireAgentSecret } from "@/lib/api/guard";
import { findDueJobs, runScheduledJob, type ScanOutcome } from "@/lib/agent/schedule";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Scheduled-scan trigger.
 *
 * Call it from any scheduler:
 *   curl -X POST https://<app>/api/cron/scan -H "Authorization: Bearer $AGENT_RUN_SECRET"
 *
 * Security posture:
 *  - this endpoint is machine-only and requires AGENT_RUN_SECRET, compared in constant time;
 *    it is NOT customer authentication and it never acts on a caller-supplied workspace id;
 *  - the set of work comes from the `scheduled_scan_jobs` table, so an attacker who somehow
 *    held the secret still cannot direct it at an arbitrary tenant;
 *  - when the secret is not configured the route refuses to run at all (503) rather than
 *    running unauthenticated.
 *
 * GET is supported as well because several hosted schedulers can only issue a GET, and it
 * performs the same due-job pass. It is idempotent: a job whose `next_run_at` has not passed
 * is simply not selected.
 */
async function handle(request: Request) {
  const guard = await requireAgentSecret(request);
  if ("response" in guard) return guard.response;

  const admin = createServiceSupabase();
  if (!admin) {
    return NextResponse.json(
      {
        error: {
          code: "database_not_configured",
          message:
            "Scheduled scans require server-side database access (SUPABASE_SERVICE_ROLE_KEY).",
        },
      },
      { status: 503 },
    );
  }

  const url = new URL(request.url);
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit") ?? 25)));

  try {
    const due = await findDueJobs(admin, { limit });

    if (due.length === 0) {
      return NextResponse.json({
        ran: 0,
        skipped: 0,
        failed: 0,
        note: "No scan job is due. Nothing was fetched.",
      });
    }

    const outcomes: ScanOutcome[] = [];
    for (const entry of due) {
      // Sequential on purpose: a scheduled pass must not stampede a provider or the database.
      outcomes.push(await runScheduledJob(admin, entry));
    }

    const summary = {
      ran: outcomes.filter((outcome) => outcome.status === "completed").length,
      skipped: outcomes.filter((outcome) => outcome.status === "skipped").length,
      failed: outcomes.filter((outcome) => outcome.status === "failed").length,
      outcomes,
    };

    return NextResponse.json(summary, {
      // 207 signals "some work ran, some did not" so a scheduler can alert on it.
      status: summary.failed > 0 ? 207 : 200,
    });
  } catch (error) {
    logServerError("cron.scan", error, {});
    return NextResponse.json(
      { error: { code: "scan_failed", message: "The scheduled pass could not be completed." } },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  return handle(request);
}

export async function GET(request: NextRequest) {
  return handle(request);
}
