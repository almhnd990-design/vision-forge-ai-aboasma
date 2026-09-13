import "server-only";

import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";

/**
 * Envelope encryption for provider credentials.
 *
 * Provider secrets (Stripe restricted keys, and later OAuth refresh tokens) must never
 * sit in plaintext in the database, in browser storage, or in logs. They are encrypted
 * with AES-256-GCM before insert and only ever decrypted inside trusted server code.
 *
 * Key management: `CONNECTOR_ENCRYPTION_KEY` is a 32-byte secret supplied as hex (64
 * chars) or base64. `key_version` is stored alongside the ciphertext so keys can be
 * rotated without losing existing connections.
 */

const ALGORITHM = "aes-256-gcm";
export const CURRENT_KEY_VERSION = 1;

export type SealedSecret = {
  ciphertext: string;
  iv: string;
  authTag: string;
  keyVersion: number;
};

export class EncryptionNotConfiguredError extends Error {
  readonly requiredEnv = ["CONNECTOR_ENCRYPTION_KEY"];
  constructor() {
    super(
      "CONNECTOR_ENCRYPTION_KEY is not configured, so provider credentials cannot be stored securely.",
    );
    this.name = "EncryptionNotConfiguredError";
  }
}

function loadKey(): Buffer {
  const raw = (process.env.CONNECTOR_ENCRYPTION_KEY ?? "").trim();
  if (!raw) throw new EncryptionNotConfiguredError();

  let key: Buffer;
  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    key = Buffer.from(raw, "hex");
  } else {
    try {
      key = Buffer.from(raw, "base64");
    } catch {
      throw new Error(
        "CONNECTOR_ENCRYPTION_KEY must be 32 bytes encoded as hex (64 chars) or base64.",
      );
    }
  }
  if (key.length !== 32) {
    throw new Error(
      "CONNECTOR_ENCRYPTION_KEY must decode to exactly 32 bytes for AES-256-GCM.",
    );
  }
  return key;
}

export function isEncryptionConfigured(): boolean {
  try {
    loadKey();
    return true;
  } catch {
    return false;
  }
}

/** Stable, non-reversible fingerprint used for audit logs instead of the secret. */
export function fingerprint(secret: string): string {
  return createHash("sha256").update(secret).digest("hex").slice(0, 12);
}

export function sealSecret(plaintext: string): SealedSecret {
  const key = loadKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  return {
    ciphertext: ciphertext.toString("base64"),
    iv: iv.toString("base64"),
    authTag: cipher.getAuthTag().toString("base64"),
    keyVersion: CURRENT_KEY_VERSION,
  };
}

export function openSecret(sealed: SealedSecret): string {
  const key = loadKey();
  const decipher = createDecipheriv(
    ALGORITHM,
    key,
    Buffer.from(sealed.iv, "base64"),
  );
  decipher.setAuthTag(Buffer.from(sealed.authTag, "base64"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(sealed.ciphertext, "base64")),
    decipher.final(),
  ]);
  return plaintext.toString("utf8");
}
