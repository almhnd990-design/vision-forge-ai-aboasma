"use client";

import { createBrowserClient } from "@supabase/ssr";
import { supabasePublicConfig, isSupabaseConfigured } from "@/lib/config";

/**
 * Browser Supabase client. Uses the anon key only — the service role key must never
 * reach the browser. Returns null when the deployment has no Supabase project, so
 * callers can render an explicit configuration state instead of crashing.
 */
export function createBrowserSupabase() {
  if (!isSupabaseConfigured()) return null;
  return createBrowserClient(
    supabasePublicConfig.url,
    supabasePublicConfig.anonKey,
  );
}
