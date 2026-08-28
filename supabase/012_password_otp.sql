-- BodyBuddy — Password / OTP migration
-- Run this in your Supabase SQL editor.
-- This file documents the minimal schema changes for the password-management feature.
-- No new tables are required — the feature uses Supabase Auth's built-in OTP email
-- flow (signInWithOtp / verifyOtp) and updateUser for password changes.
-- The server-side OTP store in /api/otp/route.ts is in-process (Map).

-- No schema changes are needed beyond what already exists.
-- Supabase Auth handles password storage internally (auth.users).
-- The app uses:
--   • supabase.auth.signInWithOtp()        → sends 6-digit code email
--   • supabase.auth.verifyOtp()            → verifies the code & creates session
--   • supabase.auth.updateUser({password}) → sets/updates the password
--   • supabase.auth.signInWithPassword()   → verifies current password
--   • user.identities                      → detect if email identity (= has password) exists

-- Ensure "Enable Email OTP" is turned on in:
--   Supabase Dashboard → Authentication → Providers → Email → "Enable email OTP"
-- And set OTP expiry to at least 600 seconds (10 min) to match the app's TTL.
