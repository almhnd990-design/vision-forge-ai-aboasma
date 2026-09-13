import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createServiceSupabase } from "@/lib/db/server";
import { jsonError, logServerError, requireWorkspaceOwner } from "@/lib/api/guard";
import {
  analysesUsedThisPeriod,
  checkConnectionQuota,
  entitlementState,
} from "@/lib/db/access";
import { PROVIDER_KEYS, connectorEnvState, specFor } from "@/lib/connectors/registry";
import { connectProvider, countConnected, listConnectionViews } from "@/lib/connectors/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Connections API.
 *
 * The GET response is what the UI renders from, so it carries the *honest* state of every
 * provider: implemented-or-not, configured-or-not, and the plan limit that applies. The
 * UI never has to guess and never has to hard-code which integrations exist.
 */

export async function GET(request: NextRequest) {
  const workspaceId = request.nextUrl.searchParams.get("workspaceId");
  const guard = await requireWorkspaceOwner(workspaceId);
  if (!("ok" in guard)) return guard.response;

  const state = entitlementState(guard.workspace);
  const connected = await countConnected(guard.supabase, guard.workspace.id);
  const views = await listConnectionViews(guard.supabase, guard.workspace.id);
  const used = await analysesUsedThisPeriod(guard.supabase, guard.workspace.id);

  return NextResponse.json({
    plan: {
      planId: state.planId,
      billingStatus: state.billingStatus,
      blockedReason: state.blockedReason ?? null,
      limits: {
        connectedProviders: state.entitlements.connectedProviders,
        analysesPerMonth: state.entitlements.analysesPerMonth,
      },
      usage: { connected, analysesThisMonth: used },
    },
    connections: views,
    providers: PROVIDER_KEYS.map((key) => {
      const spec = specFor(key);
      const env = connectorEnvState(key);
      const quota = checkConnectionQuota(state, connected);
      return {
        key,
        status: spec.status,
        name: spec.name,
        reads: spec.reads,
        doesNot: spec.doesNot,
        credentialFields: spec.credentialFields,
        requiredEnv: spec.requiredEnv,
        missingEnv: env.missing,
        configured: env.configured,
        performsWrites: spec.performsWrites,
        /** Whether the UI may render a working Connect control right now. */
        canConnect: spec.status === "live" && env.configured && quota.allowed,
        blockedBy: !env.configured
          ? "configuration"
          : !quota.allowed
            ? "plan_limit"
            : null,
      };
    }),
  });
}

const bodySchema = z.object({
  workspaceId: z.string().uuid(),
  providerKey: z.enum(["stripe", "shopify", "amazon", "gmail"]),
  action: z.enum(["connect", "disconnect"]),
  credentials: z.record(z.string(), z.string().max(500)).optional(),
});

/**
 * Only `workspaceId` is parsed before authentication; everything else is parsed after.
 * That keeps anonymous callers from learning the endpoint's input contract through
 * validation errors.
 */
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

  const guard = await requireWorkspaceOwner(preParse.data.workspaceId);
  if (!("ok" in guard)) return guard.response;

  const parsed = bodySchema.safeParse(payload);
  if (!parsed.success) {
    return jsonError(400, "invalid_request", "Invalid connection request.");
  }
  const { workspaceId, providerKey, action, credentials } = parsed.data;

  const admin = createServiceSupabase();
  if (!admin) {
    return jsonError(
      503,
      "database_not_configured",
      "Connecting a provider requires server-side database access, which is not configured.",
    );
  }

  try {
    if (action === "disconnect") {
      const { disconnectProvider } = await import("@/lib/connectors/service");
      const result = await disconnectProvider(admin, {
        workspaceId,
        userId: guard.userId,
        providerKey,
      });
      if (!result.ok) {
        return jsonError(404, "not_connected", result.message ?? "No such connection.");
      }
      return NextResponse.json({ ok: true, status: "disconnected" });
    }

    if (!credentials || Object.keys(credentials).length === 0) {
      return jsonError(400, "missing_credentials", "No credentials were provided.");
    }

    const result = await connectProvider(admin, {
      workspace: guard.workspace,
      userId: guard.userId,
      providerKey,
      credentials,
    });

    if (!result.ok) {
      const status =
        result.code === "quota_exceeded"
          ? 402
          : result.code === "not_implemented"
            ? 409
            : result.code === "not_configured"
              ? 503
              : 400;
      return jsonError(status, result.code, result.message);
    }

    return NextResponse.json({
      ok: true,
      status: "connected",
      accountLabel: result.accountLabel,
      scopes: result.scopes,
      warnings: result.warnings,
    });
  } catch (error) {
    logServerError("connection.mutate", error, { workspaceId, providerKey, action });
    // Credentials are never included in the log context.
    return jsonError(500, "connection_failed", "The connection could not be completed.");
  }
}
