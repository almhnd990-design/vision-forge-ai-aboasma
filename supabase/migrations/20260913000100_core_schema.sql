-- =====================================================================
-- GhostOps AI — 0001 core schema
-- Multi-tenant commercial schema. Every tenant-owned row carries
-- workspace_id so Row Level Security can isolate customers.
-- =====================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------
-- Enums (kept as text + check constraints so migrations stay simple)
-- ---------------------------------------------------------------------

create table if not exists public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  email        text,
  full_name    text,
  locale       text not null default 'en' check (locale in ('en', 'ar')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table if not exists public.workspaces (
  id                    uuid primary key default gen_random_uuid(),
  owner_id              uuid not null references auth.users (id) on delete cascade,
  name                  text not null check (char_length(trim(name)) between 1 and 120),
  business_type         text,
  primary_goal          text,
  onboarding_completed  boolean not null default false,
  -- Billing mirror. Written ONLY by trusted server code (service role),
  -- never by the browser. UI reads it to show the current plan.
  plan_id               text check (plan_id in ('starter', 'growth', 'scale')),
  billing_status        text not null default 'none'
                        check (billing_status in ('none','trialing','active','past_due','canceled','incomplete','unpaid','paused')),
  billing_interval      text check (billing_interval in ('month','year')),
  trial_ends_at         timestamptz,
  current_period_end    timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index if not exists workspaces_owner_idx on public.workspaces (owner_id);

create table if not exists public.businesses (
  id             uuid primary key default gen_random_uuid(),
  workspace_id   uuid not null references public.workspaces (id) on delete cascade,
  name           text not null check (char_length(trim(name)) between 1 and 160),
  channel        text,
  currency       text not null default 'SAR',
  is_primary     boolean not null default false,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists businesses_workspace_idx on public.businesses (workspace_id);

-- ---------------------------------------------------------------------
-- Deterministic analysis runs and their findings
-- ---------------------------------------------------------------------

create table if not exists public.snapshots (
  id                            uuid primary key default gen_random_uuid(),
  workspace_id                  uuid not null references public.workspaces (id) on delete cascade,
  business_id                   uuid references public.businesses (id) on delete set null,
  source                        text not null default 'manual'
                                check (source in ('manual','import','connector')),
  provider_key                  text,
  revenue_cents                 bigint not null default 0 check (revenue_cents >= 0),
  previous_revenue_cents        bigint not null default 0 check (previous_revenue_cents >= 0),
  refund_pending_cents          bigint not null default 0 check (refund_pending_cents >= 0),
  duplicate_charge_candidates   jsonb not null default '[]'::jsonb,
  inventory_days                numeric,
  conversion_rate               numeric,
  previous_conversion_rate      numeric,
  created_by                    uuid not null references auth.users (id) on delete cascade,
  created_at                    timestamptz not null default now()
);

create index if not exists snapshots_workspace_created_idx
  on public.snapshots (workspace_id, created_at desc);

-- One analysis run = deterministic engine output (+ optional AI layer output).
create table if not exists public.analyses (
  id                uuid primary key default gen_random_uuid(),
  workspace_id      uuid not null references public.workspaces (id) on delete cascade,
  snapshot_id       uuid not null references public.snapshots (id) on delete cascade,
  status            text not null default 'queued'
                    check (status in ('queued','running','deterministic_complete','ai_complete','failed')),
  engine_version    text not null,
  finding_count     integer not null default 0,
  -- Honest record of which reasoning layer actually ran.
  ai_provider       text,
  ai_model          text,
  ai_available      boolean not null default false,
  ai_notes          text,
  error_message     text,
  started_at        timestamptz not null default now(),
  completed_at      timestamptz,
  created_by        uuid not null references auth.users (id) on delete cascade
);

create index if not exists analyses_workspace_started_idx
  on public.analyses (workspace_id, started_at desc);

/*
 * Findings hold BOTH the frozen deterministic evidence and the optional AI
 * narrative. `evidence` is the source of truth and is never authored by a model.
 * The action state machine is enforced by a check constraint.
 */
create table if not exists public.findings (
  id                    uuid primary key default gen_random_uuid(),
  workspace_id          uuid not null references public.workspaces (id) on delete cascade,
  analysis_id           uuid not null references public.analyses (id) on delete cascade,
  kind                  text not null check (kind in ('recovery','growth','operations','risk')),
  severity              text not null check (severity in ('low','medium','high','critical')),
  confidence            numeric not null check (confidence >= 0 and confidence <= 1),
  title                 text not null,
  summary               text not null,
  recommended_action    text,
  estimated_impact_cents bigint check (estimated_impact_cents >= 0),
  requires_approval     boolean not null default false,
  -- Deterministic evidence, e.g. ["Current revenue: 800000", ...]
  evidence              jsonb not null default '[]'::jsonb,
  -- AI narrative, stored separately so it can never overwrite evidence.
  ai_priority_rank      integer,
  ai_explanation        text,
  ai_next_steps         jsonb,
  ai_missing_information jsonb,
  ai_provider           text,
  ai_model              text,
  status                text not null default 'detected'
                        check (status in ('detected','reviewed','approved','executing','completed','failed','dismissed')),
  decided_by            uuid references auth.users (id) on delete set null,
  decided_at            timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index if not exists findings_workspace_status_idx
  on public.findings (workspace_id, status, created_at desc);
create index if not exists findings_analysis_idx on public.findings (analysis_id);

-- Append-only decisions per finding (a review can be reopened).
create table if not exists public.reviews (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references public.workspaces (id) on delete cascade,
  finding_id    uuid not null references public.findings (id) on delete cascade,
  decision      text not null check (decision in ('reviewed','approved','dismissed','reopened','execution_failed')),
  note          text,
  actor_id      uuid not null references auth.users (id) on delete cascade,
  created_at    timestamptz not null default now()
);

create index if not exists reviews_finding_idx on public.reviews (finding_id, created_at desc);

-- ---------------------------------------------------------------------
-- Audit trail (append-only, server-written)
-- ---------------------------------------------------------------------

create table if not exists public.audit_events (
  id             bigserial primary key,
  workspace_id   uuid references public.workspaces (id) on delete cascade,
  actor_id       uuid references auth.users (id) on delete set null,
  actor_type     text not null default 'user' check (actor_type in ('user','system','provider')),
  action         text not null,
  target_type    text,
  target_id      text,
  metadata       jsonb not null default '{}'::jsonb,
  created_at     timestamptz not null default now()
);

create index if not exists audit_events_workspace_idx
  on public.audit_events (workspace_id, created_at desc);

-- ---------------------------------------------------------------------
-- Provider connections (metadata is readable by the owner; secrets are not)
-- ---------------------------------------------------------------------

-- Public metadata for a connection. Contains NO credentials.
create table if not exists public.connections (
  id                     uuid primary key default gen_random_uuid(),
  workspace_id           uuid not null references public.workspaces (id) on delete cascade,
  provider_key           text not null check (provider_key in ('stripe','shopify','amazon','gmail')),
  status                 text not null default 'disconnected'
                         check (status in ('disconnected','connected','error','revoked')),
  external_account_id    text,
  external_account_label text,
  scopes                 jsonb not null default '[]'::jsonb,
  last_sync_at           timestamptz,
  last_sync_status       text check (last_sync_status in ('ok','failed')),
  last_error             text,
  connected_by           uuid references auth.users (id) on delete set null,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  unique (workspace_id, provider_key)
);

create index if not exists connections_workspace_idx on public.connections (workspace_id);

/*
 * Credentials live in a separate table with NO row level security policy at all.
 * That means neither anon nor authenticated clients can read it — only the
 * service-role key used by trusted server code. Tokens are stored encrypted by
 * the application before insert.
 */
create table if not exists public.connection_secrets (
  connection_id     uuid primary key references public.connections (id) on delete cascade,
  ciphertext        text not null,
  iv                text not null,
  auth_tag          text not null,
  key_version       integer not null default 1,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Usage metering (server-written) — enforces plan limits
-- ---------------------------------------------------------------------

create table if not exists public.usage_events (
  id            bigserial primary key,
  workspace_id  uuid not null references public.workspaces (id) on delete cascade,
  kind          text not null check (kind in ('analysis')),
  quantity      integer not null default 1 check (quantity > 0),
  period_start  date not null,
  actor_id      uuid references auth.users (id) on delete set null,
  created_at    timestamptz not null default now()
);

create index if not exists usage_events_workspace_period_idx
  on public.usage_events (workspace_id, period_start);

-- ---------------------------------------------------------------------
-- Billing mirror (server-written from verified webhooks only)
-- ---------------------------------------------------------------------

create table if not exists public.billing_customers (
  workspace_id        uuid primary key references public.workspaces (id) on delete cascade,
  provider            text not null default 'stripe' check (provider in ('stripe')),
  customer_id         text not null,
  subscription_id     text,
  price_id            text,
  plan_id             text check (plan_id in ('starter','growth','scale')),
  billing_interval    text check (billing_interval in ('month','year')),
  status              text not null default 'none',
  current_period_end  timestamptz,
  cancel_at_period_end boolean not null default false,
  trial_ends_at       timestamptz,
  last_event_id       text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (provider, customer_id)
);

create unique index if not exists billing_customers_subscription_idx
  on public.billing_customers (provider, subscription_id)
  where subscription_id is not null;

/*
 * Webhook idempotency ledger. A provider event may only be applied once, which
 * prevents duplicate subscription writes from retried deliveries.
 */
create table if not exists public.billing_events (
  provider     text not null default 'stripe',
  event_id     text not null,
  event_type   text not null,
  received_at  timestamptz not null default now(),
  processed_at timestamptz,
  status       text not null default 'received'
               check (status in ('received','processed','ignored','failed')),
  error        text,
  primary key (provider, event_id)
);

-- ---------------------------------------------------------------------
-- Background work stub: schema only, no scheduler is running yet.
-- ---------------------------------------------------------------------

create table if not exists public.scheduled_scan_jobs (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references public.workspaces (id) on delete cascade,
  business_id   uuid references public.businesses (id) on delete cascade,
  cadence       text not null default 'daily' check (cadence in ('daily','weekly')),
  enabled       boolean not null default false,
  next_run_at   timestamptz,
  last_run_at   timestamptz,
  last_status   text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- updated_at maintenance
-- ---------------------------------------------------------------------

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'profiles','workspaces','businesses','findings','connections',
    'billing_customers','scheduled_scan_jobs'
  ]
  loop
    execute format('drop trigger if exists set_updated_at on public.%I', t);
    execute format(
      'create trigger set_updated_at before update on public.%I
         for each row execute function public.touch_updated_at()', t);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------
-- New auth user -> profile row
-- ---------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, locale)
  values (
    new.id,
    new.email,
    nullif(trim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), ''),
    case when new.raw_user_meta_data ->> 'locale' = 'ar' then 'ar' else 'en' end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
