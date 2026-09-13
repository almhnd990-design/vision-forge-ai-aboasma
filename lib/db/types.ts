/**
 * Hand-written types mirroring supabase/migrations.
 *
 * Deliberately not generated: the migration set is small and reviewed, and keeping
 * these in sync by hand avoids a codegen step that cannot run without a live project.
 * If you add a column, update the migration AND this file (see docs/ARCHITECTURE.md).
 */

import type { BillingInterval, BillingStatus, PlanId } from "@/lib/plans";

export type FindingKind = "recovery" | "growth" | "operations" | "risk";
export type Severity = "low" | "medium" | "high" | "critical";

/** The approval state machine. Money-moving actions stop at `approved` until executed by trusted code. */
export type FindingStatus =
  | "detected"
  | "reviewed"
  | "approved"
  | "executing"
  | "completed"
  | "failed"
  | "dismissed";

export type ReviewDecision =
  | "reviewed"
  | "approved"
  | "dismissed"
  | "reopened"
  | "execution_failed";

export type ProviderKey = "stripe" | "shopify" | "amazon" | "gmail";

export type ConnectionStatus = "disconnected" | "connected" | "error" | "revoked";

export type SnapshotSource = "manual" | "import" | "connector";

export type AnalysisStatus =
  | "queued"
  | "running"
  | "deterministic_complete"
  | "ai_complete"
  | "failed";

export type ProfileRow = {
  id: string;
  email: string | null;
  full_name: string | null;
  locale: string;
  created_at: string;
  updated_at: string;
};

export type WorkspaceRow = {
  id: string;
  owner_id: string;
  name: string;
  business_type: string | null;
  primary_goal: string | null;
  onboarding_completed: boolean;
  plan_id: PlanId | null;
  billing_status: BillingStatus;
  billing_interval: BillingInterval | null;
  trial_ends_at: string | null;
  current_period_end: string | null;
  created_at: string;
  updated_at: string;
};

export type BusinessRow = {
  id: string;
  workspace_id: string;
  name: string;
  channel: string | null;
  currency: string;
  is_primary: boolean;
  created_at: string;
  updated_at: string;
};

export type DuplicateChargeCandidate = {
  id: string;
  amountCents: number;
  description: string;
};

export type SnapshotRow = {
  id: string;
  workspace_id: string;
  business_id: string | null;
  source: SnapshotSource;
  provider_key: string | null;
  revenue_cents: number;
  previous_revenue_cents: number;
  refund_pending_cents: number;
  duplicate_charge_candidates: DuplicateChargeCandidate[];
  inventory_days: number | null;
  conversion_rate: number | null;
  previous_conversion_rate: number | null;
  created_by: string;
  created_at: string;
};

export type AnalysisRow = {
  id: string;
  workspace_id: string;
  snapshot_id: string;
  status: AnalysisStatus;
  engine_version: string;
  finding_count: number;
  ai_provider: string | null;
  ai_model: string | null;
  ai_available: boolean;
  ai_notes: string | null;
  error_message: string | null;
  started_at: string;
  completed_at: string | null;
  created_by: string;
};

export type FindingRow = {
  id: string;
  workspace_id: string;
  analysis_id: string;
  kind: FindingKind;
  severity: Severity;
  confidence: number;
  title: string;
  summary: string;
  recommended_action: string | null;
  estimated_impact_cents: number | null;
  requires_approval: boolean;
  /** Deterministic evidence. Never authored by a language model. */
  evidence: string[];
  ai_priority_rank: number | null;
  ai_explanation: string | null;
  ai_next_steps: string[] | null;
  ai_missing_information: string[] | null;
  ai_provider: string | null;
  ai_model: string | null;
  status: FindingStatus;
  decided_by: string | null;
  decided_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ReviewRow = {
  id: string;
  workspace_id: string;
  finding_id: string;
  decision: ReviewDecision;
  note: string | null;
  actor_id: string;
  created_at: string;
};

export type AuditEventRow = {
  id: number;
  workspace_id: string | null;
  actor_id: string | null;
  actor_type: "user" | "system" | "provider";
  action: string;
  target_type: string | null;
  target_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

/** Public connection metadata. Never contains credentials. */
export type ConnectionRow = {
  id: string;
  workspace_id: string;
  provider_key: ProviderKey;
  status: ConnectionStatus;
  external_account_id: string | null;
  external_account_label: string | null;
  scopes: string[];
  last_sync_at: string | null;
  last_sync_status: "ok" | "failed" | null;
  last_error: string | null;
  connected_by: string | null;
  created_at: string;
  updated_at: string;
};

export type BillingCustomerRow = {
  workspace_id: string;
  provider: "stripe";
  customer_id: string;
  subscription_id: string | null;
  price_id: string | null;
  plan_id: PlanId | null;
  billing_interval: BillingInterval | null;
  status: BillingStatus;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  trial_ends_at: string | null;
  last_event_id: string | null;
  created_at: string;
  updated_at: string;
};

export type ScheduledScanJobRow = {
  id: string;
  workspace_id: string;
  business_id: string | null;
  cadence: "daily" | "weekly";
  enabled: boolean;
  next_run_at: string | null;
  last_run_at: string | null;
  last_status: string | null;
  created_at: string;
  updated_at: string;
};
