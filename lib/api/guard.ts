import "server-only";

import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServerSupabase } from "@/lib/db/server";
import { getWorkspaceAccess } from "@/lib/db/access";
import type { WorkspaceRow } from "@/lib/db/types";

/**
 * Shared request guards.
 *
 * There are two distinct trust boundaries and they must never be confused:
 *
 *  1. `requireWorkspaceOwner` — a real signed-in customer. Used by every
 *     customer-facing API route. Ownership is proven through RLS, and plan
 *     entitlements are derived server-side from the billing mirror.
 *
 *  2. `requireAgentSecret` — server-to-server only, for machine callers that hold
 *     AGENT_RUN_SECRET. This is NOT customer authentication and must never be used to
 *     authorise a browser request.
 */

export type OwnerContext = {
  userId: string;
  workspace: WorkspaceRow;
  /** Request-scoped client: RLS applies, so it can only see this tenant's rows. */
  supabase: SupabaseClient;
};

export type GuardFailure = { response: NextResponse };

export function jsonError(
  status: number,
  code: string,
  message: string,
  extra: Record<string, unknown> = {},
): NextResponse {
  return NextResponse.json({ error: { code, message, ...extra } }, { status });
}

/** Constant-time comparison so a wrong secret cannot be distinguished by timing. */
function safeEqual(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

export async function requireAgentSecret(
  request: Request,
): Promise<{ ok: true } | GuardFailure> {
  const secret = (process.env.AGENT_RUN_SECRET ?? "").trim();
  if (!secret) {
    return {
      response: jsonError(
        503,
        "agent_secret_missing",
        "AGENT_RUN_SECRET is not configured on this deployment.",
      ),
    };
  }
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token || !safeEqual(token, secret)) {
    return {
      response: jsonError(401, "unauthorized", "A valid bearer token is required."),
    };
  }
  return { ok: true };
}

export async function requireWorkspaceOwner(
  workspaceId: string | null | undefined,
): Promise<({ ok: true } & OwnerContext) | GuardFailure> {
  const supabase = await createServerSupabase();
  if (!supabase) {
    return {
      response: jsonError(
        503,
        "database_not_configured",
        "Cloud accounts are not configured on this deployment.",
      ),
    };
  }
  const access = await getWorkspaceAccess(supabase, workspaceId ?? undefined);
  if (access.error === "unauthorized") {
    return {
      response: jsonError(401, "unauthorized", "Sign in to continue."),
    };
  }
  if (access.error === "not_found" || !access.workspace) {
    // Deliberately identical to a missing workspace so tenants cannot probe for others.
    return {
      response: jsonError(404, "workspace_not_found", "Workspace not found."),
    };
  }
  return {
    ok: true,
    userId: access.userId,
    workspace: access.workspace,
    supabase,
  };
}

/** Structured error logging that never writes secrets or provider payloads. */
export function logServerError(
  scope: string,
  error: unknown,
  context: Record<string, unknown> = {},
): void {
  const message = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack?.split("\n").slice(0, 4).join(" | ") : "";
  console.error(
    JSON.stringify({
      level: "error",
      scope,
      message,
      stack,
      ...context,
      at: new Date().toISOString(),
    }),
  );
}
