import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

/**
 * POST /api/signup/mark-pending
 * Body: { userId }
 * Authorization: Bearer <access_token>  (optional — server validates userId matches)
 *
 * Called immediately after manual email signUp() to mark user_security
 * as pending_email_verify=true. The Gate checks this flag to block webapp
 * access until OTP verification + password creation are both complete.
 *
 * Uses the service role so it can write even when the user_security row
 * was just created by the DB trigger (race condition safe).
 *
 * NOTE: writes to user_security only (migration 017+018). The old
 * user_settings columns have been dropped by 018.
 */
export async function POST(req: NextRequest) {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Server misconfigured." }, { status: 500 });
  }

  const body = await req.json().catch(() => ({}));
  const userId = String(body.userId ?? "").trim();
  if (!userId) {
    return NextResponse.json({ error: "Missing userId." }, { status: 400 });
  }

  // Validate the access token if provided.
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  if (token) {
    const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token);
    if (userErr || !userData?.user || userData.user.id !== userId) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
  }

  // Try to update the existing user_security row first.
  // { count: "exact" } is required — without it, supabase-js never populates
  // `count` (stays null forever), so the fallback-to-upsert branch would be
  // dead code, silently skipping the OTP gate for new users on a race.
  const { error: updateErr, count } = await supabaseAdmin
    .from("user_security")
    .update({ pending_email_verify: true }, { count: "exact" })
    .eq("user_id", userId);

  if (updateErr || !count) {
    // Row may not exist yet (trigger hasn't fired). Upsert it.
    const { error: upsertErr } = await supabaseAdmin
      .from("user_security")
      .upsert(
        { user_id: userId, pending_email_verify: true },
        { onConflict: "user_id", ignoreDuplicates: false }
      );
    if (upsertErr) {
      console.error("[signup/mark-pending] upsert failed:", upsertErr);
      return NextResponse.json({ error: "Failed to mark pending." }, { status: 500 });
    }
  }

  return NextResponse.json({ success: true });
}
