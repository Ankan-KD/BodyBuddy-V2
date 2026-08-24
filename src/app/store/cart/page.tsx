"use client";

import Link from "next/link";
import {
  ShoppingCart,
  ChevronRight,
  Trash2,
  Plus,
  Minus,
  Package,
  Tag,
  AlertCircle,
} from "lucide-react";
import { useCart, formatPriceINR } from "@/lib/cartContext";
import { stockLabel, isVariantPurchasable } from "@/lib/storeTypes";
import { cn } from "@/lib/utils";

// ── Cart Line Item ─────────────────────────────────────────────────────────

function CartLineItem({ item }: { item: ReturnType<typeof useCart>["items"][number] }) {
  const { updateQty, removeItem, updatingIds } = useCart();
  const isUpdating = updatingIds.has(item.variantId);
  const variant = item.variant;
  const product = item.product;

  const stock = stockLabel(variant);
  const purchasable = isVariantPurchasable(variant);
  const atMax = item.quantity >= variant.stockQuantity;
  const linePaise = variant.pricePaise * item.quantity;
  const compareLinePaise = variant.comparePricePaise
    ? variant.comparePricePaise * item.quantity
    : null;
  const hasDiscount = compareLinePaise && compareLinePaise > linePaise;

  const primaryImage =
    variant.images?.[0] ?? product.images?.[0] ?? null;

  const variantLabel = [variant.sizeLabel, variant.flavour]
    .filter(Boolean)
    .join(" · ");

  const isUnavailable =
    !product.published ||
    product.availability === "inactive" ||
    product.availability === "discontinued" ||
    !purchasable;

  return (
    <div
      className={cn(
        "glass-panel border border-[var(--border)] rounded-2xl p-3 flex gap-3",
        isUnavailable && "opacity-60"
      )}
    >
      {/* Image */}
      <Link href={`/store/products/${product.slug}`} className="shrink-0">
        <div className="w-20 h-20 rounded-xl bg-gradient-to-br from-amber-500/10 to-nova-500/10 flex items-center justify-center overflow-hidden">
          {primaryImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={primaryImage}
              alt={product.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <Package className="w-8 h-8 text-amber-500/30" />
          )}
        </div>
      </Link>

      {/* Details */}
      <div className="flex-1 min-w-0">
        <Link href={`/store/products/${product.slug}`}>
          <p className="text-sm font-semibold leading-snug line-clamp-2 mb-0.5">
            {product.name}
          </p>
        </Link>
        {variantLabel && (
          <p className="text-[11px] text-[var(--text-muted)] mb-1.5">{variantLabel}</p>
        )}

        {/* Price */}
        <div className="flex items-baseline gap-1.5 mb-2">
          <span className="font-bold text-[15px]">{formatPriceINR(linePaise)}</span>
          {hasDiscount && (
            <span className="text-[11px] text-[var(--text-muted)] line-through">
              {formatPriceINR(compareLinePaise!)}
            </span>
          )}
        </div>

        {/* Stock warning */}
        {stock && (
          <p className="text-[10px] text-orange-500 dark:text-orange-400 font-medium mb-1.5">
            {stock}
          </p>
        )}

        {/* Unavailable warning */}
        {isUnavailable && (
          <div className="flex items-center gap-1 text-[10px] text-red-500 dark:text-red-400 mb-1.5">
            <AlertCircle className="w-3 h-3 shrink-0" />
            <span>
              {product.availability === "discontinued"
                ? "Discontinued"
                : "Currently unavailable"}
            </span>
          </div>
        )}

        {/* Qty stepper + remove */}
        <div className="flex items-center gap-2">
          {!isUnavailable ? (
            <div className="flex items-center bg-amber-500/10 rounded-xl overflow-hidden">
              <button
                onClick={() => updateQty(item.variantId, item.quantity - 1)}
                disabled={isUpdating}
                className="w-8 h-8 flex items-center justify-center text-amber-600 dark:text-amber-300 hover:bg-amber-500/20 transition-colors active:scale-90 disabled:opacity-50"
                aria-label="Decrease quantity"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
              <span className="text-sm font-bold text-amber-600 dark:text-amber-300 min-w-[28px] text-center">
                {isUpdating ? "…" : item.quantity}
              </span>
              <button
                onClick={() => updateQty(item.variantId, item.quantity + 1)}
                disabled={isUpdating || atMax}
                className="w-8 h-8 flex items-center justify-center text-amber-600 dark:text-amber-300 hover:bg-amber-500/20 transition-colors active:scale-90 disabled:opacity-50"
                aria-label="Increase quantity"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <span className="text-xs text-[var(--text-muted)]">Qty: {item.quantity}</span>
          )}

          <button
            onClick={() => removeItem(item.variantId)}
            disabled={isUpdating}
            className="ml-auto w-8 h-8 flex items-center justify-center rounded-xl text-[var(--text-muted)] hover:text-red-500 hover:bg-red-500/10 transition-colors active:scale-90 disabled:opacity-50"
            aria-label="Remove item"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Order Summary Card ─────────────────────────────────────────────────────

function OrderSummary() {
  const { totals, items } = useCart();

  const unavailableCount = items.filter(
    (i) =>
      !i.product.published ||
      i.product.availability === "inactive" ||
      i.product.availability === "discontinued" ||
      i.variant.availability !== "active"
  ).length;

  return (
    <div className="glass-panel border border-[var(--border)] rounded-2xl p-4 mb-4">
      <h2 className="font-display text-base font-semibold mb-3">Order Summary</h2>

      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-[var(--text-muted)]">
            Subtotal ({totals.itemCount} {totals.itemCount === 1 ? "item" : "items"})
          </span>
          <span className="font-semibold">{formatPriceINR(totals.subtotalPaise)}</span>
        </div>

        {totals.savingsPaise > 0 && (
          <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
            <span className="flex items-center gap-1">
              <Tag className="w-3.5 h-3.5" /> You save
            </span>
            <span className="font-semibold">-{formatPriceINR(totals.savingsPaise)}</span>
          </div>
        )}

        <div className="flex justify-between">
          <span className="text-[var(--text-muted)]">Delivery</span>
          <span className="font-semibold text-emerald-600 dark:text-emerald-400">Free</span>
        </div>

        <div className="border-t border-[var(--border)] pt-2 mt-1 flex justify-between">
          <span className="font-semibold">Total</span>
          <span className="font-bold text-lg">{formatPriceINR(totals.totalPaise)}</span>
        </div>
      </div>

      {unavailableCount > 0 && (
        <div className="mt-3 flex items-start gap-2 p-2.5 rounded-xl bg-red-500/10 border border-red-500/20">
          <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
          <p className="text-xs text-red-500 dark:text-red-400">
            {unavailableCount} item{unavailableCount > 1 ? "s are" : " is"} currently
            unavailable and won&apos;t be included in your order.
          </p>
        </div>
      )}

      <Link
        href="/store/checkout"
        className={cn(
          "mt-4 w-full flex items-center justify-center gap-2 bg-amber-500 text-white font-semibold rounded-2xl py-3.5 shadow-soft active:scale-[0.98] transition-transform",
          unavailableCount === items.length && "pointer-events-none opacity-50"
        )}
      >
        Proceed to Checkout <ChevronRight className="w-4 h-4" />
      </Link>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function CartPage() {
  const { items, loading } = useCart();

  if (loading) {
    return (
      <div className="px-4 pt-4 space-y-3 animate-pulse">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-28 rounded-2xl bg-[var(--border)]" />
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="px-4 pt-4 flex flex-col min-h-[70vh]">
        <h1 className="font-display text-xl font-semibold mb-4">Your Cart</h1>

        <div className="flex-1 flex flex-col items-center justify-center text-center py-16">
          <div className="w-20 h-20 rounded-full bg-amber-500/10 flex items-center justify-center mb-4">
            <ShoppingCart className="w-9 h-9 text-amber-500/60" />
          </div>
          <h2 className="font-display text-lg font-semibold mb-1">Cart is empty</h2>
          <p className="text-sm text-[var(--text-muted)] mb-6 max-w-[220px]">
            Add products from the store to get started.
          </p>
          <Link
            href="/store"
            className="inline-flex items-center gap-1.5 text-sm font-semibold px-5 py-2.5 rounded-xl bg-amber-500 text-white shadow-soft active:scale-95 transition-transform"
          >
            Browse Store <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 pt-4">
      <div className="flex items-center justify-between mb-4">
        <h1 className="font-display text-xl font-semibold">Your Cart</h1>
        <span className="text-sm text-[var(--text-muted)]">
          {items.length} {items.length === 1 ? "item" : "items"}
        </span>
      </div>

      {/* Line items */}
      <div className="space-y-3 mb-4">
        {items.map((item) => (
          <CartLineItem key={item.id} item={item} />
        ))}
      </div>

      {/* Continue shopping */}
      <Link
        href="/store"
        className="block text-center text-sm text-amber-500 dark:text-amber-400 font-medium mb-4"
      >
        + Continue Shopping
      </Link>

      {/* Order summary */}
      <OrderSummary />
    </div>
  );
}
