// Shared password validation + OTP client helpers used across all three
// password flows (change / set / forgot). Safe to import from both client
// components and server API routes (validatePassword has no side effects).

export interface PasswordValidation {
  minLength: boolean;
  hasLetter: boolean;
  hasNumber: boolean;
  allPassed: boolean;
}

export function validatePassword(password: string): PasswordValidation {
  const minLength = password.length >= 8;
  const hasLetter = /[a-zA-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  return {
    minLength,
    hasLetter,
    hasNumber,
    allPassed: minLength && hasLetter && hasNumber,
  };
}

export const PASSWORD_HINT = "At least 8 characters, including a letter and a number.";

export type OtpPurpose = "change_password" | "set_password" | "forgot_password";

// ── Client-side cooldown mirror (UX only — the server enforces the real
//    cooldown and will reject early resends regardless of this). ──
const COOLDOWN_MS = 60_000;
const cooldowns = new Map<string, number>();

export function getResendCooldown(key: string): number {
  const ts = cooldowns.get(key);
  if (!ts) return 0;
  const remaining = Math.ceil((COOLDOWN_MS - (Date.now() - ts)) / 1000);
  return remaining > 0 ? remaining : 0;
}

export function markResendSent(key: string) {
  cooldowns.set(key, Date.now());
}

/**
 * Send a 6-digit OTP for the given purpose.
 * - For "forgot_password", pass the target email (no session exists yet).
 * - For "change_password" / "set_password", pass the caller's Supabase
 *   access token instead — the server derives the email from the session
 *   and ignores any email the client might send.
 */
export async function sendOTP(params: {
  purpose: OtpPurpose;
  email?: string;
  accessToken?: string;
}): Promise<{ error: string | null }> {
  try {
    const res = await fetch("/api/otp", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(params.accessToken ? { Authorization: `Bearer ${params.accessToken}` } : {}),
      },
      body: JSON.stringify({ purpose: params.purpose, email: params.email }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { error: data.error ?? "Failed to send verification code." };
    return { error: null };
  } catch {
    return { error: "Network error. Please try again." };
  }
}

export interface OTPVerifyResult {
  error: string | null;
  /** Only returned for the forgot_password purpose. Pass this to
   *  updatePasswordAfterOtp() to actually change the password. */
  verifyToken?: string;
}

/** Verify a submitted OTP code entirely server-side. */
export async function verifyOTPServer(params: {
  purpose: OtpPurpose;
  code: string;
  email?: string;
  accessToken?: string;
}): Promise<OTPVerifyResult> {
  try {
    const res = await fetch("/api/otp", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        ...(params.accessToken ? { Authorization: `Bearer ${params.accessToken}` } : {}),
      },
      body: JSON.stringify({ purpose: params.purpose, code: params.code, email: params.email }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { error: data.error ?? "Verification failed." };
    return { error: null, verifyToken: data.verifyToken };
  } catch {
    return { error: "Network error. Please try again." };
  }
}

/**
 * Completes the unauthenticated forgot-password flow using the ticket
 * returned by verifyOTPServer(). There is no Supabase session at this
 * point, so this hits the server (which uses the service role) instead of
 * calling supabase.auth.updateUser() directly.
 */
export async function updatePasswordAfterOtp(params: {
  email: string;
  verifyToken: string;
  newPassword: string;
}): Promise<{ error: string | null }> {
  try {
    const res = await fetch("/api/password/reset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { error: data.error ?? "Failed to update password." };
    return { error: null };
  } catch {
    return { error: "Network error. Please try again." };
  }
}

/**
 * Detect whether a Supabase user has a password set, via the server-side
 * check-password route (which uses a SECURITY DEFINER RPC to inspect
 * encrypted_password directly — never inferred from provider/identities).
 */
export async function checkHasPassword(accessToken: string): Promise<boolean> {
  try {
    const res = await fetch("/api/otp/check-password", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
    });
    if (!res.ok) return false;
    const data = await res.json();
    return Boolean(data.hasPassword);
  } catch {
    return false;
  }
}
