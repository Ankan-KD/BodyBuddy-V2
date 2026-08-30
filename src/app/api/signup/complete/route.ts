import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { consumeSignupVerifyTicket } from "@/lib/otpStore";

/**
 * POST /api/signup/complete
 * Body: { email, verifyToken }
 * Authorization: Bearer <access_token>
 *
 * Called after manual-email-signup OTP is verified (verifyOtp returns a
 * verifyToken for signup_verify). This route:
 *   1. Validates the verifyToken (single-use, short-lived).
 *   2. Clears pending_email_verify on the user's user_settings row.
 *   3. Returns { success: true } so the client can proceed to /set-password.
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
    return NextResponse.json({ error: "Invalid session." }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const email = String(body.email ?? "").toLowerCase().trim();
  const verifyToken = String(body.verifyToken ?? "").trim();

  if (!email || !verifyToken) {
    return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
  }

  // Ensure the session user owns this email.
  if (userData.user.email?.toLowerCase() !== email) {
    return NextResponse.json({ error: "Email mismatch." }, { status: 403 });
  }

  // Consume the single-use signup verify ticket.
  const result = await consumeSignupVerifyTicket({ email, verifyToken });
  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: result.status ?? 400 });
  }

  // Clear pending_email_verify in user_settings.
  const { error: settingsErr } = await supabaseAdmin
    .from("user_settings")
    .update({ pending_email_verify: false })
    .eq("user_id", userData.user.id);

  if (settingsErr) {
    // The user_settings row may not exist yet (upserted later during onboarding).
    // Try an upsert with the minimal required fields.
    await supabaseAdmin
      .from("user_settings")
      .upsert(
        { user_id: userData.user.id, pending_email_verify: false },
        { onConflict: "user_id", ignoreDuplicates: false }
      );
  }

  return NextResponse.json({ success: true });
}
