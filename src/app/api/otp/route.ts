import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { issueOtp, verifyOtp, type OtpPurpose } from "@/lib/otpStore";

// ════════════════════════════════════════════════════════════════════════
// One reusable OTP endpoint for all three password flows:
//   change_password  — authenticated, account has a password
//   set_password     — authenticated, account has no password yet
//   forgot_password  — unauthenticated, identified only by email
//
// POST  → generate + send a 6-digit code via Resend
// PUT   → verify a submitted code, entirely server-side
//
// Authorization is never trusted from the request body. For change_password
// and set_password, the user (and their email) is derived from the
// Authorization: Bearer <access_token> header via the Supabase admin client.
// For forgot_password, the only "identity" is the email itself — proven by
// completing the OTP challenge sent to that inbox.
// ════════════════════════════════════════════════════════════════════════

const VALID_PURPOSES: OtpPurpose[] = ["change_password", "set_password", "forgot_password"];

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

  if (purpose === "forgot_password") {
    email = String(body.email ?? "").toLowerCase().trim();
    if (!email) {
      return NextResponse.json({ error: "Email is required." }, { status: 400 });
    }
    const { data: resolvedId } = await supabaseAdmin.rpc("get_auth_user_id_by_email", {
      p_email: email,
    });
    // Always respond the same way whether or not the account exists, to
    // avoid leaking which emails have BodyBuddy accounts. Only actually
    // send an email — and only actually create an OTP record — for real
    // accounts.
    if (!resolvedId) {
      return NextResponse.json({ success: true });
    }
    userId = resolvedId as string;
  } else {
    const user = await resolveAuthenticatedUser(req);
    if (!user || !user.email) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
    email = user.email.toLowerCase();
    userId = user.id;

    // Keep the flow the account is actually eligible for from drifting:
    // never ask for OTP-gated "change" on an account with no password, or
    // "set" on an account that already has one. The UI already branches on
    // this, this is just defense in depth.
    const { data: hasPassword } = await supabaseAdmin.rpc("user_has_password", {
      p_user_id: userId,
    });
    if (purpose === "change_password" && !hasPassword) {
      return NextResponse.json(
        { error: "No password is set for this account yet. Use “Set password” instead." },
        { status: 400 }
      );
    }
    if (purpose === "set_password" && hasPassword) {
      return NextResponse.json(
        { error: "A password is already set for this account. Use “Change password” instead." },
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

  if (purpose === "forgot_password") {
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

  // Only the forgot-password flow needs a ticket back — change/set already
  // have a live Supabase session and update the password directly.
  return NextResponse.json({
    success: true,
    verifyToken: result.verifyToken,
  });
}
