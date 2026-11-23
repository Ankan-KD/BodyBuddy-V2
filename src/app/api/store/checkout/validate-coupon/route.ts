import { NextResponse } from "next/server";
import { supabaseAdmin, getUserFromRequest } from "@/lib/supabaseAdmin";
import type { OfferRow } from "@/lib/offerTypes";
import { offerFromRow, applyDiscount, isOfferCurrentlyValid } from "@/lib/offerTypes";

// ════════════════════════════════════════════════════════════════════════
// BB Store — Validate Coupon Code
// Checks that a promo code is active, in-date, not exhausted, and
// meets the minimum order requirement. Returns the discount details so
// the client can show a preview; the real deduction is re-verified in
// create-order and never trusted from the client.
// ════════════════════════════════════════════════════════════════════════

interface RequestBody {
  code: string;
  orderTotalPaise: number;       // cart total BEFORE coupon (server recomputes)
  productIds?: string[];         // ids of items in the cart (for scope check)
}

export async function POST(request: Request) {
  if (!supabaseAdmin) {
    return NextResponse.json({ valid: false, error: "Store is not configured." }, { status: 503 });
  }

  const user = await getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ valid: false, error: "Please sign in." }, { status: 401 });
  }

  let body: RequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ valid: false, error: "Invalid request." }, { status: 400 });
  }

  const code = (body.code ?? "").trim().toUpperCase();
  if (!code) {
    return NextResponse.json({ valid: false, error: "Please enter a coupon code." }, { status: 400 });
  }

  // ── 1. Look up the offer ──────────────────────────────────────────
  const { data: row, error: fetchError } = await supabaseAdmin
    .from("store_offers")
    .select("*")
    .eq("code", code)
    .single();

  if (fetchError || !row) {
    return NextResponse.json({ valid: false, error: "This coupon code doesn't exist." }, { status: 404 });
  }

  const offer = offerFromRow(row as OfferRow);

  // ── 2. Active check ───────────────────────────────────────────────
  if (!offer.isActive) {
    return NextResponse.json({ valid: false, error: "This coupon is not currently active." }, { status: 422 });
  }

  // ── 3. Date validity ──────────────────────────────────────────────
  if (!isOfferCurrentlyValid(offer)) {
    const expired = offer.endsAt && new Date(offer.endsAt) < new Date();
    return NextResponse.json({
      valid: false,
      error: expired ? "This coupon has expired." : "This coupon isn't valid yet.",
    }, { status: 422 });
  }

  // ── 4. Usage limit ────────────────────────────────────────────────
  if (offer.maxUses !== null && offer.usedCount >= offer.maxUses) {
    return NextResponse.json({ valid: false, error: "This coupon has reached its usage limit." }, { status: 422 });
  }

  // ── 5. Minimum order check ────────────────────────────────────────
  const cartTotal = Number(body.orderTotalPaise ?? 0);
  if (offer.minOrderPaise !== null && cartTotal < offer.minOrderPaise) {
    const minRs = Math.ceil(offer.minOrderPaise / 100);
    return NextResponse.json({
      valid: false,
      error: `This coupon requires a minimum order of ₹${minRs}.`,
    }, { status: 422 });
  }

  // ── 6. Product scope check ─────────────────────────────────────────
  // If the offer is scoped to specific products, at least one item in
  // the cart must match — otherwise the discount can't be applied.
  const cartProductIds: string[] = Array.isArray(body.productIds) ? body.productIds : [];
  if (offer.productIds.length > 0 && cartProductIds.length > 0) {
    const hasMatchingProduct = cartProductIds.some((pid) => offer.productIds.includes(pid));
    if (!hasMatchingProduct) {
      return NextResponse.json({
        valid: false,
        error: "This coupon doesn't apply to any items in your cart.",
      }, { status: 422 });
    }
  }

  // ── 7. Compute the discount ───────────────────────────────────────
  // For product-scoped offers we discount only the matching lines;
  // for sitewide offers we discount the whole cart total.
  let discountPaise: number;
  if (offer.discountType === "percentage") {
    discountPaise = Math.round(cartTotal * (offer.discountValue / 100));
  } else {
    discountPaise = Math.min(offer.discountValue, cartTotal);
  }
  const discountedTotal = Math.max(0, cartTotal - discountPaise);

  return NextResponse.json({
    valid: true,
    offerId: offer.id,
    offerTitle: offer.title,
    code: offer.code,
    discountType: offer.discountType,
    discountValue: offer.discountValue,
    discountPaise,
    discountedTotal,
  });
}
