-- ════════════════════════════════════════════════════════════════════════
-- 003 — Authentication & Signup Security
-- Depends on: 001_extensions_and_shared_functions.sql,
--             002_core_health_schema.sql (public.user_settings)
--
-- Covers the custom OTP / password-management flow (no Supabase magic
-- links or admin-generated recovery links), the auto-create-settings-row
-- trigger on signup, and the self-privilege-escalation protection on
-- public.user_settings.
--
-- CONSOLIDATION NOTE — final-state determination:
--   public.handle_new_user() was defined three times across the original
--   history:
--     1. 001_core_schema.sql            — original version (no pending flag)
--     2. 017_fix_signup_pending_race.sql — CREATE OR REPLACE, adds the
--        atomic pending_email_verify insert to close a signup race
--        condition (see comment below). This is the FINAL, correct version
--        and is the only one reproduced here.
--     3. 021_harden_functions_and_search_path.sql only pins search_path —
--        already present inline in version 2's `SET search_path = public`,
--        so that ALTER was a no-op by the time it ran. Not reproduced as a
--        separate statement; folded into the CREATE OR REPLACE below.
--   Nothing from version 1 is lost: version 2 is a strict superset of it.
-- ════════════════════════════════════════════════════════════════════════

-- ════════════════════════════════════════════════════════════════════════
-- 1. PASSWORD / OTP REQUESTS
-- Custom 6/8-digit OTP delivered via Resend, verified entirely server-side.
-- Everything here is only ever touched by server-side API routes using the
-- SUPABASE_SERVICE_ROLE_KEY client (src/lib/supabaseAdmin.ts). RLS is
-- enabled with NO policies, so the anon/authenticated keys used by the
-- browser can never read or write this table at all.
-- ════════════════════════════════════════════════════════════════════════

create table if not exists public.password_otp_requests (
  id                 uuid primary key default gen_random_uuid(),
  email              text not null,
  -- 'signup_verify' was added by 015_fix_signup_verify_otp.sql to fix a
  -- 23514 check violation on manual-signup OTPs; folded directly into the
  -- final constraint below.
  purpose            text not null check (
                        purpose in ('change_password', 'set_password', 'forgot_password', 'signup_verify')
                      ),
  user_id            uuid references auth.users(id) on delete cascade,
  code_hash          text not null,
  code_salt          text not null,
  attempts           int not null default 0,
  max_attempts       int not null default 5,
  expires_at         timestamptz not null,
  verify_token_hash  text,
  verify_expires_at  timestamptz,
  consumed           boolean not null default false,
  last_sent_at       timestamptz not null default now(),
  created_at         timestamptz not null default now(),
  unique (email, purpose)
);

create index if not exists password_otp_requests_expires_idx
  on public.password_otp_requests (expires_at);

alter table public.password_otp_requests enable row level security;
-- Intentionally no policies — only the service-role key (server-only) can
-- access this table; anon/authenticated clients are fully denied.

-- ════════════════════════════════════════════════════════════════════════
-- 2. SECURE SERVER-SIDE HELPER FUNCTIONS
-- SECURITY DEFINER so they can read the auth schema, but EXECUTE is
-- revoked from anon/authenticated — only the service role (used
-- exclusively by server-side API routes) may call them.
-- ════════════════════════════════════════════════════════════════════════

