import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { verifyWebhookSignature, fetchRazorpayPayment, normalizePaymentMethod } from "@/lib/razorpayServer";

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

  await supabaseAdmin
    .from("store_orders")
    .update({
      payment_status: "paid",
      payment_method: method,
      razorpay_payment_id: payment.id,
      payment_reference: payment.id,
      payment_error: null,
    })
    .eq("id", order.id)
    .neq("payment_status", "paid");

  await supabaseAdmin.from("store_cart_items").delete().eq("user_id", order.user_id);

  return NextResponse.json({ ok: true });
}
