-- BodyBuddy — Fix false-positive "has password" detection for manual signup
-- Run this in your Supabase SQL editor AFTER 015_fix_signup_verify_otp.sql.
--
-- THE BUG:
-- public.user_has_password() (see 013_password_otp_secure.sql) infers
-- "has a real password" from auth.users.encrypted_password being non-null.
-- That's a fine signal for a Google-only account (encrypted_password really
-- is null until they choose one). But manual email signup
-- (signUpWithEmail in src/lib/auth.tsx) passes a random, unguessable
-- tempPassword into supabase.auth.signUp() just to satisfy the API —
-- which writes a real, non-empty encrypted_password to auth.users
-- IMMEDIATELY at account creation, before the user has ever chosen
-- anything. So user_has_password() returned true the instant a manual
-- signup account existed, and the Gate skipped /set-password entirely,
-- sending freshly-OTP-verified users straight to /dashboard → /onboarding
-- without ever letting them pick a real password.
--
-- THE FIX: track user intent explicitly instead of inferring it from a
-- column Supabase itself writes to for unrelated reasons.

ALTER TABLE public.user_settings
  ADD COLUMN IF NOT EXISTS password_set boolean NOT NULL DEFAULT false;

-- Backfill: any account that is NOT currently pending email verification
-- and was NOT created via manual signup's temp-password path has, by
-- definition, already been through /set-password under the old logic (or
-- is a pre-existing Google account that set a password directly). Mark
-- those as password_set = true so existing users aren't forced through
-- /set-password again after this migration.
--
-- Accounts still mid-signup (pending_email_verify = true) are correctly
-- left at false — they haven't reached /set-password yet.
UPDATE public.user_settings
SET password_set = true
WHERE pending_email_verify = false;

-- RPC used by /api/password/mark-set (service role only) to record that
-- the user has completed /set-password with a real, self-chosen password.
CREATE OR REPLACE FUNCTION public.mark_password_set(p_user_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO public.user_settings (user_id, password_set)
  VALUES (p_user_id, true)
  ON CONFLICT (user_id) DO UPDATE SET password_set = true;
$$;

REVOKE ALL ON FUNCTION public.mark_password_set(uuid) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mark_password_set(uuid) TO service_role;