-- Whether a Supabase Auth user has a real password set, by inspecting
-- auth.users.encrypted_password directly (the only reliable signal).
create or replace function public.user_has_password(p_user_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public, auth
as $$
  select coalesce(
    (select encrypted_password is not null and encrypted_password <> ''
     from auth.users
     where id = p_user_id),
    false
  );
$$;

revoke all on function public.user_has_password(uuid) from public, anon, authenticated;
grant execute on function public.user_has_password(uuid) to service_role;

-- Email → user id lookup, used only by the forgot-password route to
-- resolve which account an OTP was verified for.
create or replace function public.get_auth_user_id_by_email(p_email text)
returns uuid
language sql
security definer
set search_path = public, auth
as $$
  select id from auth.users where lower(email) = lower(p_email) limit 1;
$$;

revoke all on function public.get_auth_user_id_by_email(text) from public, anon, authenticated;
grant execute on function public.get_auth_user_id_by_email(text) to service_role;

-- Reads user_settings.pending_email_verify (see column definition and
-- comment in 002_core_health_schema.sql).
create or replace function public.user_pending_email_verify(p_user_id uuid)
returns boolean
language sql
security definer
set search_path = public, auth
as $$
  select coalesce(
    (select pending_email_verify from public.user_settings where user_id = p_user_id),
    false
  );
$$;

revoke all on function public.user_pending_email_verify(uuid) from public, anon, authenticated;
grant execute on function public.user_pending_email_verify(uuid) to service_role;

-- Records that the user has completed /set-password with a real,
-- self-chosen password (used by /api/password/mark-set, service role only).
create or replace function public.mark_password_set(p_user_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.user_settings (user_id, password_set)
  values (p_user_id, true)
  on conflict (user_id) do update set password_set = true;
$$;

revoke all on function public.mark_password_set(uuid) from public, anon, authenticated;
grant execute on function public.mark_password_set(uuid) to service_role;

-- ════════════════════════════════════════════════════════════════════════
-- 3. AUTO-CREATE A SETTINGS ROW THE MOMENT SOMEONE SIGNS UP
--
-- pending_email_verify is set ATOMICALLY here, inside the same trigger
-- that creates the user_settings row (same transaction as the auth.users
-- insert), instead of via a slower follow-up API call — closing a race
-- condition where a fast client-side read could see the row before the
-- follow-up call marked it pending, and skip the OTP screen entirely.
-- signUpWithEmail() (manual signup) tags new accounts with
-- signup_method: 'manual' in auth metadata; Google sign-in never sets this,
-- so Google accounts correctly default to pending_email_verify = false.
-- ════════════════════════════════════════════════════════════════════════

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_settings (user_id, name, pending_email_verify)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', ''),
    coalesce(new.raw_user_meta_data->>'signup_method', '') = 'manual'
  )
  on conflict (user_id) do nothing;
  return new;
end;
$$;

-- This is a trigger-only function — Postgres/PostgREST would otherwise
-- auto-expose it as a callable RPC endpoint to anon/authenticated.
revoke execute on function public.handle_new_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ════════════════════════════════════════════════════════════════════════
-- 4. SELF-PRIVILEGE-ESCALATION PROTECTION
--
-- THE BUG this closes: the "own settings" RLS policy on user_settings
-- (see 002_core_health_schema.sql) only checks WHICH ROW is being
-- touched — not WHICH COLUMNS. Every admin-gated store policy trusts
-- is_store_admin = true on this table, so without this trigger any
-- signed-in user could run, from devtools:
--   supabase.from('user_settings').update({ is_store_admin: true }).eq('user_id', myId)
-- ...and grant themselves full store-admin access. The same gap applies
-- to pending_email_verify and password_set (bypassing OTP / forced
-- password creation).
--
-- THE FIX: block changes to these three security-relevant columns unless
-- the write comes from (a) the service-role key, (b) the Supabase SQL
-- editor / a superuser session, or (c) an acting user who is already a
-- store admin. Everything else on user_settings (goals, name, units,
-- theme, etc.) is untouched.
-- ════════════════════════════════════════════════════════════════════════

create or replace function public.prevent_self_privilege_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  acting_is_admin boolean;
begin
  if auth.role() = 'service_role' or current_user in ('postgres', 'service_role') then
    return new;
  end if;

  select coalesce(is_store_admin, false)
    into acting_is_admin
    from public.user_settings
   where user_id = auth.uid();

  if not coalesce(acting_is_admin, false) then
    if new.is_store_admin is distinct from old.is_store_admin then
      raise exception 'Not authorized to change is_store_admin';
    end if;
    if new.pending_email_verify is distinct from old.pending_email_verify then
      raise exception 'Not authorized to change pending_email_verify';
    end if;
    if new.password_set is distinct from old.password_set then
      raise exception 'Not authorized to change password_set';
    end if;
  end if;

  return new;
end;
$$;

revoke execute on function public.prevent_self_privilege_escalation() from public, anon, authenticated;

drop trigger if exists trg_prevent_self_privilege_escalation on public.user_settings;
create trigger trg_prevent_self_privilege_escalation
  before update on public.user_settings
  for each row
  execute function public.prevent_self_privilege_escalation();

-- Sanity check after applying: as a normal signed-in (non-admin) user,
--   update public.user_settings set is_store_admin = true where user_id = auth.uid();
-- should raise "Not authorized to change is_store_admin", while updating
-- e.g. `name` or `calorie_goal` on your own row still works normally.
