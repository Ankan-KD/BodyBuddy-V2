import crypto from "crypto";
import { supabaseAdmin } from "./supabaseAdmin";

// ════════════════════════════════════════════════════════════════════════
// Server-only OTP store. One reusable implementation for all OTP flows:
//   change_password — authenticated user changing existing password
//   set_password    — authenticated user (kept for backward-compat)
//   forgot_password — unauthenticated reset via email
//   signup_verify   — verify email after manual email signup (8-digit)
//
// Backed by the public.password_otp_requests table.
// NEVER import this file from a "use client" component.
// ════════════════════════════════════════════════════════════════════════

export type OtpPurpose = "change_password" | "set_password" | "forgot_password" | "signup_verify";

const CODE_TTL_MS = 10 * 60 * 1000;        // 10 min
const RESEND_COOLDOWN_MS = 60 * 1000;       // 1 min
const MAX_ATTEMPTS = 5;
const VERIFY_TICKET_TTL_MS = 15 * 60 * 1000; // 15 min (generous — user must still set password)

/** Cryptographically secure 8-digit OTP. */
function randomDigits(): string {
  // randomInt(0, 100_000_000) gives [0, 99_999_999] — pad to 8 digits.
  const value = crypto.randomInt(0, 100_000_000);
  return String(value).padStart(8, "0");
}

function hashWithSalt(value: string, salt: string): string {
  return crypto.createHash("sha256").update(`${salt}:${value}`).digest("hex");
}

function randomToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

export interface SendOtpResult {
  error: string | null;
  status?: number;
}

export async function issueOtp(params: {
  email: string;
  purpose: OtpPurpose;
  userId: string | null;
}): Promise<SendOtpResult> {
  const { email, purpose, userId } = params;
  if (!supabaseAdmin) {
    return { error: "Server misconfigured.", status: 500 };
  }

  const { data: existing } = await supabaseAdmin
    .from("password_otp_requests")
    .select("last_sent_at")
    .eq("email", email)
    .eq("purpose", purpose)
    .maybeSingle();

  if (existing) {
    const elapsed = Date.now() - new Date(existing.last_sent_at).getTime();
    if (elapsed < RESEND_COOLDOWN_MS) {
      const wait = Math.ceil((RESEND_COOLDOWN_MS - elapsed) / 1000);
      return { error: `Wait ${wait}s before requesting another code.`, status: 429 };
    }
  }

  const code = randomDigits();
  const salt = crypto.randomBytes(16).toString("hex");
  const codeHash = hashWithSalt(code, salt);
  const now = Date.now();

  // Send the email FIRST — only start the cooldown once delivery succeeds.
  const { sendOtpEmail } = await import("./resendEmail");
  const { error: sendErr } = await sendOtpEmail(email, code, purpose);
  if (sendErr) {
    // Never log the code itself.
    console.error(`[otp] sendOtpEmail failed for purpose=${purpose}`);
    return { error: "Failed to send verification code. Please try again in a moment.", status: 500 };
  }

  const { error: upsertErr } = await supabaseAdmin
    .from("password_otp_requests")
    .upsert(
      {
        email,
        purpose,
        user_id: userId,
        code_hash: codeHash,
        code_salt: salt,
        attempts: 0,
        max_attempts: MAX_ATTEMPTS,
        expires_at: new Date(now + CODE_TTL_MS).toISOString(),
        verify_token_hash: null,
        verify_expires_at: null,
        consumed: false,
        last_sent_at: new Date(now).toISOString(),
      },
      { onConflict: "email,purpose" }
    );

  if (upsertErr) {
    console.error(`[otp] DB upsert failed after successful send for purpose=${purpose}:`, upsertErr);
    return { error: "Failed to generate verification code. Please try again.", status: 500 };
  }

  return { error: null };
}

export interface VerifyOtpResult {
  error: string | null;
  status?: number;
  verifyToken?: string;
  userId?: string | null;
}

