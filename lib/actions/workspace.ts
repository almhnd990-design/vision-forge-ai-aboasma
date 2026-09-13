"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { isSupabaseConfigured } from "@/lib/config";
import { createServerSupabase } from "@/lib/db/server";
import { getSessionUser } from "@/lib/auth/server";
import {
  completeOnboarding,
  createWorkspace,
  renameWorkspace,
} from "@/lib/workspace-service";
import { localePath } from "@/lib/auth/client";
import { logServerError } from "@/lib/api/guard";

/**
 * Server actions for workspace and account mutations.
 *
 * Every action re-derives the caller from the session on the server. No action trusts a
 * user id, an owner id or a plan id supplied by the browser.
 */

export type ActionState = { ok: boolean; message: string } | null;

const createSchema = z.object({
  locale: z.enum(["en", "ar"]),
  name: z.string().trim().min(1).max(120),
  businessType: z.string().trim().max(60).optional(),
  primaryGoal: z.string().trim().max(120).optional(),
  startProvider: z.enum(["stripe", "manual"]).default("manual"),
});

function notConfigured(locale: "en" | "ar"): ActionState {
  return {
    ok: false,
    message:
      locale === "ar"
        ? "الحسابات غير مُهيَّأة في هذه النسخة، لذلك لا يمكن حفظ مساحة عمل."
        : "Accounts are not configured on this deployment, so a workspace cannot be saved.",
  };
}

export async function createWorkspaceAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = createSchema.safeParse({
    locale: formData.get("locale"),
    name: formData.get("name"),
    businessType: formData.get("businessType") || undefined,
    primaryGoal: formData.get("primaryGoal") || undefined,
    startProvider: formData.get("startProvider") ?? "manual",
  });
  if (!parsed.success) {
    const locale = formData.get("locale") === "ar" ? "ar" : "en";
    return {
      ok: false,
      message:
        locale === "ar"
          ? "يرجى إدخال اسم النشاط التجاري."
          : "Please enter a business name.",
    };
  }
  const { locale, name, businessType, primaryGoal, startProvider } = parsed.data;

  if (!isSupabaseConfigured()) return notConfigured(locale);

  const user = await getSessionUser();
  if (!user) {
    redirect(`/${locale}/sign-in?next=${encodeURIComponent(localePath(locale, "/onboarding"))}`);
  }

  const supabase = await createServerSupabase();
  if (!supabase) return notConfigured(locale);

  try {
    const result = await createWorkspace(supabase, {
      userId: user.id,
      name,
      businessType: businessType ?? null,
      primaryGoal: primaryGoal ?? null,
    });
    if (!result.ok) return { ok: false, message: result.message };

    await completeOnboarding(supabase, {
      userId: user.id,
      workspaceId: result.workspace.id,
      primaryGoal: primaryGoal ?? null,
    });

    revalidatePath(`/${locale}/dashboard`);
    revalidatePath(`/${locale}/settings`);
  } catch (error) {
    logServerError("onboarding.create_workspace", error, {});
    return {
      ok: false,
      message:
        locale === "ar"
          ? "تعذّر إنشاء مساحة العمل. لم يتم حفظ أي شيء."
          : "The workspace could not be created. Nothing was saved.",
    };
  }

  // Onboarding outcome decides the destination: connect a provider, or open the dashboard.
  const destination =
    startProvider === "stripe"
      ? localePath(locale, "/dashboard#connections")
      : localePath(locale, "/dashboard");
  redirect(destination);
}

const renameSchema = z.object({
  locale: z.enum(["en", "ar"]),
  workspaceId: z.string().uuid(),
  name: z.string().trim().min(1).max(120),
});

export async function renameWorkspaceAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = renameSchema.safeParse({
    locale: formData.get("locale"),
    workspaceId: formData.get("workspaceId"),
    name: formData.get("name"),
  });
  if (!parsed.success) return { ok: false, message: "Invalid request." };
  const { locale, workspaceId, name } = parsed.data;

  if (!isSupabaseConfigured()) return notConfigured(locale);
  const user = await getSessionUser();
  if (!user) return { ok: false, message: "Sign in to continue." };

  const supabase = await createServerSupabase();
  if (!supabase) return notConfigured(locale);

  const result = await renameWorkspace(supabase, { userId: user.id, workspaceId, name });
  if (!result.ok) return { ok: false, message: result.message ?? "Could not rename." };

  revalidatePath(`/${locale}/settings`);
  return {
    ok: true,
    message: locale === "ar" ? "تم تحديث الاسم." : "Workspace name updated.",
  };
}

const localeSchema = z.object({
  locale: z.enum(["en", "ar"]),
  preferred: z.enum(["en", "ar"]),
});

export async function updateLocaleAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = localeSchema.safeParse({
    locale: formData.get("locale"),
    preferred: formData.get("preferred"),
  });
  if (!parsed.success) return { ok: false, message: "Invalid request." };
  const { locale, preferred } = parsed.data;

  if (!isSupabaseConfigured()) return notConfigured(locale);
  const user = await getSessionUser();
  if (!user) return { ok: false, message: "Sign in to continue." };

  const supabase = await createServerSupabase();
  if (!supabase) return notConfigured(locale);

  const { error } = await supabase
    .from("profiles")
    .update({ locale: preferred })
    .eq("id", user.id);
  if (error) return { ok: false, message: error.message };

  revalidatePath(`/${locale}/settings`);
  return { ok: true, message: locale === "ar" ? "تم تحديث اللغة." : "Language preference updated." };
}

export async function signOutAction(formData: FormData): Promise<void> {
  const locale = formData.get("locale") === "ar" ? "ar" : "en";
  const supabase = await createServerSupabase();
  if (supabase) {
    try {
      await supabase.auth.signOut();
    } catch (error) {
      logServerError("auth.sign_out", error, {});
    }
  }
  redirect(`/${locale}`);
}
