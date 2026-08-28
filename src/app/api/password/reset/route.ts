import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { validatePassword } from "@/lib/passwordUtils";
import { consumeForgotPasswordTicket } from "@/lib/otpStore";

/**
 * POST /api/password/reset
 * Body: { email, verifyToken, newPassword }
 *
 * The ONLY route that changes a password without a live Supabase session
 * (used exclusively by the unauthenticated "forgot password" flow). The
 * target account is never taken from a client-supplied id — it's resolved
 * from the OTP ticket that was only issued after the caller proved control
 * of that email's inbox (src/lib/otpStore.ts). The ticket is single-use and
 * short-lived, so this request parameter cannot be replayed or reused to
 * reset a different account by editing the request body.
 *
 * change_password / set_password (the authenticated flows) never touch
 * this route — they call supabase.auth.updateUser() directly from the
 * client using the user's own session, which is the correct/simple way to
 * update your own password once you're already signed in.
 */
export async function POST(req: NextRequest) {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Server misconfigured." }, { status: 500 });
  }

  const body = await req.json().catch(() => ({}));
  const email = String(body.email ?? "").toLowerCase().trim();
  const verifyToken = String(body.verifyToken ?? "").trim();
  const newPassword = String(body.newPassword ?? "");

  if (!email || !verifyToken || !newPassword) {
    return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
  }

  const validation = validatePassword(newPassword);
  if (!validation.allPassed) {
    return NextResponse.json({ error: "Password doesn't meet requirements." }, { status: 400 });
  }

  const ticketResult = await consumeForgotPasswordTicket({ email, verifyToken });
  if (ticketResult.error || !ticketResult.userId) {
    return NextResponse.json(
      { error: ticketResult.error ?? "Verification expired. Please start again." },
      { status: ticketResult.status ?? 400 }
    );
  }

  const { error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(
    ticketResult.userId,
    { password: newPassword }
  );
  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
