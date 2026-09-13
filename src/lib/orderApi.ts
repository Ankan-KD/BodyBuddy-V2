// ════════════════════════════════════════════════════════════════════════
// BB Store — Phase 7: Order API
// All Supabase queries for placing and fetching customer orders.
// ════════════════════════════════════════════════════════════════════════

import { supabase } from "./supabase";
import { StoreOrder, OrderRow, orderFromRow, DeliveryAddress } from "./orderTypes";

// ── Razorpay checkout (server-verified) ────────────────────────────────────
// The client never computes trusted pricing or marks an order paid — those
// steps happen in src/app/api/store/checkout/*. These helpers just call
// that API with the signed-in user's access token attached.

export interface CheckoutCustomerPayload {
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  deliveryAddress: DeliveryAddress;
  /** If set, save (create/update) this as the user's default delivery profile. */
  saveProfile?: boolean;
  notes?: string;
}

export interface CreatedCheckoutOrder {
  orderId: string;
  orderNumber: string;
  amountPaise: number;
  razorpayOrderId: string;
  razorpayKeyId: string;
}

async function authHeaders(): Promise<Record<string, string>> {
  if (!supabase) return {};
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/**
 * Creates a store order (server-side, trusted pricing) and a matching
 * Razorpay order, ready to open in Razorpay Checkout.
 */
export async function createCheckoutOrder(
  payload: CheckoutCustomerPayload
): Promise<CreatedCheckoutOrder> {
  const res = await fetch("/api/store/checkout/create-order", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(await authHeaders()) },
    body: JSON.stringify(payload),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body?.error ?? "Could not start checkout.");
  return body as CreatedCheckoutOrder;
}

/** Verifies a completed Razorpay payment server-side and marks the order paid. */
export async function verifyCheckoutPayment(opts: {
  orderId: string;
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}): Promise<{ verified: boolean; order?: StoreOrder; error?: string }> {
  const res = await fetch("/api/store/checkout/verify-payment", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(await authHeaders()) },
    body: JSON.stringify(opts),
  });
  const body = await res.json();
  if (!res.ok) return { verified: false, error: body?.error ?? "Verification failed." };
  return body as { verified: boolean; order?: StoreOrder };
}

/** Marks an order's payment as failed/abandoned and releases held stock. */
export async function markCheckoutOrderFailed(
  orderId: string,
  reason: string
): Promise<void> {
  try {
    await fetch("/api/store/checkout/mark-failed", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(await authHeaders()) },
      body: JSON.stringify({ orderId, reason }),
    });
  } catch {
    // best-effort — nothing more the client can do
  }
}

// ── Fetch Customer Orders ─────────────────────────────────────────────────
//
// NOTE: there used to be a client-side `placeOrder()` helper here that
// inserted directly into store_orders / store_order_items via the anon
// Supabase client. It was dead code (never called — the real checkout
// flow below uses createCheckoutOrder, which goes through the trusted
// server route), but the RLS policies that used to allow those inserts
// were a real, independently-exploitable gap: anyone could open devtools
// and insert a fake "paid" order for any amount. Both the dead code and
// the RLS policies that made it dangerous have been removed — see
// supabase/019_remove_client_order_insert.sql.

export async function fetchMyOrders(userId: string): Promise<StoreOrder[]> {
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("store_orders")
    .select("*, store_order_items(*)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[orderApi] fetchMyOrders:", error.message);
    return [];
  }

  return (data as OrderRow[]).map(orderFromRow);
}

export async function fetchOrderById(
  orderId: string,
  userId: string
): Promise<StoreOrder | null> {
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("store_orders")
    .select("*, store_order_items(*)")
    .eq("id", orderId)
    .eq("user_id", userId)
    .single();

  if (error || !data) return null;
  return orderFromRow(data as OrderRow);
}

export async function fetchOrderByNumber(
  orderNumber: string,
  userId: string
): Promise<StoreOrder | null> {
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("store_orders")
    .select("*, store_order_items(*)")
    .eq("order_number", orderNumber)
    .eq("user_id", userId)
    .single();

  if (error || !data) return null;
  return orderFromRow(data as OrderRow);
}
