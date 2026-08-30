"use client";

import Link from "next/link";
import { Star, ShoppingCart, Package, Plus, Minus, Check, Heart } from "lucide-react";
import { useState, useCallback } from "react";
import {
  StoreProduct,
  StoreProductVariant,
  formatPriceINR,
  discountPercent,
  defaultVariant,
  stockLabel,
  isProductAvailable,
  isVariantPurchasable,
} from "@/lib/storeTypes";
import { useCart } from "@/lib/cartContext";
import { useWishlist } from "@/lib/wishlistContext";
import { cn } from "@/lib/utils";

// ── Skeleton ──────────────────────────────────────────────────────────────

export function ProductCardSkeleton() {
  return (
    <div className="glass-panel rounded-2xl border border-[var(--border)] overflow-hidden animate-pulse">
      <div className="h-36 bg-[var(--border)]" />
      <div className="p-3 space-y-2">
        <div className="h-3 w-1/2 rounded bg-[var(--border)]" />
        <div className="h-4 w-3/4 rounded bg-[var(--border)]" />
        <div className="h-3 w-1/3 rounded bg-[var(--border)]" />
        <div className="h-5 w-1/2 rounded bg-[var(--border)]" />
      </div>
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────

export function ProductsEmpty({ message = "No products found." }: { message?: string }) {
  return (
    <div className="col-span-2 flex flex-col items-center justify-center py-16 text-center">
      <Package className="w-10 h-10 text-[var(--text-muted)] opacity-30 mb-3" />
      <p className="text-sm text-[var(--text-muted)]">{message}</p>
    </div>
  );
}

// ── WishlistHeartButton ───────────────────────────────────────────────────

export function WishlistHeartButton({
  product,
  className,
  size = "sm",
}: {
  product: StoreProduct;
  className?: string;
  size?: "sm" | "lg";
}) {
  const { isWishlisted, toggleWishlist, updatingIds } = useWishlist();
  const wishlisted = isWishlisted(product.id);
  const isUpdating = updatingIds.has(product.id);

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      toggleWishlist(product);
    },
    [toggleWishlist, product]
  );

  return (
    <button
      onClick={handleClick}
      disabled={isUpdating}
      aria-label={wishlisted ? "Remove from wishlist" : "Add to wishlist"}
      aria-pressed={wishlisted}
      className={cn(
        "flex items-center justify-center rounded-full transition-all active:scale-90 backdrop-blur-sm",
        size === "sm" ? "w-7 h-7" : "w-11 h-11",
        wishlisted
          ? "bg-rose-500/15 text-rose-500"
          : "bg-black/10 dark:bg-white/10 text-white dark:text-white hover:bg-black/20",
        isUpdating && "opacity-60",
        className
      )}
    >
      <Heart
        className={cn(size === "sm" ? "w-3.5 h-3.5" : "w-5 h-5", wishlisted && "fill-current")}
      />
    </button>
  );
}

// ── ProductCard ───────────────────────────────────────────────────────────

interface ProductCardProps {
  product: StoreProduct;
  /** Override the default href (e.g. slug-based link) */
  href?: string;
}

