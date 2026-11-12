-- ════════════════════════════════════════════════════════════════════════
-- 006 — BB Store: Admin Foundation
-- Depends on: 002_core_health_schema.sql (user_settings.is_store_admin)
--
-- RLS/policies for admin_audit_log live in 007_store_security_rls.sql
-- alongside every other store policy, for a single auditable location.
-- ════════════════════════════════════════════════════════════════════════

-- ════════════════════════════════════════════════════════════════════════
-- 1. ADMIN SESSIONS AUDIT LOG
-- Lightweight table to track admin login/action events.
-- ════════════════════════════════════════════════════════════════════════

create table if not exists public.admin_audit_log (
  id          uuid primary key default gen_random_uuid(),
  admin_id    uuid references auth.users(id) on delete set null,
  event_type  text not null,        -- 'login', 'logout', 'action'
  metadata    jsonb not null default '{}',
  created_at  timestamptz not null default now()
);

create index if not exists admin_audit_log_admin_idx on public.admin_audit_log (admin_id);
create index if not exists admin_audit_log_created_idx on public.admin_audit_log (created_at desc);

-- ════════════════════════════════════════════════════════════════════════
-- 2. is_store_admin() — HELPER FUNCTION
-- Callable from policies & API routes. Not currently referenced by any
-- RLS policy in this project (every policy inlines its own `exists
-- (select 1 from user_settings where ...)` check instead), and not called
-- from application code — EXECUTE is revoked from anon/authenticated
-- accordingly (021_harden_functions_and_search_path.sql).
-- ════════════════════════════════════════════════════════════════════════

create or replace function public.is_store_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select coalesce(
    (select is_store_admin from public.user_settings where user_id = auth.uid()),
    false
  );
$$;

revoke execute on function public.is_store_admin() from public, anon, authenticated;

-- ════════════════════════════════════════════════════════════════════════
-- 3. HOW TO CREATE THE FIRST ADMIN ACCOUNT
-- After a user signs up normally, run this in the Supabase SQL editor
-- (or use 011_promote_store_admin.sql, which does exactly this) to
-- promote them to admin:
--
-- UPDATE public.user_settings
-- SET is_store_admin = true
-- WHERE user_id = (
--   SELECT id FROM auth.users WHERE email = 'your-admin@example.com'
-- );
--
-- Must be run as the postgres/service_role user (e.g. via the SQL editor)
-- — see the self-privilege-escalation trigger in
-- 003_auth_and_signup_security.sql, which blocks this exact statement for
-- any ordinary signed-in user.
-- ════════════════════════════════════════════════════════════════════════
