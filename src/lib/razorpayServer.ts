import crypto from "crypto";

// ════════════════════════════════════════════════════════════════════════
// Server-only Razorpay helpers — ported from the standalone Razorpay Lab
// module and adapted to reuse BodyBuddy's env vars / conventions. Never
// import this from a "use client" component: RAZORPAY_KEY_SECRET must
// stay server-side only.
// ════════════════════════════════════════════════════════════════════════

const RAZORPAY_ORDERS_URL = "https://api.razorpay.com/v1/orders";
const RAZORPAY_PAYMENTS_URL = "https://api.razorpay.com/v1/payments";

export function getRazorpayKeyId(): string | null {
  return process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID ?? null;
}

function getRazorpayKeySecret(): string | null {
  return process.env.RAZORPAY_KEY_SECRET ?? null;
}

function authHeader(): string {
  const keyId = getRazorpayKeyId();
  const keySecret = getRazorpayKeySecret();
  if (!keyId || !keySecret) throw new Error("Razorpay keys are not configured on the server.");
  return "Basic " + Buffer.from(`${keyId}:${keySecret}`).toString("base64");
}

export interface RazorpayOrder {
  id: string;
  amount: number;
  currency: string;
  receipt: string;
  status: string;
}

/**
 * Creates a Razorpay order for the given amount (in paise). Reused for
 * both the initial checkout attempt and any retry against the same
 * store_orders row — Razorpay orders accept checkout attempts until a
 * payment succeeds, so we don't need to mint a fresh one per retry.
 */
export async function createRazorpayOrder(opts: {
  amountPaise: number;
  receipt: string;
  notes?: Record<string, string>;
}): Promise<{ order: RazorpayOrder | null; error: string | null }> {
  try {
    const response = await fetch(RAZORPAY_ORDERS_URL, {
      method: "POST",
      headers: { Authorization: authHeader(), "Content-Type": "application/json" },
      body: JSON.stringify({
        amount: Math.round(opts.amountPaise),
        currency: "INR",
        receipt: opts.receipt,
        notes: opts.notes ?? {},
      }),
      cache: "no-store",
    });
    const data = await response.json();
    if (!response.ok) {
      return { order: null, error: data?.error?.description ?? "Could not create a Razorpay order." };
    }
    return { order: data as RazorpayOrder, error: null };
  } catch {
    return { order: null, error: "Unable to reach Razorpay. Please try again." };
  }
}

/** Verifies the checkout.js success-handler signature (HMAC SHA-256). */
export function verifyPaymentSignature(opts: {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
}): boolean {
  const keySecret = getRazorpayKeySecret();
  if (!keySecret) return false;
  const expected = crypto
    .createHmac("sha256", keySecret)
    .update(`${opts.razorpayOrderId}|${opts.razorpayPaymentId}`)
    .digest("hex");
  const provided = opts.razorpaySignature || "";
  if (provided.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(provided));
}

/** Verifies a Razorpay webhook request signature (X-Razorpay-Signature). */
export function verifyWebhookSignature(rawBody: string, signature: string | null): boolean {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET ?? "";
  if (!secret || !signature) return false;
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  if (signature.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

export interface RazorpayPayment {
  id: string;
  order_id: string;
  status: string;
  method: string; // "upi" | "card" | "netbanking" | "wallet" | "emi" | ...
  amount: number;
  currency: string;
}

/** Fetches payment details from Razorpay so we can record the real
 * instrument used (upi/card/netbanking/wallet) rather than guessing. */
export async function fetchRazorpayPayment(
  paymentId: string
): Promise<{ payment: RazorpayPayment | null; error: string | null }> {
  try {
    const response = await fetch(`${RAZORPAY_PAYMENTS_URL}/${paymentId}`, {
      headers: { Authorization: authHeader() },
      cache: "no-store",
    });
    const data = await response.json();
    if (!response.ok) {
      return { payment: null, error: data?.error?.description ?? "Could not fetch payment." };
    }
    return { payment: data as RazorpayPayment, error: null };
  } catch {
    return { payment: null, error: "Unable to reach Razorpay." };
  }
}

/** Maps a Razorpay payment method string to our store_orders.payment_method enum. */
export function normalizePaymentMethod(method: string | undefined | null): string {
  const m = (method ?? "").toLowerCase();
  if (["upi", "card", "netbanking", "wallet", "emi"].includes(m)) return m;
  return "other";
}