export function ProductCard({ product, href }: ProductCardProps) {
  const variant: StoreProductVariant | null = product.variants
    ? defaultVariant(product.variants)
    : null;

  const price = variant?.pricePaise ?? null;
  const comparePrice = variant?.comparePricePaise ?? null;
  const discount = price && comparePrice ? discountPercent(price, comparePrice) : 0;
  const stock = variant ? stockLabel(variant) : null;
  const available = isProductAvailable(product);

  const primaryImage = product.images?.[0] ?? null;
  const link = href ?? `/store/products/${product.slug}`;

  const badgeLabel =
    product.tags.includes("bestseller") || product.tags.includes("best-seller")
      ? "Best Seller"
      : product.tags.includes("new")
      ? "New"
      : null;

  return (
    <div
      className={cn(
        "relative glass-panel rounded-2xl border border-[var(--border)] shadow-soft overflow-hidden flex flex-col",
        !available && "opacity-60"
      )}
    >
      {/* Wishlist toggle — sibling of the Link (not nested inside the <a>),
          absolutely positioned over the top-left of the image, mirroring
          the discount badge's top-right position. This container and the
          image div both start at the same y=0, so positioning it here
          (rather than inside the image div) still lines it up correctly
          while keeping the button out of the <a> tag. */}
      <WishlistHeartButton product={product} className="absolute z-10 top-2 left-2" />

      <Link href={link} className="block">
        {/* Image */}
        <div className="relative h-36 bg-gradient-to-br from-amber-500/10 to-nova-500/10 flex items-center justify-center">
          {primaryImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={primaryImage}
              alt={product.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <Package className="w-10 h-10 text-amber-500/40" />
          )}
          {badgeLabel && (
            <span
              className={cn(
                "absolute top-9 left-2 text-[10px] font-bold px-2 py-0.5 rounded-full",
                badgeLabel === "Best Seller"
                  ? "bg-amber-500/20 text-amber-600 dark:text-amber-300"
                  : "bg-nova-500/20 text-nova-600 dark:text-nova-300"
              )}
            >
              {badgeLabel}
            </span>
          )}
          {discount > 0 && (
            <span className="absolute top-2 right-2 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-300">
              -{discount}%
            </span>
          )}
        </div>

        {/* Body */}
        <div className="p-3 flex-1">
          {product.brand && (
            <p className="text-[10px] text-[var(--text-muted)] mb-0.5">{product.brand.name}</p>
          )}
          <p className="text-sm font-semibold leading-tight line-clamp-2 mb-1.5">
            {product.name}
          </p>

          {/* Rating */}
          {product.ratingCount > 0 && (
            <div className="flex items-center gap-1 mb-2">
              <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
              <span className="text-[11px] font-medium">{product.ratingAverage.toFixed(1)}</span>
              <span className="text-[10px] text-[var(--text-muted)]">
                ({product.ratingCount.toLocaleString()})
              </span>
            </div>
          )}

          {/* Price */}
          {price ? (
            <div className="flex items-baseline gap-1.5">
              <span className="font-bold text-[15px]">{formatPriceINR(price)}</span>
              {comparePrice && comparePrice > price && (
                <span className="text-[11px] text-[var(--text-muted)] line-through">
                  {formatPriceINR(comparePrice)}
                </span>
              )}
            </div>
          ) : null}

          {/* Stock label */}
          {stock && (
            <p className="text-[10px] mt-1 text-orange-500 dark:text-orange-400 font-medium">
              {stock}
            </p>
          )}
        </div>
      </Link>

      {/* Quick add button */}
      {variant && available && isVariantPurchasable(variant) && (
        <div className="px-3 pb-3">
          <QuickAddButton product={product} variant={variant} />
        </div>
      )}
    </div>
  );
}

// ── QuickAddButton (card-level, compact) ──────────────────────────────────

