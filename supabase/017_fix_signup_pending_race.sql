-- BodyBuddy — Close the manual-signup "skips OTP" race condition
-- Run this in your Supabase SQL editor AFTER 016_password_set_flag.sql.
--
-- THE BUG:
-- signUpWithEmail() (src/lib/auth.tsx) does two separate things after
-- supabase.auth.signUp() resolves:
--   1. supabase.auth.signUp() itself fires onAuthStateChange the instant it
--      resolves, which makes `user` truthy in React state right away — on
--      the SAME /login page. That immediately triggers the Gate's own
--      checkPasswordState() fetch (AppShell.tsx).
--   2. Only AFTER that does the surrounding function continue to its next
--      line: `await fetch("/api/signup/mark-pending")`, a SEPARATE network
--      round-trip that sets user_settings.pending_email_verify = true.
--
-- These two race. In practice mark-pending (step 2) can take over a
-- second (observed ~1.4s), while the Gate's read (step 1) is often
-- faster. If the read wins, it sees the just-inserted row's DEFAULT
-- pending_email_verify = false (and password_set = false) and concludes
-- "no OTP pending, no password" — sending the user straight to
-- /set-password and skipping the OTP screen entirely.
--
-- THE FIX: stop depending on a slow follow-up network call to set this
-- flag. Set it atomically, INSIDE the same trigger that creates the
-- user_settings row — so there is no window where it's wrong. The row
-- is created server-side, in the same transaction as the auth.users
-- insert, before supabase.auth.signUp() ever resolves on the client.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.user_settings (user_id, name, pending_email_verify)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'name', ''),
    -- signUpWithEmail() (manual signup) tags new accounts with
    -- signup_method: 'manual' in options.data (see src/lib/auth.tsx).
    -- signInWithGoogle() never sets this, so Google accounts correctly
    -- default to false (not pending) here, atomically, at creation time.
    COALESCE(new.raw_user_meta_data->>'signup_method', '') = 'manual'
  )
  ON CONFLICT (user_id) DO NOTHING;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- /api/signup/mark-pending is kept in the codebase as a defense-in-depth
-- fallback (e.g. if the metadata tag were ever missing), but is no longer
-- on the critical path — the trigger above is now the source of truth.
