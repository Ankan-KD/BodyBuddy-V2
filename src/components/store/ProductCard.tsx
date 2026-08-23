"use client";

import Link from "next/link";
import { Star, ShoppingCart, Package } from "lucide-react";
import {
  StoreProduct,
  StoreProductVariant,
  formatPriceINR,
  discountPercent,
  defaultVariant,
  stockLabel,
  isProductAvailable,
} from "@/lib/storeTypes";
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
    <Link href={link}>
      <div
        className={cn(
          "glass-panel rounded-2xl border border-[var(--border)] shadow-soft overflow-hidden active:scale-[0.98] transition-transform",
          !available && "opacity-60"
        )}
      >
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
                "absolute top-2 left-2 text-[10px] font-bold px-2 py-0.5 rounded-full",
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
        <div className="p-3">
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
      </div>
    </Link>
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

// ── Add to cart button (placeholder — wired in Phase 3) ──────────────────

export function AddToCartButton({
  variant,
  disabled,
}: {
  variant: StoreProductVariant | null;
  disabled?: boolean;
}) {
  const unavailable = !variant || variant.availability !== "active" || variant.stockQuantity <= 0;
  return (
    <button
      disabled={disabled || unavailable}
      className={cn(
        "w-full flex items-center justify-center gap-2 font-semibold rounded-2xl py-4 shadow-soft transition-transform",
        unavailable
          ? "bg-[var(--border)] text-[var(--text-muted)] cursor-not-allowed"
          : "bg-amber-500 text-white active:scale-[0.98]"
      )}
    >
      <ShoppingCart className="w-5 h-5" />
      {unavailable ? "Unavailable" : "Add to Cart"}
    </button>
  );
}