function QuickAddButton({
  product,
  variant,
}: {
  product: StoreProduct;
  variant: StoreProductVariant;
}) {
  const { items, addItem, updateQty, updatingIds } = useCart();
  const existing = items.find((i) => i.variantId === variant.id);
  const qty = existing?.quantity ?? 0;
  const isUpdating = updatingIds.has(variant.id);
  const atMax = qty >= variant.stockQuantity;
  const [flash, setFlash] = useState(false);

  const handleAdd = useCallback(async () => {
    await addItem(product, variant, 1);
    setFlash(true);
    setTimeout(() => setFlash(false), 800);
  }, [addItem, product, variant]);

  if (qty === 0) {
    return (
      <button
        onClick={handleAdd}
        disabled={isUpdating || atMax}
        className={cn(
          "w-full flex items-center justify-center gap-1.5 text-xs font-semibold rounded-xl py-2 transition-all active:scale-95",
          flash
            ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-300"
            : "bg-amber-500/15 text-amber-600 dark:text-amber-300 hover:bg-amber-500/25",
          (isUpdating || atMax) && "opacity-60 cursor-not-allowed"
        )}
      >
        {flash ? (
          <><Check className="w-3.5 h-3.5" /> Added</>
        ) : (
          <><ShoppingCart className="w-3.5 h-3.5" /> Add</>
        )}
      </button>
    );
  }

  return (
    <div className="flex items-center justify-between bg-amber-500/10 rounded-xl px-1 py-0.5">
      <button
        onClick={() => updateQty(variant.id, qty - 1)}
        disabled={isUpdating}
        className="w-8 h-8 flex items-center justify-center rounded-lg text-amber-600 dark:text-amber-300 hover:bg-amber-500/20 transition-colors active:scale-90 disabled:opacity-50"
        aria-label="Decrease"
      >
        <Minus className="w-3.5 h-3.5" />
      </button>
      <span className="text-sm font-bold text-amber-600 dark:text-amber-300 min-w-[20px] text-center">
        {isUpdating ? "…" : qty}
      </span>
      <button
        onClick={() => updateQty(variant.id, qty + 1)}
        disabled={isUpdating || atMax}
        className="w-8 h-8 flex items-center justify-center rounded-lg text-amber-600 dark:text-amber-300 hover:bg-amber-500/20 transition-colors active:scale-90 disabled:opacity-50"
        aria-label="Increase"
      >
        <Plus className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

// ── ProductGrid ───────────────────────────────────────────────────────────

interface ProductGridProps {
  products: StoreProduct[];
  loading?: boolean;
  emptyMessage?: string;
}

export function ProductGrid({ products, loading, emptyMessage }: ProductGridProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <ProductCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (!products.length) {
    return (
      <div className="grid grid-cols-2 gap-3">
        <ProductsEmpty message={emptyMessage} />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3">
      {products.map((p) => (
        <ProductCard key={p.id} product={p} />
      ))}
    </div>
  );
}

// ── AddToCartButton (full-width, used on product detail page) ─────────────

export function AddToCartButton({
  product,
  variant,
  disabled,
}: {
  product?: StoreProduct | null;
  variant: StoreProductVariant | null;
  disabled?: boolean;
}) {
  const { items, addItem, updateQty, updatingIds } = useCart();
  const unavailable = !variant || variant.availability !== "active" || variant.stockQuantity <= 0;

  const existing = variant ? items.find((i) => i.variantId === variant.id) : null;
  const qty = existing?.quantity ?? 0;
  const isUpdating = variant ? updatingIds.has(variant.id) : false;
  const atMax = variant ? qty >= variant.stockQuantity : false;
  const [flash, setFlash] = useState(false);

  const handleAdd = useCallback(async () => {
    if (!product || !variant) return;
    await addItem(product, variant, 1);
    setFlash(true);
    setTimeout(() => setFlash(false), 1000);
  }, [addItem, product, variant]);

  if (unavailable) {
    return (
      <button
        disabled
        className="w-full flex items-center justify-center gap-2 font-semibold rounded-2xl py-4 shadow-soft bg-[var(--border)] text-[var(--text-muted)] cursor-not-allowed"
      >
        <ShoppingCart className="w-5 h-5" />
        Unavailable
      </button>
    );
  }

  // Stepper mode when already in cart
  if (qty > 0) {
    return (
      <div className="flex items-center gap-3">
        <button
          onClick={() => updateQty(variant!.id, qty - 1)}
          disabled={isUpdating}
          className="h-14 w-14 flex items-center justify-center rounded-2xl bg-amber-500/15 text-amber-600 dark:text-amber-300 font-bold text-xl active:scale-95 transition-transform disabled:opacity-50"
          aria-label="Decrease quantity"
        >
          <Minus className="w-5 h-5" />
        </button>
        <div className="flex-1 flex flex-col items-center justify-center h-14 rounded-2xl bg-amber-500/10">
          <span className="text-lg font-bold text-amber-600 dark:text-amber-300">
            {isUpdating ? "…" : qty}
          </span>
          <span className="text-[10px] text-[var(--text-muted)]">in cart</span>
        </div>
        <button
          onClick={handleAdd}
          disabled={isUpdating || atMax || disabled}
          className={cn(
            "h-14 w-14 flex items-center justify-center rounded-2xl font-bold text-xl active:scale-95 transition-transform disabled:opacity-50",
            flash
              ? "bg-emerald-500 text-white"
              : "bg-amber-500 text-white shadow-soft"
          )}
          aria-label="Increase quantity"
        >
          {flash ? <Check className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={handleAdd}
      disabled={disabled || isUpdating || atMax}
      className={cn(
        "w-full flex items-center justify-center gap-2 font-semibold rounded-2xl py-4 shadow-soft transition-all active:scale-[0.98]",
        flash
          ? "bg-emerald-500 text-white"
          : "bg-amber-500 text-white",
        (disabled || isUpdating || atMax) && "opacity-60 cursor-not-allowed"
      )}
    >
      {flash ? (
        <><Check className="w-5 h-5" /> Added to Cart</>
      ) : isUpdating ? (
        <span className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
      ) : (
        <><ShoppingCart className="w-5 h-5" /> Add to Cart</>
      )}
    </button>
  );
}
