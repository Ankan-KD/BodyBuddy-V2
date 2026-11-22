-- ════════════════════════════════════════════════════════════════════════
-- 003 — Authentication & security
-- Depends on: 001, 002 (public.user_settings). Requires auth.users.
--
--   user_security         server-controlled flags per user (admin / signup state)
--   password_otp_requests custom 6-digit email-OTP flow (verified server-side)
--   helper functions      used only by server API routes (service role)
--   handle_new_user()     trigger that provisions a new account's rows
--
-- Design rule: anything a user must never be able to change about
-- themselves (admin status, "email not yet verified", "has a real
-- password") lives in user_security, which clients can only READ. There is
-- deliberately no insert/update/delete policy on it, so only the service
-- role, the SQL editor and SECURITY DEFINER functions can write to it.
-- (user_settings, by contrast, is freely user-writable.)
-- ════════════════════════════════════════════════════════════════════════

-- ── 1. user_security ────────────────────────────────────────────────────
create table if not exists public.user_security (
  user_id               uuid primary key references auth.users(id) on delete cascade,
  is_store_admin        boolean not null default false,  -- grants every admin RLS policy
  pending_email_verify  boolean not null default false,  -- manual signup whose OTP is not verified yet
  password_set          boolean not null default false,  -- user finished /set-password with a real password
  updated_at            timestamptz not null default now()
);

alter table public.user_security enable row level security;

drop policy if exists "read own security flags" on public.user_security;
create policy "read own security flags" on public.user_security
  for select using (auth.uid() = user_id);
-- No insert/update/delete policy on purpose: clients can never write here.

drop trigger if exists user_security_updated_at on public.user_security;
create trigger user_security_updated_at
  before update on public.user_security
  for each row execute function public.set_updated_at();

-- ── 2. password_otp_requests ────────────────────────────────────────────
-- Custom OTP delivered via Resend. Only server routes using the service-role
-- key touch it. RLS is enabled with NO policies, so the browser's anon /
-- authenticated keys are fully denied.
create table if not exists public.password_otp_requests (
  id                 uuid primary key default gen_random_uuid(),
  email              text not null,
  purpose            text not null check (
                       purpose in ('change_password', 'set_password', 'forgot_password', 'signup_verify')
                     ),
  user_id            uuid references auth.users(id) on delete cascade,
  code_hash          text not null,
  code_salt          text not null,
  attempts           int  not null default 0,
  max_attempts       int  not null default 5,
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

-- ── 3. Server-only helper functions ─────────────────────────────────────
-- SECURITY DEFINER so they can read the auth schema; EXECUTE is revoked from
-- anon/authenticated so only the service role (server API routes) can call them.

-- Does this auth user have a real password? (auth.users.encrypted_password is the only reliable signal.)
create or replace function public.user_has_password(p_user_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public, auth
as $$
  select coalesce(
    (select encrypted_password is not null and encrypted_password <> ''
       from auth.users where id = p_user_id),
    false
  );
$$;

-- Email → user id (forgot-password route).
create or replace function public.get_auth_user_id_by_email(p_email text)
returns uuid
language sql
security definer
set search_path = public, auth
as $$
  select id from auth.users where lower(email) = lower(p_email) limit 1;
$$;

-- user_security.pending_email_verify for a user (false if no row).
create or replace function public.user_pending_email_verify(p_user_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select coalesce(
    (select pending_email_verify from public.user_security where user_id = p_user_id),
    false
  );
$$;

-- Records that the user completed /set-password (called by /api/password/mark-set and /reset).
create or replace function public.mark_password_set(p_user_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.user_security (user_id, password_set)
  values (p_user_id, true)
  on conflict (user_id) do update set password_set = true;
$$;

revoke all on function public.user_has_password(uuid)          from public, anon, authenticated;
revoke all on function public.get_auth_user_id_by_email(text)  from public, anon, authenticated;
revoke all on function public.user_pending_email_verify(uuid)  from public, anon, authenticated;
revoke all on function public.mark_password_set(uuid)          from public, anon, authenticated;
grant execute on function public.user_has_password(uuid)          to service_role;
grant execute on function public.get_auth_user_id_by_email(text)  to service_role;
grant execute on function public.user_pending_email_verify(uuid)  to service_role;
grant execute on function public.mark_password_set(uuid)          to service_role;

-- ── 4. Provision a new account the moment someone signs up ──────────────
-- Creates the user_settings and user_security rows in the same transaction
-- as the auth.users insert, so a fast client can never observe a half-made
-- account. Manual email signups are tagged signup_method = 'manual' in auth
-- metadata and start with pending_email_verify = true (the app then forces
-- the OTP screen); Google sign-ins never carry that tag and start verified.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_settings (user_id, name)
  values (new.id, coalesce(new.raw_user_meta_data->>'name', ''))
  on conflict (user_id) do nothing;

  insert into public.user_security (user_id, pending_email_verify)
  values (new.id, coalesce(new.raw_user_meta_data->>'signup_method', '') = 'manual')
  on conflict (user_id) do nothing;

  return new;
end;
$$;

-- Trigger-only function: stop PostgREST exposing it as a callable RPC.
revoke execute on function public.handle_new_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
