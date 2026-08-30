// Shared password validation + OTP client helpers used across all password
// and email-verification flows. Safe to import from both client components
// and server API routes.

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

export type OtpPurpose =
  | "change_password"
  | "set_password"
  | "forgot_password"
  | "signup_verify";

// ── Client-side cooldown mirror (UX only — server enforces the real cooldown)
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
 * Send an 8-digit OTP for the given purpose.
 * - For "forgot_password" and "signup_verify": pass the target email (no session).
 * - For "change_password" / "set_password": pass the caller's Supabase
 *   access token — the server derives the email from the session.
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
  verifyToken?: string;
}

/** Verify a submitted 8-digit OTP code entirely server-side. */
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
 * returned by verifyOTPServer(). Hits the server (service role) since
 * there's no live Supabase session at this point.
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
 * After manual signup OTP is verified, call this to clear the
 * pending_email_verify flag server-side so the Gate allows /set-password.
 */
export async function completeSignupVerify(params: {
  email: string;
  verifyToken: string;
  accessToken: string;
}): Promise<{ error: string | null }> {
  try {
    const res = await fetch("/api/signup/complete", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${params.accessToken}`,
      },
      body: JSON.stringify({ email: params.email, verifyToken: params.verifyToken }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { error: data.error ?? "Verification failed." };
    return { error: null };
  } catch {
    return { error: "Network error. Please try again." };
  }
}

/**
 * Records that the user has completed /set-password with a real,
 * self-chosen password. Must be called right after
 * supabase.auth.updateUser({ password }) succeeds — see the note on
 * checkPasswordState() for why this can't be inferred from Supabase's own
 * encrypted_password column for manual-signup accounts.
 */
export async function markPasswordSet(accessToken: string): Promise<{ error: string | null }> {
  try {
    const res = await fetch("/api/password/mark-set", {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { error: data.error ?? "Failed to record password." };
    return { error: null };
  } catch {
    return { error: "Network error. Please try again." };
  }
}

/**
 * Detect whether a Supabase user has a password set AND whether they're
 * pending email OTP verification, via the server-side check-password route.
 *
 * `resolved: false` means the check itself failed (network error, expired
 * token, server error) — this is deliberately NOT the same as "confirmed
 * false". Callers (see AppShell's Gate) must treat an unresolved result as
 * "still don't know" and retry, rather than treating it as "no password" —
 * otherwise a transient failure here would wrongly bounce an already-set-up,
 * logged-in user to /set-password.
 */
export async function checkPasswordState(accessToken: string): Promise<{
  hasPassword: boolean;
  pendingEmailVerify: boolean;
  resolved: boolean;
}> {
  try {
    const res = await fetch("/api/otp/check-password", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
    });
    if (!res.ok) return { hasPassword: false, pendingEmailVerify: false, resolved: false };
    const data = await res.json();
    return {
      hasPassword: Boolean(data.hasPassword),
      pendingEmailVerify: Boolean(data.pendingEmailVerify),
      resolved: true,
    };
  } catch {
    return { hasPassword: false, pendingEmailVerify: false, resolved: false };
  }
}

/** Backward-compat shim — use checkPasswordState for new code. */
export async function checkHasPassword(accessToken: string): Promise<boolean> {
  const { hasPassword } = await checkPasswordState(accessToken);
  return hasPassword;
}
