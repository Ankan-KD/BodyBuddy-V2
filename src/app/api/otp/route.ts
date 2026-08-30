import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { issueOtp, verifyOtp, type OtpPurpose } from "@/lib/otpStore";

// ════════════════════════════════════════════════════════════════════════
// One reusable OTP endpoint for all password flows + email signup verify:
//   signup_verify   — unauthenticated, manual email signup OTP (8-digit)
//   change_password — authenticated, account already has a password
//   set_password    — NOT USED (Google sign-up no longer needs OTP)
//   forgot_password — unauthenticated, identified only by email
//
// POST  → generate + send an 8-digit code via Gmail SMTP
// PUT   → verify a submitted code, entirely server-side
// ════════════════════════════════════════════════════════════════════════

const VALID_PURPOSES: OtpPurpose[] = ["change_password", "set_password", "forgot_password", "signup_verify"];

function isValidPurpose(p: unknown): p is OtpPurpose {
  return typeof p === "string" && (VALID_PURPOSES as string[]).includes(p);
}

async function resolveAuthenticatedUser(req: NextRequest) {
  if (!supabaseAdmin) return null;
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  if (!token) return null;
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data?.user?.email) return null;
  return data.user;
}

// ─── POST — send OTP ───────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const purpose = body.purpose;

  if (!isValidPurpose(purpose)) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Server misconfigured." }, { status: 500 });
  }

  let email: string;
  let userId: string | null = null;

  if (purpose === "forgot_password" || purpose === "signup_verify") {
    // Unauthenticated flows — email comes from the request body.
    email = String(body.email ?? "").toLowerCase().trim();
    if (!email) {
      return NextResponse.json({ error: "Email is required." }, { status: 400 });
    }

    // Look up the userId (may be null for signup_verify before the account is
    // fully created, but the accounts are created before OTP is sent).
    const { data: resolvedId } = await supabaseAdmin.rpc("get_auth_user_id_by_email", {
      p_email: email,
    });

    if (purpose === "forgot_password") {
      // Always respond the same way whether or not the account exists, to
      // avoid leaking which emails have BodyBuddy accounts.
      if (!resolvedId) {
        return NextResponse.json({ success: true });
      }
    }

    userId = resolvedId as string | null;
  } else {
    // change_password / set_password — authenticated flows.
    const user = await resolveAuthenticatedUser(req);
    if (!user || !user.email) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
    email = user.email.toLowerCase();
    userId = user.id;

    const { data: hasPassword } = await supabaseAdmin.rpc("user_has_password", {
      p_user_id: userId,
    });
    if (purpose === "change_password" && !hasPassword) {
      return NextResponse.json(
        { error: "No password is set for this account yet. Use 'Set password' instead." },
        { status: 400 }
      );
    }
    if (purpose === "set_password" && hasPassword) {
      return NextResponse.json(
        { error: "A password is already set for this account. Use 'Change password' instead." },
        { status: 400 }
      );
    }
  }

  const { error, status } = await issueOtp({ email, purpose, userId });
  if (error) {
    return NextResponse.json({ error }, { status: status ?? 500 });
  }
  return NextResponse.json({ success: true });
}

// ─── PUT — verify OTP (entirely server-side) ───────────────────────────────
export async function PUT(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const purpose = body.purpose;
  const code = String(body.code ?? "").trim();

  if (!isValidPurpose(purpose)) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  if (!code) {
    return NextResponse.json({ error: "Code is required." }, { status: 400 });
  }
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Server misconfigured." }, { status: 500 });
  }

  let email: string;

  if (purpose === "forgot_password" || purpose === "signup_verify") {
    email = String(body.email ?? "").toLowerCase().trim();
    if (!email) {
      return NextResponse.json({ error: "Email is required." }, { status: 400 });
    }
  } else {
    const user = await resolveAuthenticatedUser(req);
    if (!user || !user.email) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
    email = user.email.toLowerCase();
  }

  const result = await verifyOtp({ email, purpose, code });
  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: result.status ?? 400 });
  }

  return NextResponse.json({
    success: true,
    verifyToken: result.verifyToken,
  });
}
