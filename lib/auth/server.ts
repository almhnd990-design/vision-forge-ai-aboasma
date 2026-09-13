import "server-only";

import { redirect } from "next/navigation";
import { isSupabaseConfigured } from "@/lib/config";
import { createServerSupabase } from "@/lib/db/server";
import { safeRedirectPath } from "./client";
import type { ProfileRow } from "@/lib/db/types";

/**
 * Server-side session helpers.
 *
 * `getSessionUser` never throws: a misconfigured or unreachable auth provider returns
 * null so callers can render an explicit configuration state instead of a crash.
 */
export async function getSessionUser() {
  if (!isSupabaseConfigured()) return null;
  try {
    const supabase = await createServerSupabase();
    if (!supabase) return null;
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return user ?? null;
  } catch {
    return null;
  }
}

export async function getProfile(userId: string): Promise<ProfileRow | null> {
  try {
    const supabase = await createServerSupabase();
    if (!supabase) return null;
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle<ProfileRow>();
    return data ?? null;
  } catch {
    return null;
  }
}

/**
 * Guard for account pages. Redirects unauthenticated visitors to sign-in with a
 * validated return path, because an unvalidated one is an open-redirect primitive.
 */
export async function requireUserOrRedirect(
  locale: "en" | "ar",
  returnPath: string,
): Promise<{ id: string; email: string | null }> {
  const user = await getSessionUser();
  if (user) return { id: user.id, email: user.email ?? null };
  const safe = safeRedirectPath(returnPath);
  const next = safe ? `?next=${encodeURIComponent(safe)}` : "";
  redirect(`/${locale}/sign-in${next}`);
}
