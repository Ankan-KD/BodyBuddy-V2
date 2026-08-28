import { Resend } from "resend";

// ════════════════════════════════════════════════════════════════════════
// Server-only Resend client.
// NEVER import this file from a "use client" component — RESEND_API_KEY
// must never reach the browser. It's only used from API routes
// (src/app/api/**/route.ts), which run on the server.
// ════════════════════════════════════════════════════════════════════════

const resendApiKey = process.env.RESEND_API_KEY ?? "";

export const isResendConfigured = Boolean(resendApiKey);

const resend = isResendConfigured ? new Resend(resendApiKey) : null;

// resend.dev's shared sender — works without owning/verifying a domain.
const OTP_FROM = "BodyBuddy <onboarding@resend.dev>";

const PURPOSE_COPY: Record<string, { subject: string; heading: string; body: string }> = {
  change_password: {
    subject: "Your BodyBuddy verification code",
    heading: "Confirm it's you",
    body: "Use this code to confirm changing your BodyBuddy password.",
  },
  set_password: {
    subject: "Your BodyBuddy verification code",
    heading: "Confirm it's you",
    body: "Use this code to confirm setting a password for your BodyBuddy account.",
  },
  forgot_password: {
    subject: "Your BodyBuddy password reset code",
    heading: "Reset your password",
    body: "Use this code to reset your BodyBuddy password.",
  },
};

/**
 * Sends a 6-digit OTP email via Resend. Returns an error string on failure,
 * or null on success. Never throws, never logs the code.
 */
export async function sendOtpEmail(
  email: string,
  code: string,
  purpose: string
): Promise<{ error: string | null }> {
  if (!resend) {
    return { error: "Server misconfigured — RESEND_API_KEY is missing." };
  }

  const copy = PURPOSE_COPY[purpose] ?? PURPOSE_COPY.change_password;

  const html = `
    <div style="font-family: -apple-system, Segoe UI, Roboto, sans-serif; max-width: 420px; margin: 0 auto; padding: 24px;">
      <h2 style="margin: 0 0 8px; font-size: 20px;">${copy.heading}</h2>
      <p style="margin: 0 0 20px; color: #555; font-size: 14px;">${copy.body}</p>
      <div style="font-size: 32px; font-weight: 700; letter-spacing: 8px; text-align: center; padding: 16px; background: #f4f4f5; border-radius: 12px;">
        ${code}
      </div>
      <p style="margin: 20px 0 0; color: #888; font-size: 12px;">
        This code expires in 10 minutes. If you didn't request this, you can safely ignore this email.
      </p>
    </div>
  `.trim();

  try {
    const { error } = await resend.emails.send({
      from: OTP_FROM,
      to: email,
      subject: copy.subject,
      html,
    });
    if (error) {
      return { error: "Failed to send verification code. Please try again." };
    }
    return { error: null };
  } catch {
    return { error: "Failed to send verification code. Please try again." };
  }
}
