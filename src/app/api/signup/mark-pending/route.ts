import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

/**
 * POST /api/signup/mark-pending
 * Body: { userId }
 * Authorization: Bearer <access_token>  (optional — server validates userId matches)
 *
 * Called immediately after manual email signUp() to mark user_settings
 * as pending_email_verify=true. The Gate checks this flag to block webapp
 * access until OTP verification + password creation are both complete.
 *
 * Uses the service role so it can write even when the user_settings row
 * was just created by the DB trigger (race condition safe).
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

  // Try to update the existing user_settings row first.
  // NOTE: { count: "exact" } is required here — without it, supabase-js
  // never populates `count` (it stays null forever), so `count === 0` could
  // never be true and this fallback-to-upsert branch was dead code. That
  // meant: if the DB trigger that creates the user_settings row hadn't
  // fired yet by the time this request landed (a real race with a
  // brand-new signup), the UPDATE silently affected 0 rows, we never
  // upserted, and pending_email_verify stayed at its default of `false` —
  // silently skipping the OTP gate entirely for that user.
  const { error: updateErr, count } = await supabaseAdmin
    .from("user_settings")
    .update({ pending_email_verify: true }, { count: "exact" })
    .eq("user_id", userId);

  if (updateErr || !count) {
    // Row may not exist yet (trigger hasn't fired). Upsert it.
    const { error: upsertErr } = await supabaseAdmin
      .from("user_settings")
      .upsert(
        { user_id: userId, pending_email_verify: true },
        { onConflict: "user_id", ignoreDuplicates: false }
      );
    if (upsertErr) {
      console.error("[signup/mark-pending] upsert failed:", upsertErr);
      // Non-fatal — OTP step still gates access via the DB check.
      return NextResponse.json({ error: "Failed to mark pending." }, { status: 500 });
    }
  }

  return NextResponse.json({ success: true });
}
