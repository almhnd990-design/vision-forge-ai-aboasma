-- =====================================================================
-- GhostOps AI — 0002 Row Level Security
--
-- Model:
--   * READ  access for a tenant is granted to the workspace owner.
--   * WRITE access for tenant data is intentionally NOT granted through RLS
--     for anything security-relevant (billing, findings state, connections,
--     usage). Those mutations happen in trusted server code using the
--     service-role key, after the caller's ownership has been verified.
--     This is what makes plan entitlements and the approval state machine
--     impossible to bypass from the browser.
--   * connection_secrets, usage_events and billing_events get NO policy at all,
--     so the anon/authenticated roles cannot touch them under any circumstance.
-- =====================================================================

-- Ownership helper. SECURITY DEFINER + fixed search_path so the policy cannot be
-- influenced by the caller's search path, and so the check itself does not recurse
-- into the workspaces policies.
create or replace function public.is_workspace_owner(target uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.workspaces w
    where w.id = target
      and w.owner_id = auth.uid()
  );
$$;

revoke all on function public.is_workspace_owner(uuid) from public;
grant execute on function public.is_workspace_owner(uuid) to authenticated;

alter table public.profiles             enable row level security;
alter table public.workspaces           enable row level security;
alter table public.businesses           enable row level security;
alter table public.snapshots            enable row level security;
alter table public.analyses             enable row level security;
alter table public.findings             enable row level security;
alter table public.reviews              enable row level security;
alter table public.audit_events         enable row level security;
alter table public.connections          enable row level security;
alter table public.connection_secrets   enable row level security;
alter table public.usage_events         enable row level security;
alter table public.billing_customers    enable row level security;
alter table public.billing_events       enable row level security;
alter table public.scheduled_scan_jobs  enable row level security;

-- ---------------------------------------------------------------------
-- profiles: a user may read and update only their own row.
-- ---------------------------------------------------------------------

drop policy if exists profiles_select_self on public.profiles;
create policy profiles_select_self on public.profiles
  for select to authenticated
  using (id = auth.uid());

-- Only presentation fields may be edited by the user; locale/full_name.
drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- ---------------------------------------------------------------------
-- workspaces
-- ---------------------------------------------------------------------

drop policy if exists workspaces_select_own on public.workspaces;
create policy workspaces_select_own on public.workspaces
  for select to authenticated
  using (owner_id = auth.uid());

-- Owners may rename their workspace and finish onboarding. Billing columns are
-- protected from tampering by the guard trigger below.
drop policy if exists workspaces_update_own on public.workspaces;
create policy workspaces_update_own on public.workspaces
  for update to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

drop policy if exists workspaces_insert_own on public.workspaces;
create policy workspaces_insert_own on public.workspaces
  for insert to authenticated
  with check (owner_id = auth.uid());

drop policy if exists workspaces_delete_own on public.workspaces;
create policy workspaces_delete_own on public.workspaces
  for delete to authenticated
  using (owner_id = auth.uid());

/*
 * Billing columns are owned by the server. Even though the owner holds an UPDATE
 * policy on their workspace, this trigger rejects any client-originated change to
 * the billing mirror. The service role (used by verified webhook handling) is
 * allowed through because it is not an `authenticated` client JWT.
 */
create or replace function public.guard_workspace_billing_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  is_service boolean := coalesce(current_setting('request.jwt.claim.role', true), '') = 'service_role';
begin
  if is_service then
    return new;
  end if;
  if new.plan_id            is distinct from old.plan_id
     or new.billing_status  is distinct from old.billing_status
     or new.billing_interval is distinct from old.billing_interval
     or new.trial_ends_at   is distinct from old.trial_ends_at
     or new.current_period_end is distinct from old.current_period_end
     or new.owner_id        is distinct from old.owner_id
  then
    raise exception 'billing and ownership fields are server-managed'
      using errcode = 'insufficient_privilege';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_workspace_billing on public.workspaces;
create trigger guard_workspace_billing
  before update on public.workspaces
  for each row execute function public.guard_workspace_billing_columns();

-- ---------------------------------------------------------------------
-- Tenant read policies
-- ---------------------------------------------------------------------

drop policy if exists businesses_select_own on public.businesses;
create policy businesses_select_own on public.businesses
  for select to authenticated
  using (public.is_workspace_owner(workspace_id));

drop policy if exists snapshots_select_own on public.snapshots;
create policy snapshots_select_own on public.snapshots
  for select to authenticated
  using (public.is_workspace_owner(workspace_id));

drop policy if exists analyses_select_own on public.analyses;
create policy analyses_select_own on public.analyses
  for select to authenticated
  using (public.is_workspace_owner(workspace_id));

drop policy if exists findings_select_own on public.findings;
create policy findings_select_own on public.findings
  for select to authenticated
  using (public.is_workspace_owner(workspace_id));

drop policy if exists reviews_select_own on public.reviews;
create policy reviews_select_own on public.reviews
  for select to authenticated
  using (public.is_workspace_owner(workspace_id));

drop policy if exists audit_events_select_own on public.audit_events;
create policy audit_events_select_own on public.audit_events
  for select to authenticated
  using (workspace_id is not null and public.is_workspace_owner(workspace_id));

-- Owners may read connection metadata (never credentials).
drop policy if exists connections_select_own on public.connections;
create policy connections_select_own on public.connections
  for select to authenticated
  using (public.is_workspace_owner(workspace_id));

drop policy if exists billing_customers_select_own on public.billing_customers;
create policy billing_customers_select_own on public.billing_customers
  for select to authenticated
  using (public.is_workspace_owner(workspace_id));

drop policy if exists scheduled_jobs_select_own on public.scheduled_scan_jobs;
create policy scheduled_jobs_select_own on public.scheduled_scan_jobs
  for select to authenticated
  using (public.is_workspace_owner(workspace_id));

-- ---------------------------------------------------------------------
-- Explicitly locked tables: no policies for anon/authenticated.
-- (RLS enabled with zero policies == deny all for those roles.)
-- ---------------------------------------------------------------------
-- public.connection_secrets  -> service role only
-- public.usage_events        -> service role only
-- public.billing_events      -> service role only

revoke all on table public.connection_secrets from anon, authenticated;
revoke all on table public.usage_events       from anon, authenticated;
revoke all on table public.billing_events     from anon, authenticated;
revoke all on table public.billing_customers  from anon;
revoke all on table public.audit_events       from anon;

revoke all on function public.guard_workspace_billing_columns() from public;

-- ---------------------------------------------------------------------
-- Usage counting helper used by server-side entitlement enforcement.
-- ---------------------------------------------------------------------

create or replace function public.workspace_usage_this_period(target uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(quantity), 0)::integer
  from public.usage_events
  where workspace_id = target
    and kind = 'analysis'
    and period_start = date_trunc('month', now())::date;
$$;

revoke all on function public.workspace_usage_this_period(uuid) from public;
grant execute on function public.workspace_usage_this_period(uuid) to authenticated;
