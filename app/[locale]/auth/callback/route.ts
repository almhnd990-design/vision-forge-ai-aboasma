import { NextResponse, type NextRequest } from "next/server";
import { createServerSupabase } from "@/lib/db/server";
import { safeRedirectPath } from "@/lib/auth/client";
import { logServerError } from "@/lib/api/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * OAuth / email-confirmation callback.
 *
 * The `next` parameter is validated with `safeRedirectPath` before use: an unvalidated
 * value here is a textbook open redirect, and it arrives from a URL a user can craft.
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const locale = url.searchParams.get("locale") === "ar" ? "ar" : "en";
  const next = safeRedirectPath(url.searchParams.get("next")) ?? `/${locale}/onboarding`;

  if (!code) {
    return NextResponse.redirect(new URL(`/${locale}/sign-in?error=missing_code`, url.origin));
  }

  try {
    const supabase = await createServerSupabase();
    if (!supabase) {
      return NextResponse.redirect(new URL(`/${locale}/sign-in?error=not_configured`, url.origin));
    }
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      logServerError("auth.callback", error, {});
      return NextResponse.redirect(new URL(`/${locale}/sign-in?error=exchange_failed`, url.origin));
    }
    return NextResponse.redirect(new URL(next, url.origin));
  } catch (error) {
    logServerError("auth.callback", error, {});
    return NextResponse.redirect(new URL(`/${locale}/sign-in?error=unexpected`, url.origin));
  }
}
