import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

/**
 * POST /api/password/mark-set
 * Authorization: Bearer <access_token>
 *
 * Called from /set-password right after supabase.auth.updateUser({ password })
 * succeeds. Records password_set=true via the mark_password_set() RPC
 * (see supabase/016_password_set_flag.sql) so /api/otp/check-password can
 * report hasPassword based on real user intent, not on whether
 * auth.users.encrypted_password happens to be non-null — manual signup
 * writes a random temp password there at account-creation time, so that
 * column alone can't tell "user chose this" apart from "we generated junk
 * to satisfy the signUp() API."
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
    console.error("[password/mark-set] getUser failed:", userErr?.message ?? "no user returned");
    return NextResponse.json({ error: "Invalid token." }, { status: 401 });
  }

  const { error: rpcErr } = await supabaseAdmin.rpc("mark_password_set", {
    p_user_id: userData.user.id,
  });
  if (rpcErr) {
    console.error("[password/mark-set] rpc failed:", rpcErr.message);
    return NextResponse.json({ error: "Failed to record password." }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
