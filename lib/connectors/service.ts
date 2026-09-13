import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { ProviderKey, ConnectionRow } from "@/lib/db/types";
import type { WorkspaceRow } from "@/lib/db/types";
import {
  analysesUsedThisPeriod,
  checkAnalysisQuota,
  checkConnectionQuota,
  entitlementState,
} from "@/lib/db/access";
import { connectorFor, specFor } from "./registry";
import { deleteCredentials, loadCredentials, saveCredentials } from "./secrets";
import { isEncryptionConfigured } from "./crypto";

/**
 * Connection lifecycle service.
 *
 * Every export is server-only and takes the SERVICE-ROLE client, so callers must have
 * already proven workspace ownership. Entitlement checks live here rather than in the UI
 * because the browser is never the enforcement point.
 */

export type ConnectionView = {
  providerKey: ProviderKey;
  status: ConnectionRow["status"];
  accountLabel: string | null;
  lastSyncAt: string | null;
  lastSyncStatus: ConnectionRow["last_sync_status"];
  lastError: string | null;
  scopes: string[];
  createdAt: string | null;
};

export async function listConnectionViews(
  supabase: SupabaseClient,
  workspaceId: string,
): Promise<ConnectionView[]> {
  const { data } = await supabase
    .from("connections")
    .select("*")
    .eq("workspace_id", workspaceId);
  const rows = (data ?? []) as ConnectionRow[];
  return rows.map((row) => ({
    providerKey: row.provider_key,
    status: row.status,
    accountLabel: row.external_account_label,
    lastSyncAt: row.last_sync_at,
    lastSyncStatus: row.last_sync_status,
    lastError: row.last_error,
    scopes: Array.isArray(row.scopes) ? row.scopes : [],
    createdAt: row.created_at,
  }));
}

export async function countConnected(
  supabase: SupabaseClient,
  workspaceId: string,
): Promise<number> {
  const { count } = await supabase
    .from("connections")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", workspaceId)
    .eq("status", "connected");
  return count ?? 0;
}

async function audit(
  admin: SupabaseClient,
  workspaceId: string,
  actorId: string,
  action: string,
  metadata: Record<string, unknown>,
  targetId?: string,
): Promise<void> {
  await admin.from("audit_events").insert({
    workspace_id: workspaceId,
    actor_id: actorId,
    actor_type: "user",
    action,
    target_type: "connection",
    target_id: targetId ?? null,
    metadata,
  });
}

/**
 * Verify a credential with the provider and, only if it works, store it and mark the
 * connection healthy. A failed verification stores nothing.
 */
export async function connectProvider(
  admin: SupabaseClient,
  input: {
    workspace: WorkspaceRow;
    userId: string;
    providerKey: ProviderKey;
    credentials: Record<string, string>;
  },
): Promise<
  | { ok: true; accountLabel: string; scopes: string[]; warnings: string[] }
  | { ok: false; code: string; message: string }
