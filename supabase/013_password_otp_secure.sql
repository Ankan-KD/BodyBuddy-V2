-- BodyBuddy — Secure password / OTP schema
-- Run this in your Supabase project's SQL editor (after 001_core_schema.sql).
--
-- This supersedes the "no schema needed" note in 012_password_otp.sql.
-- The password-management rewrite no longer uses Supabase magic links,
-- signInWithOtp(), or admin-generated recovery links. Instead it uses a
-- custom 6-digit OTP delivered via Resend, verified entirely server-side
-- against the table below.
--
-- Everything here is only ever touched by server-side API routes using the
-- SUPABASE_SERVICE_ROLE_KEY client (src/lib/supabaseAdmin.ts). Row Level
-- Security is enabled with NO policies, so the anon/authenticated keys used
-- by the browser can never read or write this table — only the service
-- role (which bypasses RLS) can, which matches how it's actually used.

create extension if not exists pgcrypto;

create table if not exists public.password_otp_requests (
  id                 uuid primary key default gen_random_uuid(),
  email              text not null,
  purpose            text not null check (purpose in ('change_password', 'set_password', 'forgot_password')),
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

alter table public.password_otp_requests enable row level security;
-- Intentionally no policies — only the service-role key (server-only) can
-- access this table; anon/authenticated clients are fully denied.

-- Housekeeping index for any future cleanup job.
create index if not exists password_otp_requests_expires_idx
  on public.password_otp_requests (expires_at);

-- ── Secure server-side password-state check ────────────────────────────────
-- Returns whether a Supabase Auth user has a password set, by inspecting
-- auth.users.encrypted_password directly (the only reliable signal — an
-- OAuth-only user has this column null/empty, a user who has ever set a
-- password does not). This function is SECURITY DEFINER so it can read the
-- auth schema, but execute is revoked from anon/authenticated — only the
-- service role (used exclusively by our server-side API routes) may call
-- it, so raw password hashes are never exposed to any client.
create or replace function public.user_has_password(p_user_id uuid)
returns boolean
language sql
security definer
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

-- ── Secure server-side email → user id lookup (forgot-password flow) ───────
-- Used only by the forgot-password route to resolve which account an OTP
-- was verified for. Never exposed to the client directly — the client only
-- ever supplies an email address, and can only prove ownership of it by
-- completing the OTP challenge sent to that address's inbox.
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
