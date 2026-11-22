import { NextResponse, after } from "next/server";
import { supabaseAdmin, getUserFromRequest } from "@/lib/supabaseAdmin";
import { orderFromRow, type OrderRow, type OrderStatus } from "@/lib/orderTypes";
import { sendOrderStatusUpdateEmail } from "@/lib/orderStatusEmail";

// ════════════════════════════════════════════════════════════════════════
// BB Store Admin — Update Order Status (Phase 2: Status-Update Emails)
//
// Server-side route so we can:
//   1. Verify the caller is an authenticated admin (via user_security,
//      migration 017).
//   2. Read the PREVIOUS status before writing the new one.
//   3. Guard against duplicate updates (idempotency).
//   4. Send the status-update email — after the DB write succeeds —
//      without letting a mailer failure affect the saved status.
//
// Method : POST
// Body   : { orderId: string; newStatus: OrderStatus }
// Returns: { ok: true } | { ok: false; error: string }
// ════════════════════════════════════════════════════════════════════════

// Valid status values — mirrors orderTypes.ts OrderStatus union.
const VALID_STATUSES = new Set<OrderStatus>([
  "placed",
  "confirmed",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
]);

export async function POST(request: Request) {
  if (!supabaseAdmin) {
    return NextResponse.json({ ok: false, error: "Server not configured." }, { status: 503 });
  }

  // ── 1. Authenticate ──────────────────────────────────────────────────
  const user = await getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }

  // ── 2. Verify caller is an admin (reads user_security, migration 017) ─
  const { data: security, error: securityError } = await supabaseAdmin
    .from("user_security")
    .select("is_store_admin")
    .eq("user_id", user.id)
    .single();

  if (securityError || !security?.is_store_admin) {
    return NextResponse.json({ ok: false, error: "Forbidden." }, { status: 403 });
  }

  // ── 3. Parse & validate body ─────────────────────────────────────────
  let body: { orderId?: string; newStatus?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body." }, { status: 400 });
  }

  const { orderId, newStatus } = body ?? {};

  if (!orderId || typeof orderId !== "string") {
    return NextResponse.json({ ok: false, error: "orderId is required." }, { status: 400 });
  }
  if (!newStatus || !VALID_STATUSES.has(newStatus as OrderStatus)) {
    return NextResponse.json(
      { ok: false, error: `Invalid status: "${newStatus}".` },
      { status: 400 }
    );
  }

  const typedStatus = newStatus as OrderStatus;

  // ── 4. Fetch the current order (with items for the email) ────────────
  const { data: currentRow, error: fetchError } = await supabaseAdmin
    .from("store_orders")
    .select("*, store_order_items(*)")
    .eq("id", orderId)
    .single();

  if (fetchError || !currentRow) {
    return NextResponse.json({ ok: false, error: "Order not found." }, { status: 404 });
  }

  const previousStatus = currentRow.status as OrderStatus;

  // ── 5. Idempotency guard — status already set, nothing to do ─────────
  if (previousStatus === typedStatus) {
    return NextResponse.json({ ok: true, alreadySet: true });
  }

  // ── 6. Write the new status to the database ───────────────────────────
  // .eq("status", previousStatus) is a compare-and-swap: if another request
  // already changed the status between our read and this write, the update
  // matches zero rows and we skip the email (no duplicate for the customer).
  const { data: updatedRows, error: updateError } = await supabaseAdmin
    .from("store_orders")
    .update({ status: typedStatus, updated_at: new Date().toISOString() })
    .eq("id", orderId)
    .eq("status", previousStatus)
    .select("*, store_order_items(*)")
    .single();

  if (updateError || !updatedRows) {
    const { data: recheck } = await supabaseAdmin
      .from("store_orders")
      .select("status")
      .eq("id", orderId)
      .single();

    if (recheck?.status === typedStatus) {
      return NextResponse.json({ ok: true, alreadySet: true });
    }

    const msg = updateError?.message ?? "Failed to update order status.";
    console.error(`[update-order-status] DB update failed for order ${orderId}:`, msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }

  // ── 7. DB write succeeded — now send the status-update email ─────────
  const updatedOrder = orderFromRow(updatedRows as OrderRow);
  after(() => sendOrderStatusUpdateEmail(updatedOrder, previousStatus));

  return NextResponse.json({ ok: true });
}
