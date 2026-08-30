import nodemailer from "nodemailer";

// ════════════════════════════════════════════════════════════════════════
// Server-only Gmail SMTP mailer (replaces Resend).
// Uses a Gmail account + App Password — no custom domain required.
//
// Required env vars:
//   GMAIL_USER          — your Gmail address, e.g. you@gmail.com
//   GMAIL_APP_PASSWORD  — 16-char App Password from Google Account settings
//                         (Google Account → Security → App passwords)
//
// NEVER import this file from a "use client" component.
// ════════════════════════════════════════════════════════════════════════

const GMAIL_USER = process.env.GMAIL_USER ?? "";
const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD ?? "";

export const isResendConfigured = Boolean(GMAIL_USER && GMAIL_APP_PASSWORD);

function createTransport() {
  if (!isResendConfigured) return null;
  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: GMAIL_USER,
      pass: GMAIL_APP_PASSWORD,
    },
  });
}

const OTP_FROM = `BodyBuddy <${GMAIL_USER}>`;

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
  signup_verify: {
    subject: "Verify your BodyBuddy email",
    heading: "Verify your email",
    body: "Welcome to BodyBuddy! Enter this code to verify your email and complete sign up.",
  },
};

/**
 * Sends a 6-digit OTP email via Gmail SMTP. Returns an error string on failure,
 * or null on success. Never throws, never logs the code.
 */
export async function sendOtpEmail(
  email: string,
  code: string,
  purpose: string
): Promise<{ error: string | null }> {
  const transport = createTransport();
  if (!transport) {
    return { error: "Server misconfigured — GMAIL_USER or GMAIL_APP_PASSWORD is missing." };
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
        This 8-digit code expires in 10 minutes. If you didn't request this, you can safely ignore this email.
      </p>
    </div>
  `.trim();

  try {
    await transport.sendMail({
      from: OTP_FROM,
      to: email,
      subject: copy.subject,
      html,
    });
    return { error: null };
  } catch (err) {
    console.error("[gmail] sendOtpEmail threw:", err);
    return { error: "Failed to send verification code. Please try again." };
  }
}

/**
 * Sends an order receipt email to a customer via Gmail SMTP.
 * Returns { error } on failure, { error: null } on success.
 */
export async function sendReceiptEmail(params: {
  to: string;
  customerName: string;
  orderId: string;
  orderDate: string;
  items: Array<{ name: string; qty: number; price: string }>;
  subtotal: string;
  shipping: string;
  total: string;
  shippingAddress?: string;
}): Promise<{ error: string | null }> {
  const transport = createTransport();
  if (!transport) {
    return { error: "Server misconfigured — GMAIL_USER or GMAIL_APP_PASSWORD is missing." };
  }

  const { to, customerName, orderId, orderDate, items, subtotal, shipping, total, shippingAddress } = params;

  const itemRows = items
    .map(
      (item) =>
        `<tr>
          <td style="padding: 8px 0; border-bottom: 1px solid #f0f0f0; font-size: 14px;">${item.name}</td>
          <td style="padding: 8px 0; border-bottom: 1px solid #f0f0f0; font-size: 14px; text-align: center;">${item.qty}</td>
          <td style="padding: 8px 0; border-bottom: 1px solid #f0f0f0; font-size: 14px; text-align: right;">${item.price}</td>
        </tr>`
    )
    .join("");

  const html = `
    <div style="font-family: -apple-system, Segoe UI, Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #111;">
      <h2 style="margin: 0 0 4px; font-size: 22px;">Your BodyBuddy Order Receipt</h2>
      <p style="margin: 0 0 24px; color: #555; font-size: 14px;">Hi ${customerName}, thanks for your order!</p>

      <table style="width: 100%; border-collapse: collapse; margin-bottom: 16px;">
        <tr style="background: #f4f4f5;">
          <th style="padding: 8px; text-align: left; font-size: 12px; color: #666; font-weight: 600;">Item</th>
          <th style="padding: 8px; text-align: center; font-size: 12px; color: #666; font-weight: 600;">Qty</th>
          <th style="padding: 8px; text-align: right; font-size: 12px; color: #666; font-weight: 600;">Price</th>
        </tr>
        ${itemRows}
      </table>

      <table style="width: 100%; margin-bottom: 24px;">
        <tr><td style="font-size: 13px; color: #555; padding: 4px 0;">Subtotal</td><td style="text-align: right; font-size: 13px; padding: 4px 0;">${subtotal}</td></tr>
        <tr><td style="font-size: 13px; color: #555; padding: 4px 0;">Shipping</td><td style="text-align: right; font-size: 13px; padding: 4px 0;">${shipping}</td></tr>
        <tr>
          <td style="font-size: 16px; font-weight: 700; padding: 8px 0 0;">Total</td>
          <td style="text-align: right; font-size: 16px; font-weight: 700; padding: 8px 0 0;">${total}</td>
        </tr>
      </table>

      <div style="background: #f4f4f5; border-radius: 10px; padding: 14px; margin-bottom: 16px; font-size: 13px; color: #555;">
        <strong style="color: #111;">Order ID:</strong> ${orderId}<br/>
        <strong style="color: #111;">Date:</strong> ${orderDate}
        ${shippingAddress ? `<br/><strong style="color: #111;">Shipping to:</strong> ${shippingAddress}` : ""}
      </div>

      <p style="font-size: 12px; color: #888; margin: 0;">
        Questions? Reply to this email or visit your order history in the BodyBuddy app.
      </p>
    </div>
  `.trim();

  try {
    await transport.sendMail({
      from: OTP_FROM,
      to,
      subject: `Your BodyBuddy order receipt — ${orderId}`,
      html,
    });
    return { error: null };
  } catch (err) {
    console.error("[gmail] sendReceiptEmail threw:", err);
    return { error: "Failed to send receipt email." };
  }
}
