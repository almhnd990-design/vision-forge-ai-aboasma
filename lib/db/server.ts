import "server-only";

import { cookies } from "next/headers";
import {
  createServerClient,
  type CookieOptions,
} from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { supabasePublicConfig, isSupabaseConfigured } from "@/lib/config";

type CookieToSet = { name: string; value: string; options: CookieOptions };

/**
 * Request-scoped Supabase client bound to the caller's cookies.
 * Row Level Security applies: this client can only see the caller's own rows.
 * Returns null when the deployment has no Supabase project.
 */
export async function createServerSupabase(): Promise<SupabaseClient | null> {
  if (!isSupabaseConfigured()) return null;
  const cookieStore = await cookies();
  return createServerClient(
    supabasePublicConfig.url,
    supabasePublicConfig.anonKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Called from a Server Component render: cookie writes are not allowed.
            // Session refresh is handled by middleware instead.
          }
        },
      },
    },
  );
}

/**
 * Service-role client. BYPASSES Row Level Security.
 *
 * Use only after the caller's ownership of the affected rows has been verified with
 * the request-scoped client. Never import this from a Client Component.
 */
export function createServiceSupabase(): SupabaseClient | null {
  const url = supabasePublicConfig.url;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!isSupabaseConfigured() || !serviceKey || !serviceKey.trim()) return null;
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