> {
  const connector = connectorFor(input.providerKey);
  const spec = specFor(input.providerKey);

  if (!connector || spec.status !== "live") {
    return {
      ok: false,
      code: "not_implemented",
      message: `${spec.name.en} is not implemented yet. Nothing was connected.`,
    };
  }

  const missingEnv = spec.requiredEnv.filter((name) => !(process.env[name] ?? "").trim());
  if (missingEnv.length > 0) {
    return {
      ok: false,
      code: "not_configured",
      message: `This deployment is missing configuration required to store credentials: ${missingEnv.join(", ")}.`,
    };
  }
  if (spec.requiresEncryptionKey && !isEncryptionConfigured()) {
    return {
      ok: false,
      code: "not_configured",
      message: "Credential encryption is not configured, so no credential was stored.",
    };
  }

  // Entitlement: how many providers does this plan allow?
  const state = entitlementState(input.workspace);
  const existing = await listConnectionViews(admin, input.workspace.id);
  const alreadyConnected = existing.find(
    (c) => c.providerKey === input.providerKey && c.status === "connected",
  );
  if (!alreadyConnected) {
    const connectedCount = existing.filter((c) => c.status === "connected").length;
    const quota = checkConnectionQuota(state, connectedCount);
    if (!quota.allowed) {
      return {
        ok: false,
        code: "quota_exceeded",
        message:
          quota.reason === "no_plan"
            ? "An active subscription is required before connecting a provider."
            : `Your plan allows ${quota.limit} connected provider(s) and ${quota.used} are already connected.`,
      };
    }
  }

  // Verify BEFORE storing anything.
  const verification = await connector.verify(input.credentials);
  if (!verification.ok) {
    await audit(admin, input.workspace.id, input.userId, "connection.verify_failed", {
      provider: input.providerKey,
      code: verification.code,
    });
    return { ok: false, code: verification.code, message: verification.message };
  }

  const { data: upserted, error } = await admin
    .from("connections")
    .upsert(
      {
        workspace_id: input.workspace.id,
        provider_key: input.providerKey,
        status: "connected",
        external_account_id: verification.data.accountId,
        external_account_label: verification.data.accountLabel,
        scopes: verification.data.scopes,
        last_error: null,
        connected_by: input.userId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "workspace_id,provider_key" },
    )
    .select("id")
    .single<{ id: string }>();

  if (error || !upserted) {
    return {
      ok: false,
      code: "storage_failed",
      message: `The connection could not be recorded: ${error?.message ?? "unknown error"}`,
    };
  }

  const stored = await saveCredentials(admin, upserted.id, input.credentials);
  if (!stored.ok) {
    // Do not leave a half-connected provider behind.
    await admin
      .from("connections")
      .update({ status: "error", last_error: stored.reason })
      .eq("id", upserted.id);
    return { ok: false, code: "storage_failed", message: stored.reason };
  }

  await audit(
    admin,
    input.workspace.id,
    input.userId,
    alreadyConnected ? "connection.reconnected" : "connection.connected",
    {
      provider: input.providerKey,
      account_id: verification.data.accountId,
      scopes: verification.data.scopes,
    },
    upserted.id,
  );

  return {
    ok: true,
    accountLabel: verification.data.accountLabel,
    scopes: verification.data.scopes,
    warnings: verification.data.warnings,
  };
}