export async function verifyOtp(params: {
  email: string;
  purpose: OtpPurpose;
  code: string;
}): Promise<VerifyOtpResult> {
  const { email, purpose, code } = params;
  if (!supabaseAdmin) {
    return { error: "Server misconfigured.", status: 500 };
  }
  if (!/^\d{8}$/.test(code)) {
    return { error: "Enter the 8-digit code.", status: 400 };
  }

  const { data: entry, error: fetchErr } = await supabaseAdmin
    .from("password_otp_requests")
    .select("*")
    .eq("email", email)
    .eq("purpose", purpose)
    .maybeSingle();

  if (fetchErr || !entry) {
    return { error: "No verification code found. Please request a new one.", status: 400 };
  }
  if (entry.consumed) {
    return { error: "This code has already been used. Please request a new one.", status: 400 };
  }
  if (new Date(entry.expires_at).getTime() < Date.now()) {
    await supabaseAdmin.from("password_otp_requests").delete().eq("id", entry.id);
    return { error: "Code expired. Please request a new one.", status: 400 };
  }
  if (entry.attempts >= entry.max_attempts) {
    await supabaseAdmin.from("password_otp_requests").delete().eq("id", entry.id);
    return { error: "Too many attempts. Please request a new code.", status: 400 };
  }

  const submittedHash = hashWithSalt(code, entry.code_salt);
  if (submittedHash !== entry.code_hash) {
    const attempts = entry.attempts + 1;
    await supabaseAdmin.from("password_otp_requests").update({ attempts }).eq("id", entry.id);
    const left = entry.max_attempts - attempts;
    return {
      error: `Incorrect code. ${left} attempt${left !== 1 ? "s" : ""} remaining.`,
      status: 400,
    };
  }

  // Correct code — for flows that need a short-lived verify ticket, issue one.
  if (purpose === "forgot_password" || purpose === "signup_verify") {
    const ticket = randomToken();
    const ticketHash = crypto.createHash("sha256").update(ticket).digest("hex");
    await supabaseAdmin
      .from("password_otp_requests")
      .update({
        code_hash: "",
        code_salt: "",
        verify_token_hash: ticketHash,
        verify_expires_at: new Date(Date.now() + VERIFY_TICKET_TTL_MS).toISOString(),
      })
      .eq("id", entry.id);
    return { error: null, verifyToken: ticket, userId: entry.user_id };
  }

  // change_password / set_password: just consume the code.
  await supabaseAdmin.from("password_otp_requests").delete().eq("id", entry.id);
  return { error: null, userId: entry.user_id };
}

export interface ConsumeTicketResult {
  error: string | null;
  status?: number;
  userId?: string | null;
}

export async function consumeForgotPasswordTicket(params: {
  email: string;
  verifyToken: string;
}): Promise<ConsumeTicketResult> {
  const { email, verifyToken } = params;
  if (!supabaseAdmin) {
    return { error: "Server misconfigured.", status: 500 };
  }

  const { data: entry, error: fetchErr } = await supabaseAdmin
    .from("password_otp_requests")
    .select("*")
    .eq("email", email)
    .eq("purpose", "forgot_password")
    .maybeSingle();

  if (fetchErr || !entry || !entry.verify_token_hash) {
    return { error: "Verification expired. Please start again.", status: 400 };
  }
  if (entry.consumed) {
    return { error: "This verification has already been used. Please start again.", status: 400 };
  }
  if (!entry.verify_expires_at || new Date(entry.verify_expires_at).getTime() < Date.now()) {
    await supabaseAdmin.from("password_otp_requests").delete().eq("id", entry.id);
    return { error: "Verification expired. Please start again.", status: 400 };
  }

  const submittedHash = crypto.createHash("sha256").update(verifyToken).digest("hex");
  if (submittedHash !== entry.verify_token_hash) {
    return { error: "Verification expired. Please start again.", status: 400 };
  }

  await supabaseAdmin.from("password_otp_requests").delete().eq("id", entry.id);
  return { error: null, userId: entry.user_id };
}

/**
 * Consumes the signup_verify ticket (issued after OTP verification).
 * Returns the userId so the caller can clear pending_email_verify in profiles.
 */
export async function consumeSignupVerifyTicket(params: {
  email: string;
  verifyToken: string;
}): Promise<ConsumeTicketResult> {
  const { email, verifyToken } = params;
  if (!supabaseAdmin) {
    return { error: "Server misconfigured.", status: 500 };
  }

  const { data: entry, error: fetchErr } = await supabaseAdmin
    .from("password_otp_requests")
    .select("*")
    .eq("email", email)
    .eq("purpose", "signup_verify")
    .maybeSingle();

  if (fetchErr || !entry || !entry.verify_token_hash) {
    return { error: "Verification expired. Please start again.", status: 400 };
  }
  if (!entry.verify_expires_at || new Date(entry.verify_expires_at).getTime() < Date.now()) {
    await supabaseAdmin.from("password_otp_requests").delete().eq("id", entry.id);
    return { error: "Verification expired. Please start again.", status: 400 };
  }

  const submittedHash = crypto.createHash("sha256").update(verifyToken).digest("hex");
  if (submittedHash !== entry.verify_token_hash) {
    return { error: "Verification expired. Please start again.", status: 400 };
  }

  await supabaseAdmin.from("password_otp_requests").delete().eq("id", entry.id);
  return { error: null, userId: entry.user_id };
}
