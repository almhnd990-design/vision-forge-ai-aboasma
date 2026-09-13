"use server";

import { z } from "zod";
import { isSupabaseConfigured } from "@/lib/config";
import { createServerSupabase, createServiceSupabase } from "@/lib/db/server";
import { getSessionUser } from "@/lib/auth/server";
import { listWorkspaces } from "@/lib/db/access";
import { logServerError } from "@/lib/api/guard";
import { localePath } from "@/lib/auth/client";

/**
 * Account-level data rights: export and deletion.
 *
 * Both are performed server-side against the caller's own session. Deletion requires an
 * exact typed confirmation because it is irreversible, and it is written to the audit trail
 * before the account is removed so the action is recorded rather than silent.
 */

const exportSchema = z.object({
  locale: z.enum(["en", "ar"]),
  workspaceId: z.string().uuid(),
});

export type ExportState =
  | { ok: true; filename: string; json: string }
  | { ok: false; message: string }
  | null;

export async function exportWorkspaceAction(
  _prev: ExportState,
  formData: FormData,
): Promise<ExportState> {
  const parsed = exportSchema.safeParse({
    locale: formData.get("locale"),
    workspaceId: formData.get("workspaceId"),
  });
  if (!parsed.success) return { ok: false, message: "Invalid request." };
  const { workspaceId } = parsed.data;

  if (!isSupabaseConfigured()) {
    return { ok: false, message: "Accounts are not configured on this deployment." };
  }
  const user = await getSessionUser();
  if (!user) return { ok: false, message: "Sign in to continue." };

  const supabase = await createServerSupabase();
  if (!supabase) return { ok: false, message: "Cloud storage is unavailable." };

  try {
    const { data: workspace } = await supabase
      .from("workspaces")
      .select("*")
      .eq("id", workspaceId)
      .maybeSingle();
    if (!workspace || workspace.owner_id !== user.id) {
      return { ok: false, message: "Workspace not found." };
    }

    const [snapshots, analyses, findings, reviews, audit, connections] = await Promise.all([
      supabase.from("snapshots").select("*").eq("workspace_id", workspaceId),
      supabase.from("analyses").select("*").eq("workspace_id", workspaceId),
      supabase.from("findings").select("*").eq("workspace_id", workspaceId),
      supabase.from("reviews").select("*").eq("workspace_id", workspaceId),
      supabase.from("audit_events").select("*").eq("workspace_id", workspaceId),
      supabase.from("connections").select("*").eq("workspace_id", workspaceId),
    ]);

    const payload = {
      exportedAt: new Date().toISOString(),
      exportVersion: 1,
      note: "GhostOps AI workspace export. Provider credentials are never included.",
      workspace,
      snapshots: snapshots.data ?? [],
      analyses: analyses.data ?? [],
      findings: findings.data ?? [],
      reviews: reviews.data ?? [],
      auditEvents: audit.data ?? [],
      connections: connections.data ?? [],
    };

    await supabase.from("audit_events").insert({
      workspace_id: workspaceId,
      actor_id: user.id,
      actor_type: "user",
      action: "account.data_exported",
      target_type: "workspace",
      target_id: workspaceId,
      metadata: {
        snapshots: payload.snapshots.length,
        findings: payload.findings.length,
      },
    });

    const safeName = String(workspace.name ?? "workspace")
      .replace(/[^a-zA-Z0-9-_]+/g, "-")
      .slice(0, 40);
    return {
      ok: true,
      filename: `ghostops-${safeName}-${new Date().toISOString().slice(0, 10)}.json`,
      json: JSON.stringify(payload, null, 2),
    };
  } catch (error) {
    logServerError("account.export", error, { workspaceId });
    return { ok: false, message: "The export could not be produced. Nothing was changed." };
  }
}

const deleteSchema = z.object({
  locale: z.enum(["en", "ar"]),
  confirm: z.string(),
});

export type DeleteState = { ok: boolean; message: string } | null;

export async function deleteAccountAction(
  _prev: DeleteState,
  formData: FormData,
): Promise<DeleteState> {
  const parsed = deleteSchema.safeParse({
    locale: formData.get("locale"),
    confirm: formData.get("confirm"),
  });
  if (!parsed.success) return { ok: false, message: "Invalid request." };
  const { locale, confirm } = parsed.data;

  const ar = locale === "ar";
  if (confirm.trim() !== "DELETE") {
    return {
      ok: false,
      message: ar
        ? 'اكتب كلمة DELETE بالضبط لتأكيد حذف الحساب.'
        : 'Type DELETE exactly to confirm account deletion.',
    };
  }

  if (!isSupabaseConfigured()) {
    return {
      ok: false,
      message: ar ? "الحسابات غير مُهيَّأة في هذه النسخة." : "Accounts are not configured on this deployment.",
    };
  }
  const user = await getSessionUser();
  if (!user) return { ok: false, message: ar ? "سجّل الدخول أولًا." : "Sign in first." };

  const admin = createServiceSupabase();
  if (!admin) {
    return {
      ok: false,
      message: ar
        ? "الحذف يتطلب مفتاح الخادم (SUPABASE_SERVICE_ROLE_KEY) وهو غير مهيأ."
        : "Deletion requires the server-side service role key, which is not configured.",
    };
  }

  try {
    // Record the request first: after the cascade the audit row would be gone.
    const workspaces = await listWorkspaces(await createServerSupabase().then((c) => c!));
    for (const workspace of workspaces) {
      await admin.from("audit_events").insert({
        workspace_id: workspace.id,
        actor_id: user.id,
        actor_type: "user",
        action: "account.deletion_requested",
        target_type: "user",
        target_id: user.id,
        metadata: { workspace: workspace.name },
      });
    }

    /*
     * Deleting the auth user cascades to profiles and workspaces, and from there to
     * snapshots, findings, reviews, connections and secrets (see migration 0001).
     */
    const { error } = await admin.auth.admin.deleteUser(user.id);
    if (error) {
      logServerError("account.delete", error, {});
      return {
        ok: false,
        message: ar
          ? "تعذّر حذف الحساب. لم يُحذف أي شيء."
          : "The account could not be deleted. Nothing was removed.",
      };
    }

    const supabase = await createServerSupabase();
    if (supabase) await supabase.auth.signOut().catch(() => undefined);
  } catch (error) {
    logServerError("account.delete", error, {});
    return {
      ok: false,
      message: ar ? "تعذّر حذف الحساب. لم يُحذف أي شيء." : "The account could not be deleted. Nothing was removed.",
    };
  }

  const { redirect } = await import("next/navigation");
  redirect(`${localePath(locale, "")}?deleted=1`);

  // `redirect` throws, so this is unreachable; it exists only to satisfy the return type.
  return null;
}