/** Remove a connection and its stored credentials. */
export async function disconnectProvider(
  admin: SupabaseClient,
  input: { workspaceId: string; userId: string; providerKey: ProviderKey },
): Promise<{ ok: boolean; message?: string }> {
  const { data } = await admin
    .from("connections")
    .select("id")
    .eq("workspace_id", input.workspaceId)
    .eq("provider_key", input.providerKey)
    .maybeSingle<{ id: string }>();
  if (!data) return { ok: false, message: "No such connection." };

  await deleteCredentials(admin, data.id);
  await admin
    .from("connections")
    .update({
      status: "disconnected",
      external_account_id: null,
      external_account_label: null,
      scopes: [],
      last_error: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", data.id);

  await audit(admin, input.workspaceId, input.userId, "connection.disconnected", {
    provider: input.providerKey,
  }, data.id);

  return { ok: true };
}

export type SyncOutcome =
  | {
      ok: true;
      snapshotId: string;
      analysisId: string;
      findingCount: number;
      notes: string[];
      windowStart: string;
      windowEnd: string;
    }
  | { ok: false; code: string; message: string };

/**
 * Pull provider data, persist a snapshot and run the DETERMINISTIC engine.
 *
 * The AI layer is deliberately not invoked here: sync must stay fast, free and
 * reproducible. AI reasoning is a separate, explicit user action.
 */
export async function syncProvider(
  admin: SupabaseClient,
  input: {
    workspace: WorkspaceRow;
    userId: string;
    providerKey: ProviderKey;
    days: number;
  },
): Promise<SyncOutcome> {
  const connector = connectorFor(input.providerKey);
  if (!connector) {
    return { ok: false, code: "not_implemented", message: "That provider is not implemented." };
  }

  const { data: connection } = await admin
    .from("connections")
    .select("*")
    .eq("workspace_id", input.workspace.id)
    .eq("provider_key", input.providerKey)
    .maybeSingle<ConnectionRow>();

  if (!connection || connection.status !== "connected") {
    return { ok: false, code: "not_connected", message: "Connect the provider first." };
  }

  const credentials = await loadCredentials(admin, connection.id);
  if (!credentials) {
    await admin
      .from("connections")
      .update({
        status: "error",
        last_error:
          "Stored credentials could not be decrypted. Reconnect the provider to store them again.",
        last_sync_status: "failed",
        updated_at: new Date().toISOString(),
      })
      .eq("id", connection.id);
    return {
      ok: false,
      code: "credentials_unreadable",
      message:
        "The stored credentials could not be decrypted. Reconnect the provider to store them again.",
    };
  }

  // Server-side quota enforcement for the analysis this sync will create.
  const state = entitlementState(input.workspace);
  const used = await analysesUsedThisPeriod(admin, input.workspace.id);
  const quota = checkAnalysisQuota(state, used);
  if (!quota.allowed) {
    return {
      ok: false,
      code: "quota_exceeded",
      message:
        quota.reason === "no_plan"
          ? "An active subscription is required to run an analysis."
          : `Your plan allows ${quota.limit} analyses per month and ${quota.used} have been used.`,
    };
  }

  const built = await connector.buildSnapshot(credentials, { days: input.days });
  if (!built.ok) {
    await admin
      .from("connections")
      .update({
        status: built.code === "invalid_credentials" ? "error" : connection.status,
        last_error: built.message,
        last_sync_status: "failed",
        updated_at: new Date().toISOString(),
      })
      .eq("id", connection.id);
    await audit(admin, input.workspace.id, input.userId, "connection.sync_failed", {
      provider: input.providerKey,
      code: built.code,
    }, connection.id);
    return { ok: false, code: built.code, message: built.message };
  }

  const draft = built.data;
  const nowIso = new Date().toISOString();

  const { data: snapshotRow, error: snapshotError } = await admin
    .from("snapshots")
    .insert({
      workspace_id: input.workspace.id,
      business_id: null,
      source: "connector",
      provider_key: input.providerKey,
      revenue_cents: draft.snapshot.revenueCents,
      previous_revenue_cents: draft.snapshot.previousRevenueCents,
      refund_pending_cents: draft.snapshot.refundPendingCents,
      duplicate_charge_candidates: draft.snapshot.duplicateChargeCandidates,
      inventory_days: draft.snapshot.inventoryDays ?? null,
      conversion_rate: draft.snapshot.conversionRate ?? null,
      previous_conversion_rate: draft.snapshot.previousConversionRate ?? null,
      created_by: input.userId,
    })
    .select("id")
    .single<{ id: string }>();

  if (snapshotError || !snapshotRow) {
    return {
      ok: false,
      code: "storage_failed",
      message: `The snapshot could not be stored: ${snapshotError?.message ?? "unknown error"}`,
    };
  }

  await admin.from("connections").update({
    last_sync_at: nowIso,
    last_sync_status: "ok",
    last_error: null,
    status: "connected",
    updated_at: nowIso,
  }).eq("id", connection.id);

  await audit(admin, input.workspace.id, input.userId, "connection.synced", {
    provider: input.providerKey,
    snapshot_id: snapshotRow.id,
    window_start: draft.provenance.windowStart,
    window_end: draft.provenance.windowEnd,
    record_count: draft.provenance.recordCount,
    notes: draft.provenance.notes,
  }, connection.id);

  return {
    ok: true,
    snapshotId: snapshotRow.id,
    analysisId: "",
    findingCount: 0,
    notes: draft.provenance.notes,
    windowStart: draft.provenance.windowStart,
    windowEnd: draft.provenance.windowEnd,
  };
}
