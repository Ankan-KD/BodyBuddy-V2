import { NextResponse } from "next/server";
import { supabaseAdmin, getUserFromRequest } from "@/lib/supabaseAdmin";
import { verifyPaymentSignature, fetchRazorpayPayment, normalizePaymentMethod } from "@/lib/razorpayServer";
import { orderFromRow, type OrderRow } from "@/lib/orderTypes";

// ════════════════════════════════════════════════════════════════════════
// BB Store — Verify Razorpay Payment
// Called by the Razorpay Checkout success handler. Verifies the HMAC
// signature server-side, then — only if valid — marks the order paid.
// Idempotent: safe to call more than once (e.g. if the webhook also fires).
// ════════════════════════════════════════════════════════════════════════

interface RequestBody {
  orderId: string;
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

export async function POST(request: Request) {
  if (!supabaseAdmin) {
    return NextResponse.json({ verified: false, error: "Not configured." }, { status: 503 });
  }

  const user = await getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ verified: false, error: "Please sign in." }, { status: 401 });
  }

  let body: RequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ verified: false, error: "Invalid request." }, { status: 400 });
  }

  const { orderId, razorpay_order_id, razorpay_payment_id, razorpay_signature } = body ?? {};
  if (!orderId || !razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return NextResponse.json({ verified: false, error: "Missing payment details." }, { status: 400 });
  }

  // ── Fetch the order and confirm it belongs to this user + matches the
  //    Razorpay order we created for it ────────────────────────────────
  const { data: orderRow, error: fetchError } = await supabaseAdmin
    .from("store_orders")
    .select("*, store_order_items(*)")
    .eq("id", orderId)
    .eq("user_id", user.id)
    .single();

  if (fetchError || !orderRow) {
    return NextResponse.json({ verified: false, error: "Order not found." }, { status: 404 });
  }

  // Already verified (e.g. webhook beat us to it) — idempotent success.
  if (orderRow.payment_status === "paid") {
    return NextResponse.json({ verified: true, order: orderFromRow(orderRow as OrderRow) });
  }

  if (orderRow.razorpay_order_id !== razorpay_order_id) {
    return NextResponse.json({ verified: false, error: "Payment does not match this order." }, { status: 400 });
  }

  const signatureValid = verifyPaymentSignature({
    razorpayOrderId: razorpay_order_id,
    razorpayPaymentId: razorpay_payment_id,
    razorpaySignature: razorpay_signature,
  });

  if (!signatureValid) {
    await supabaseAdmin
      .from("store_orders")
      .update({ payment_error: "Signature verification failed." })
      .eq("id", orderId);
    return NextResponse.json({ verified: false, error: "Payment signature could not be verified." }, { status: 400 });
  }

  // Look up the real instrument used (upi/card/netbanking/wallet) for
  // accurate receipts/admin views — falls back to "other" if unavailable.
  const { payment } = await fetchRazorpayPayment(razorpay_payment_id);
  const method = normalizePaymentMethod(payment?.method);

  const { data: updated, error: updateError } = await supabaseAdmin
    .from("store_orders")
    .update({
      payment_status: "paid",
      payment_method: method,
      razorpay_payment_id,
      razorpay_signature,
      payment_reference: razorpay_payment_id,
      payment_error: null,
    })
    // Guards against a duplicate/racing update re-applying this.
    .eq("id", orderId)
    .neq("payment_status", "paid")
    .select("*, store_order_items(*)")
    .single();

  if (updateError || !updated) {
    // Someone else (webhook) likely marked it paid in the meantime.
    const { data: recheck } = await supabaseAdmin
      .from("store_orders")
      .select("*, store_order_items(*)")
      .eq("id", orderId)
      .single();
    if (recheck?.payment_status === "paid") {
      return NextResponse.json({ verified: true, order: orderFromRow(recheck as OrderRow) });
    }
    return NextResponse.json({ verified: false, error: "Could not confirm payment. Please contact support." }, { status: 500 });
  }

  // Payment confirmed — now safe to clear the cart.
  await supabaseAdmin.from("store_cart_items").delete().eq("user_id", user.id);

  return NextResponse.json({ verified: true, order: orderFromRow(updated as OrderRow) });
}
