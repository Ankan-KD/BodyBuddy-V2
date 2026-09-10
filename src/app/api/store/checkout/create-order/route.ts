import { NextResponse } from "next/server";
import { supabaseAdmin, getUserFromRequest } from "@/lib/supabaseAdmin";
import { createRazorpayOrder } from "@/lib/razorpayServer";
import { cancelOrderServer } from "@/lib/storeOrderServer";
import type { DeliveryAddress } from "@/lib/orderTypes";

// ════════════════════════════════════════════════════════════════════════
// BB Store — Create Checkout Order
// 1. Authenticates the caller.
// 2. Loads their SERVER-SIDE cart and recomputes pricing from the DB
//    (never trusts amounts from the client).
// 3. Creates the store_orders + store_order_items rows (this also
//    triggers the existing inventory-deduction DB trigger).
// 4. Creates a matching Razorpay order.
// Cart is intentionally NOT cleared here — only after payment is
// verified, so a failed/abandoned attempt leaves the cart intact.
// ════════════════════════════════════════════════════════════════════════

interface RequestBody {
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  deliveryAddress: DeliveryAddress;
  notes?: string;
}

export async function POST(request: Request) {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Store checkout is not configured on the server." }, { status: 503 });
  }

  const user = await getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: "Please sign in to check out." }, { status: 401 });
  }

  let body: RequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const { customerName, customerEmail, customerPhone, deliveryAddress, notes } = body ?? {};
  if (!customerName?.trim() || !customerEmail?.trim() || !customerPhone?.trim()) {
    return NextResponse.json({ error: "Name, email and phone are required." }, { status: 400 });
  }
  if (
    !deliveryAddress?.line1?.trim() ||
    !deliveryAddress?.city?.trim() ||
    !deliveryAddress?.state?.trim() ||
    !deliveryAddress?.pincode?.trim()
  ) {
    return NextResponse.json({ error: "A complete delivery address is required." }, { status: 400 });
  }

  // ── 1. Load the user's cart (joined with live product/variant data)
  //      and generate the order number in parallel — neither depends on
  //      the other's result, so running them sequentially was just
  //      adding two round-trips' worth of latency for nothing.
  const [{ data: cartRows, error: cartError }, { data: numData, error: numError }] = await Promise.all([
    supabaseAdmin
      .from("store_cart_items")
      .select(
        `id, quantity, product_id, variant_id,
         store_product_variants ( id, sku, name, size_label, flavour, price_paise, compare_price_paise, stock_quantity, availability, images,
           store_products ( id, name, images, published, availability ) )`
      )
      .eq("user_id", user.id),
    supabaseAdmin.rpc("generate_order_number"),
  ]);

  if (cartError) {
    return NextResponse.json({ error: `Could not load your cart: ${cartError.message}` }, { status: 500 });
  }
  if (numError) {
    return NextResponse.json({ error: `Could not generate an order number: ${numError.message}` }, { status: 500 });
  }
  const orderNumber = numData as string;

  type CartJoinRow = {
    id: string;
    quantity: number;
    product_id: string;
    variant_id: string;
    store_product_variants: {
      id: string;
      sku: string;
      name: string;
      size_label: string;
      flavour: string;
      price_paise: number;
      compare_price_paise: number | null;
      stock_quantity: number;
      availability: string;
      images: string[];
      store_products: {
        id: string;
        name: string;
        images: string[];
        published: boolean;
        availability: string;
      } | null;
    } | null;
  };

  const rows = (cartRows ?? []) as unknown as CartJoinRow[];

  // Only available, purchasable items count toward the order — mirrors the
  // client-side filter on the checkout Review step.
  const purchasable = rows.filter((r) => {
    const v = r.store_product_variants;
    const p = v?.store_products;
    return v && p && p.published && p.availability === "active" && v.availability === "active";
  });

  if (purchasable.length === 0) {
    return NextResponse.json({ error: "Your cart is empty or its items are no longer available." }, { status: 400 });
  }

  // ── 2. Stock check ──────────────────────────────────────────────────
  for (const row of purchasable) {
    const v = row.store_product_variants!;
    if (v.stock_quantity < row.quantity) {
      return NextResponse.json(
        { error: `Only ${v.stock_quantity} unit(s) of "${v.store_products!.name}" available. Please update your cart.` },
        { status: 400 }
      );
    }
  }

  // ── 3. Trusted pricing (server-computed, never from the client) ──────
  let subtotalOriginalPaise = 0; // sum of compare-or-actual price
  let discountPaise = 0;
  let totalPaise = 0;
  for (const row of purchasable) {
    const v = row.store_product_variants!;
    const price = Number(v.price_paise);
    const compare = v.compare_price_paise != null ? Number(v.compare_price_paise) : null;
    subtotalOriginalPaise += (compare && compare > price ? compare : price) * row.quantity;
    if (compare && compare > price) discountPaise += (compare - price) * row.quantity;
    totalPaise += price * row.quantity;
  }

  if (totalPaise < 100) {
    return NextResponse.json({ error: "Order total must be at least ₹1." }, { status: 400 });
  }

  // ── 5. Insert the order row (payment_status starts pending) ─────────
  const { data: orderData, error: orderError } = await supabaseAdmin
    .from("store_orders")
    .insert({
      order_number: orderNumber,
      user_id: user.id,
      customer_name: customerName.trim(),
      customer_email: customerEmail.trim(),
      customer_phone: customerPhone.trim(),
      delivery_address: deliveryAddress,
      payment_method: "razorpay",
      payment_status: "pending",
      subtotal_paise: subtotalOriginalPaise,
      discount_paise: discountPaise,
      delivery_paise: 0,
      total_paise: totalPaise,
      status: "placed",
      notes: notes ?? "",
    })
    .select()
    .single();

  if (orderError || !orderData) {
    return NextResponse.json({ error: `Failed to create order: ${orderError?.message}` }, { status: 500 });
  }
  const orderId = orderData.id as string;

  // ── 6. Insert order items (snapshot; also deducts inventory via trigger) ─
  const itemRows = purchasable.map((row) => {
    const v = row.store_product_variants!;
    const p = v.store_products!;
    const primaryImage = v.images?.[0] ?? p.images?.[0] ?? null;
    const variantLabel = [v.size_label, v.flavour].filter(Boolean).join(" – ");
    return {
      order_id: orderId,
      product_id: p.id,
      variant_id: v.id,
      product_name: p.name,
      variant_name: variantLabel || v.name,
      sku: v.sku,
      image_url: primaryImage,
      unit_price_paise: v.price_paise,
      compare_price_paise: v.compare_price_paise,
      quantity: row.quantity,
      line_total_paise: v.price_paise * row.quantity,
    };
  });

  const { error: itemsError } = await supabaseAdmin.from("store_order_items").insert(itemRows);
  if (itemsError) {
    // Nothing was deducted (single insert statement — atomic), so a
    // plain delete is safe here; no inventory to restore.
    await supabaseAdmin.from("store_orders").delete().eq("id", orderId);
    return NextResponse.json({ error: `Failed to save order items: ${itemsError.message}` }, { status: 500 });
  }

  // ── 7. Create the Razorpay order ─────────────────────────────────────
  const { order: rpOrder, error: rpError } = await createRazorpayOrder({
    amountPaise: totalPaise,
    receipt: orderNumber,
    notes: { store_order_id: orderId, order_number: orderNumber },
  });

  if (!rpOrder) {
    // Inventory WAS deducted by the item-insert trigger — cancel (not
    // delete) so the existing restore-on-cancel trigger returns stock.
    await cancelOrderServer(orderId, `Razorpay order creation failed: ${rpError}`);
    return NextResponse.json({ error: rpError ?? "Could not start payment. Please try again." }, { status: 502 });
  }

  await supabaseAdmin.from("store_orders").update({ razorpay_order_id: rpOrder.id }).eq("id", orderId);

  return NextResponse.json({
    orderId,
    orderNumber,
    amountPaise: totalPaise,
    razorpayOrderId: rpOrder.id,
    razorpayKeyId: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
  });
}
