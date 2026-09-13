import type { BusinessSnapshot } from "@/lib/agent/types";
import type { ProviderKey } from "@/lib/db/types";

/**
 * Provider connector framework.
 *
 * Rules every connector must follow:
 *  1. `status` decides what the UI may offer. A `planned` connector must never render
 *     a working "Connect" control — only a "Coming soon" state.
 *  2. A connector may only produce a business snapshot from data the provider actually
 *     returned. Missing values stay `undefined`; they are never estimated or filled in.
 *  3. Credentials are passed in already decrypted, used for the duration of the call,
 *     and never logged, echoed back, or persisted in plaintext.
 */

export type ConnectorStatus = "live" | "planned";

export type CredentialField = {
  name: string;
  label: { en: string; ar: string };
  help: { en: string; ar: string };
  secret: boolean;
  placeholder?: string;
};

export type SnapshotDraft = {
  snapshot: BusinessSnapshot;
  /** Human-readable provenance for the audit trail (no secrets). */
  provenance: {
    windowStart: string;
    windowEnd: string;
    recordCount: number;
    notes: string[];
  };
};

export type VerificationResult = {
  accountId: string;
  accountLabel: string;
  /** Scopes or capabilities actually confirmed by the provider. */
  scopes: string[];
  warnings: string[];
};

export type ConnectorFailure = {
  ok: false;
  code:
    | "not_configured"
    | "invalid_credentials"
    | "insufficient_permissions"
    | "provider_unavailable"
    | "rate_limited"
    | "no_data";
  /** Operator-facing message. Must never contain the credential itself. */
  message: string;
};

export type ConnectorSuccess<T> = { ok: true; data: T };
export type ConnectorResult<T> = ConnectorSuccess<T> | ConnectorFailure;

export type ConnectorSpec = {
  key: ProviderKey;
  status: ConnectorStatus;
  name: { en: string; ar: string };
  /** What the connector actually reads. */
  reads: { en: string; ar: string };
  /** What it explicitly does NOT do. */
  doesNot: { en: string; ar: string }[];
  credentialFields: CredentialField[];
  requiresEncryptionKey: boolean;
  /** Environment variables the operator must set to enable this connector. */
  requiredEnv: string[];
  /** True when this connector moves money or changes provider state. Always false today. */
  performsWrites: boolean;
};

export interface ProviderConnector {
  spec: ConnectorSpec;
  /** Confirm the credential works and return the linked account identity. */
  verify(credentials: Record<string, string>): Promise<ConnectorResult<VerificationResult>>;
  /** Build a business snapshot from provider data for the given window. */
  buildSnapshot(
    credentials: Record<string, string>,
    options: { days: number },
  ): Promise<ConnectorResult<SnapshotDraft>>;
}
