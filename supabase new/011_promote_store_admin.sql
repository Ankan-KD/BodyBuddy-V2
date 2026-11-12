-- ════════════════════════════════════════════════════════════════════════
-- 011 — Promote a user to BB Store admin
-- Depends on: 002_core_health_schema.sql (user_settings.is_store_admin),
--             003_auth_and_signup_security.sql (self-privilege-escalation
--             trigger — see note below)
--
-- Run this AFTER the target account has already signed up normally in the
-- app. Replace the email below with the real admin's email address before
-- running.
--
-- IMPORTANT: run this in the Supabase SQL editor (or any other connection
-- authenticated as the `postgres` / `service_role` user). The trigger
-- installed in 003_auth_and_signup_security.sql
-- (trg_prevent_self_privilege_escalation) deliberately BLOCKS any ordinary
-- signed-in user (anon/authenticated Postgres role) from setting
-- is_store_admin on their own row — this statement only succeeds because
-- the SQL editor runs as a superuser/service-role session, which the
-- trigger explicitly trusts (see 018_fix_self_admin_escalation.sql /
-- 003_auth_and_signup_security.sql for the full rationale).
-- ════════════════════════════════════════════════════════════════════════

UPDATE public.user_settings
SET is_store_admin = true
WHERE user_id = (
  SELECT id FROM auth.users WHERE email = 'mailid@gmail.com'
);

-- Sanity check — should show is_store_admin = true for the account above:
--   SELECT u.email, s.is_store_admin
--   FROM public.user_settings s
--   JOIN auth.users u ON u.id = s.user_id
--   WHERE u.email = 'mailid@gmail.com';
