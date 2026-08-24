-- ════════════════════════════════════════════════════════════════════════
-- BB Store Admin — Phase 3: Admin Authentication & Foundation
-- Run this in your Supabase SQL editor AFTER store_schema.sql has been applied.
-- Safe to re-run: all statements use IF NOT EXISTS / OR REPLACE.
-- ════════════════════════════════════════════════════════════════════════

-- ── 1. Ensure is_store_admin column exists on user_settings ──────────────
-- (already added in store_schema.sql, kept here as guard)
alter table public.user_settings
  add column if not exists is_store_admin boolean not null default false;

-- ── 2. Admin Sessions Audit Log ──────────────────────────────────────────
-- Lightweight table to track admin login events.
create table if not exists public.admin_audit_log (
  id          uuid primary key default gen_random_uuid(),
  admin_id    uuid references auth.users(id) on delete set null,
  event_type  text not null,                         -- 'login', 'logout', 'action'
  metadata    jsonb not null default '{}',
  created_at  timestamptz not null default now()
);

create index if not exists admin_audit_log_admin_idx on public.admin_audit_log (admin_id);
create index if not exists admin_audit_log_created_idx on public.admin_audit_log (created_at desc);

-- RLS: only admins can read/write audit log
alter table public.admin_audit_log enable row level security;

drop policy if exists "admin_audit_admin_only" on public.admin_audit_log;
create policy "admin_audit_admin_only" on public.admin_audit_log
  for all using (
    exists (
      select 1 from public.user_settings
      where user_id = auth.uid() and is_store_admin = true
    )
  )
  with check (
    exists (
      select 1 from public.user_settings
      where user_id = auth.uid() and is_store_admin = true
    )
  );

-- ── 3. RLS: user_settings — admins can read any row (needed for is_admin check) ──
-- The existing RLS on user_settings should allow users to read their own row.
-- We also need the admin check function to work. This policy ensures the
-- admin lookup (used inside other policies) can function correctly.
-- Note: if user_settings already has RLS/policies, this adds a new one safely.
drop policy if exists "user_settings_self_read" on public.user_settings;
create policy "user_settings_self_read" on public.user_settings
  for select using (user_id = auth.uid());

-- ── 4. Helper function: is_admin() — callable from policies & API routes ──
create or replace function public.is_store_admin()
returns boolean
language sql
security definer
stable
as $$
  select coalesce(
    (select is_store_admin from public.user_settings where user_id = auth.uid()),
    false
  );
$$;

-- ── 5. HOW TO CREATE THE FIRST ADMIN ACCOUNT ─────────────────────────────
-- After a user signs up normally (via BB Health or the admin login page),
-- run this in the Supabase SQL editor to promote them to admin.
-- Replace the email with your actual admin email address.
--
-- UPDATE public.user_settings
-- SET is_store_admin = true
-- WHERE user_id = (
--   SELECT id FROM auth.users WHERE email = 'your-admin@example.com'
-- );
--
-- That's all that's needed for V1. One admin, one flag.
-- ════════════════════════════════════════════════════════════════════════
