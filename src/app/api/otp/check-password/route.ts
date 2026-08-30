import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

/**
 * POST /api/otp/check-password
 * Authorization: Bearer <access_token>
 *
 * Returns { hasPassword: boolean, pendingEmailVerify: boolean }.
 *
 * hasPassword        — from user_settings.password_set (see
 *                      supabase/016_password_set_flag.sql). This is
 *                      explicitly recorded by /api/password/mark-set right
 *                      after the user completes /set-password.
 *                      NOT derived from auth.users.encrypted_password:
 *                      manual signup (src/lib/auth.tsx signUpWithEmail)
 *                      writes a random temp password there at account
 *                      creation just to satisfy signUp()'s API, so that
 *                      column is non-null from the very start and can't
 *                      distinguish "chose a real password" from "we
 *                      generated junk internally."
 * pendingEmailVerify — from user_settings.pending_email_verify; true only for
 *                      manual-signup accounts that haven't yet completed OTP
 *                      email verification. Google accounts are never pending.
 *
 * Neither raw password hash nor OTP code is ever returned to the client.
 */
export async function POST(req: NextRequest) {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Server misconfigured." }, { status: 500 });
  }

  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  if (!token) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token);
  if (userErr || !userData?.user) {
    // Log the real reason — this was previously swallowed, which made a
    // failing token/session impossible to diagnose from the server side.
    console.error("[check-password] getUser failed:", userErr?.message ?? "no user returned");
    return NextResponse.json({ error: "Invalid token." }, { status: 401 });
  }

  const userId = userData.user.id;

  const { data: settings, error: settingsErr } = await supabaseAdmin
    .from("user_settings")
    .select("pending_email_verify, password_set")
    .eq("user_id", userId)
    .maybeSingle();

  if (settingsErr) {
    console.error("[check-password] user_settings lookup failed:", settingsErr.message);
    return NextResponse.json({ error: "Failed to check password state." }, { status: 500 });
  }

  // No user_settings row yet (trigger hasn't fired) → definitely no
  // password set yet and definitely not mid-OTP-verification.
  const hasPassword = Boolean(settings?.password_set);
  const pendingEmailVerify = Boolean(settings?.pending_email_verify);

  return NextResponse.json({ hasPassword, pendingEmailVerify });
}
