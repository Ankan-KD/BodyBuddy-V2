import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

/**
 * POST /api/otp/check-password
 * Authorization: Bearer <access_token>
 *
 * Returns { hasPassword: boolean }, determined entirely server-side via the
 * public.user_has_password(uuid) Postgres function, which inspects
 * auth.users.encrypted_password directly (SECURITY DEFINER, execute
 * restricted to the service role — see supabase/013_password_otp_secure.sql).
 *
 * This is the one reliable signal: it doesn't infer password existence
 * from app_metadata.provider or identities, both of which can be
 * misleading (e.g. Supabase may attach an "email" identity to an
 * OAuth-only account). encrypted_password itself is never returned to the
 * client — only the boolean.
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
    return NextResponse.json({ error: "Invalid token." }, { status: 401 });
  }

  const { data: hasPassword, error: rpcErr } = await supabaseAdmin.rpc("user_has_password", {
    p_user_id: userData.user.id,
  });
  if (rpcErr) {
    return NextResponse.json({ error: "Failed to check password state." }, { status: 500 });
  }

  return NextResponse.json({ hasPassword: Boolean(hasPassword) });
}
