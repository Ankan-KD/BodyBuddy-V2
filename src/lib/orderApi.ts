// ════════════════════════════════════════════════════════════════════════
// BB Store — Phase 7: Order API
// All Supabase queries for placing and fetching customer orders.
// ════════════════════════════════════════════════════════════════════════

import { supabase } from "./supabase";
import {
  StoreOrder,
  OrderRow,
  orderFromRow,
  CreateOrderPayload,
} from "./orderTypes";
import { CartItem, calcTotals } from "./cartContext";

// ── Place Order ───────────────────────────────────────────────────────────

/**
 * Converts the user's cart into a placed order.
 * Steps:
 *  1. Generate order number.
 *  2. Insert store_orders row.
 *  3. Insert store_order_items rows (one per cart item).
 *  4. Clear the user's cart.
 * Returns the new order id on success, or throws on error.
 */
export async function placeOrder(
  userId: string,
  cartItems: CartItem[],
  payload: CreateOrderPayload
): Promise<StoreOrder> {
  if (!supabase) throw new Error("Supabase is not configured.");
  if (!cartItems.length) throw new Error("Cart is empty.");

  // ── Pre-flight stock check ──────────────────────────────────────────
  // Verify each variant still has sufficient stock before committing
  const variantIds = cartItems
    .map((i) => i.variantId)
    .filter(Boolean) as string[];

  if (variantIds.length > 0) {
    const { data: stockData, error: stockError } = await supabase
      .from("store_product_variants")
      .select("id, stock_quantity, availability, name")
      .in("id", variantIds);

    if (stockError) throw new Error(`Stock check failed: ${stockError.message}`);

    const stockMap = new Map(
      (stockData ?? []).map((r: { id: string; stock_quantity: number; availability: string; name: string }) => [r.id, r])
    );

    for (const item of cartItems) {
      const stock = stockMap.get(item.variantId);
      if (!stock) continue;
      if (stock.availability === "out_of_stock" || stock.stock_quantity === 0) {
        throw new Error(
          `"${item.product.name}${item.variant.name ? ` (${item.variant.name})` : ""}" is out of stock.`
        );
      }
      if (stock.stock_quantity < item.quantity) {
        throw new Error(
          `Only ${stock.stock_quantity} unit${stock.stock_quantity !== 1 ? "s" : ""} of "${item.product.name}" available. Please update your cart.`
        );
      }
    }
  }

  const totals = calcTotals(cartItems);

  // 1. Generate order number via DB function
  const { data: numData, error: numError } = await supabase.rpc(
    "generate_order_number"
  );
  if (numError) throw new Error(`Order number generation failed: ${numError.message}`);
  const orderNumber = numData as string;

  // 2. Insert the order row
  const { data: orderData, error: orderError } = await supabase
    .from("store_orders")
    .insert({
      order_number: orderNumber,
      user_id: userId,
      customer_name: payload.customerName,
      customer_email: payload.customerEmail,
      customer_phone: payload.customerPhone,
      delivery_address: payload.deliveryAddress,
      payment_method: payload.paymentMethod,
      payment_status: payload.paymentMethod === "cod" ? "pending" : "pending",
      subtotal_paise: totals.subtotalPaise + totals.savingsPaise, // original price total
      discount_paise: totals.savingsPaise,
      delivery_paise: 0,
      total_paise: totals.totalPaise,
      status: "placed",
      notes: payload.notes ?? "",
    })
    .select()
    .single();

  if (orderError) throw new Error(`Failed to create order: ${orderError.message}`);
  const order = orderFromRow(orderData as OrderRow);

  // 3. Insert order items (snapshot product/variant data at purchase time)
  const itemRows = cartItems.map((item) => {
    const primaryImage =
      item.variant.images?.[0] ?? item.product.images?.[0] ?? null;
    const variantLabel = [item.variant.sizeLabel, item.variant.flavour]
      .filter(Boolean)
      .join(" – ");

    return {
      order_id: order.id,
      product_id: item.productId,
      variant_id: item.variantId,
      product_name: item.product.name,
      variant_name: variantLabel || item.variant.name,
      sku: item.variant.sku,
      image_url: primaryImage,
      unit_price_paise: item.variant.pricePaise,
      compare_price_paise: item.variant.comparePricePaise,
      quantity: item.quantity,
      line_total_paise: item.variant.pricePaise * item.quantity,
    };
  });

  const { error: itemsError } = await supabase
    .from("store_order_items")
    .insert(itemRows);

  if (itemsError) {
    // Attempt to rollback by deleting the order (best-effort)
    await supabase.from("store_orders").delete().eq("id", order.id);
    throw new Error(`Failed to save order items: ${itemsError.message}`);
  }

  // 4. Clear the user's cart
  await supabase
    .from("store_cart_items")
    .delete()
    .eq("user_id", userId);

  return order;
}

// ── Fetch Customer Orders ─────────────────────────────────────────────────

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
