import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { openSecret, sealSecret, isEncryptionConfigured } from "./crypto";

/**
 * Storage for provider credentials.
 *
 * `connection_secrets` has no RLS policy at all (see migration 0002), so only the
 * service-role client used here can touch it. Credentials are sealed with AES-256-GCM
 * before they ever reach the database, and are never returned to a browser.
 */

export type StoredCredentials = Record<string, string>;

export async function saveCredentials(
  admin: SupabaseClient,
  connectionId: string,
  credentials: StoredCredentials,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  if (!isEncryptionConfigured()) {
    return {
      ok: false,
      reason:
        "CONNECTOR_ENCRYPTION_KEY is not configured, so credentials cannot be stored securely. No credential was saved.",
    };
  }
  const sealed = sealSecret(JSON.stringify(credentials));
  const { error } = await admin.from("connection_secrets").upsert(
    {
      connection_id: connectionId,
      ciphertext: sealed.ciphertext,
      iv: sealed.iv,
      auth_tag: sealed.authTag,
      key_version: sealed.keyVersion,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "connection_id" },
  );
  if (error) return { ok: false, reason: `Could not store credentials: ${error.message}` };
  return { ok: true };
}

export async function loadCredentials(
  admin: SupabaseClient,
  connectionId: string,
): Promise<StoredCredentials | null> {
  const { data, error } = await admin
    .from("connection_secrets")
    .select("ciphertext, iv, auth_tag, key_version")
    .eq("connection_id", connectionId)
    .maybeSingle<{
      ciphertext: string;
      iv: string;
      auth_tag: string;
      key_version: number;
    }>();
  if (error || !data) return null;
  try {
    const plaintext = openSecret({
      ciphertext: data.ciphertext,
      iv: data.iv,
      authTag: data.auth_tag,
      keyVersion: data.key_version,
    });
    const parsed = JSON.parse(plaintext) as unknown;
    if (!parsed || typeof parsed !== "object") return null;
    const out: StoredCredentials = {};
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof v === "string") out[k] = v;
    }
    return out;
  } catch {
    // A rotated or wrong key makes existing ciphertext unreadable. Report it as missing
    // rather than crashing, so the operator is told to reconnect.
    return null;
  }
}

export async function deleteCredentials(
  admin: SupabaseClient,
  connectionId: string,
): Promise<void> {
  await admin.from("connection_secrets").delete().eq("connection_id", connectionId);
}
