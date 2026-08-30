-- BodyBuddy — Fix OTP purpose constraint + 8-digit OTPs + pending email verify
-- Run this in your Supabase SQL editor AFTER 013_password_otp_secure.sql.
--
-- Fixes:
--   1. The check constraint on password_otp_requests.purpose was missing
--      'signup_verify', causing a 23514 violation whenever a manual-signup
--      OTP was issued. Added here.
--   2. OTP length is now 8 digits (enforced in application code).
--   3. Adds pending_email_verify to user_settings so the Gate can block
--      manual-signup users from the webapp until both OTP verification AND
--      password creation are complete.

-- ── 1. Fix the purpose check constraint ────────────────────────────────────
ALTER TABLE public.password_otp_requests
  DROP CONSTRAINT IF EXISTS password_otp_requests_purpose_check;

ALTER TABLE public.password_otp_requests
  ADD CONSTRAINT password_otp_requests_purpose_check
  CHECK (purpose IN ('change_password', 'set_password', 'forgot_password', 'signup_verify'));

-- ── 2. Add pending_email_verify to user_settings ───────────────────────────
-- TRUE  = this account was created by manual email signup and the user has
--         NOT yet completed email OTP verification. The Gate blocks webapp
--         access and forces the user back to /login (OTP screen).
-- FALSE = email verified (or Google account — Google verifies email itself).
ALTER TABLE public.user_settings
  ADD COLUMN IF NOT EXISTS pending_email_verify boolean NOT NULL DEFAULT false;

-- ── 3. RPC to read the flag (SECURITY DEFINER — service role only) ─────────
CREATE OR REPLACE FUNCTION public.user_pending_email_verify(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT COALESCE(
    (SELECT pending_email_verify FROM public.user_settings WHERE user_id = p_user_id),
    false
  );
$$;

REVOKE ALL ON FUNCTION public.user_pending_email_verify(uuid) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.user_pending_email_verify(uuid) TO service_role;
