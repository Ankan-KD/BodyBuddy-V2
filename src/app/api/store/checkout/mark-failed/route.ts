import { NextResponse } from "next/server";
import { supabaseAdmin, getUserFromRequest } from "@/lib/supabaseAdmin";
import { cancelOrderServer } from "@/lib/storeOrderServer";

// ════════════════════════════════════════════════════════════════════════
// BB Store — Mark Checkout Failed / Cancelled / Abandoned
// Called when Razorpay Checkout reports a payment.failed event, or when
// the customer dismisses the checkout modal without paying. Cancels the
// order (restoring stock via the existing DB trigger) so it never sits
// around as a phantom stock hold, and so retrying checkout always starts
// a fresh, unambiguous order rather than reusing a half-paid one.
// ════════════════════════════════════════════════════════════════════════

interface RequestBody {
  orderId: string;
  reason?: string;
}

export async function POST(request: Request) {
  if (!supabaseAdmin) {
    return NextResponse.json({ ok: false }, { status: 503 });
  }

  const user = await getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  let body: RequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  if (!body.orderId) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  // Confirm the order belongs to this user, and is still unpaid, before
  // touching it — never let this cancel someone else's order, and never
  // cancel an order that has already been paid.
  const { data: order } = await supabaseAdmin
    .from("store_orders")
    .select("id, user_id, payment_status")
    .eq("id", body.orderId)
    .eq("user_id", user.id)
    .single();

  if (!order || order.payment_status === "paid") {
    return NextResponse.json({ ok: false }, { status: 404 });
  }

  await cancelOrderServer(body.orderId, body.reason?.trim() || "Payment not completed.");
  return NextResponse.json({ ok: true });
}
