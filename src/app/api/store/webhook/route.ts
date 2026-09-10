import { NextResponse, after } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { verifyWebhookSignature, fetchRazorpayPayment, normalizePaymentMethod } from "@/lib/razorpayServer";
import { orderFromRow, type OrderRow } from "@/lib/orderTypes";
import { sendOrderConfirmationEmail } from "@/lib/orderConfirmationEmail";

// ════════════════════════════════════════════════════════════════════════
// BB Store — Razorpay Webhook
// Configure this URL (…/api/store/webhook) in the Razorpay Dashboard
// under Settings → Webhooks, subscribed to at least "payment.captured".
// Set RAZORPAY_WEBHOOK_SECRET to the secret shown there.
//
// This exists so payment state stays correct even if the customer closes
// their browser right after paying (before the checkout.js success
// handler can call verify-payment). It duplicates none of the client
// flow's effects — everything here is idempotent.
// ════════════════════════════════════════════════════════════════════════

export async function POST(request: Request) {
  if (!supabaseAdmin) {
    return NextResponse.json({ ok: false }, { status: 503 });
  }

  const rawBody = await request.text();
  const signature = request.headers.get("x-razorpay-signature");

  if (!verifyWebhookSignature(rawBody, signature)) {
    return NextResponse.json({ ok: false, error: "Invalid signature." }, { status: 400 });
  }

  let event: {
    id?: string;
    event?: string;
    payload?: { payment?: { entity?: { id: string; order_id: string; method?: string } } };
  };
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid payload." }, { status: 400 });
  }

  // ── Idempotency: record this event id; if already seen, no-op ────────
  const eventId = event.id ?? `${event.event ?? "unknown"}:${rawBody.length}:${Date.now()}`;
  const { error: insertEventError } = await supabaseAdmin
    .from("store_razorpay_events")
    .insert({ event_id: eventId, event_type: event.event ?? "" });
  if (insertEventError) {
    // Unique-violation means we've already processed this exact event.
    return NextResponse.json({ ok: true, duplicate: true });
  }

  if (event.event !== "payment.captured" && event.event !== "order.paid") {
    return NextResponse.json({ ok: true, ignored: event.event ?? null });
  }

  const payment = event.payload?.payment?.entity;
  if (!payment?.order_id || !payment?.id) {
    return NextResponse.json({ ok: true });
  }

  const { data: order } = await supabaseAdmin
    .from("store_orders")
    .select("id, user_id, payment_status")
    .eq("razorpay_order_id", payment.order_id)
    .single();

  if (!order || order.payment_status === "paid") {
    return NextResponse.json({ ok: true });
  }

  const method = normalizePaymentMethod(payment.method ?? (await fetchRazorpayPayment(payment.id)).payment?.method);

  // The `.neq("payment_status", "paid")` guard means at most one of
  // {this webhook delivery, the client's verify-payment call} can ever
  // get a row back here for a given order — `.select().single()` lets us
  // tell whether THIS request is the one that performed the transition.
  const { data: updated, error: updateError } = await supabaseAdmin
    .from("store_orders")
    .update({
      payment_status: "paid",
      payment_method: method,
      razorpay_payment_id: payment.id,
      payment_reference: payment.id,
      payment_error: null,
    })
    .eq("id", order.id)
    .neq("payment_status", "paid")
    .select("*, store_order_items(*)")
    .single();

  await supabaseAdmin.from("store_cart_items").delete().eq("user_id", order.user_id);

  // Only the request that actually flipped payment_status to "paid" owns
  // sending the confirmation email — if verify-payment already won the
  // race, `updated` is null/errored here and we skip, so the customer
  // gets exactly one email either way. sendOrderConfirmationEmail() never
  // throws, so a mailer failure can never affect this webhook's ack.
  //
  // PERF: run it via `after()` so Razorpay gets its ack immediately
  // instead of waiting on PDF generation + SMTP send (Razorpay retries
  // webhooks that are slow to ack, so this also avoids duplicate deliveries).
  if (!updateError && updated) {
    const confirmedOrder = orderFromRow(updated as OrderRow);
    after(() => sendOrderConfirmationEmail(confirmedOrder));
  }

  return NextResponse.json({ ok: true });
}
