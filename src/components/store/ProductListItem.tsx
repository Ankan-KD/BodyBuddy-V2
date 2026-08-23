"use client";

import Link from "next/link";
import { Package, Star } from "lucide-react";
import {
  StoreProduct,
  formatPriceINR,
  discountPercent,
  defaultVariant,
  stockLabel,
  isProductAvailable,
} from "@/lib/storeTypes";
import { cn } from "@/lib/utils";
import { ProductsEmpty } from "./ProductCard";

// ── Skeleton ──────────────────────────────────────────────────────────────

function ProductListItemSkeleton() {
  return (
    <div className="flex items-center gap-3 glass-panel border border-[var(--border)] rounded-2xl p-2.5 animate-pulse">
      <div className="w-16 h-16 rounded-xl bg-[var(--border)] shrink-0" />
      <div className="flex-1 space-y-1.5 py-1">
        <div className="h-3 w-1/3 rounded bg-[var(--border)]" />
        <div className="h-4 w-3/4 rounded bg-[var(--border)]" />
        <div className="h-4 w-1/3 rounded bg-[var(--border)]" />
      </div>
    </div>
  );
}

// ── Row ───────────────────────────────────────────────────────────────────

export function ProductListItem({ product }: { product: StoreProduct }) {
  const variant = product.variants ? defaultVariant(product.variants) : null;
  const price = variant?.pricePaise ?? null;
  const comparePrice = variant?.comparePricePaise ?? null;
  const discount = price && comparePrice ? discountPercent(price, comparePrice) : 0;
  const stock = variant ? stockLabel(variant) : null;
  const available = isProductAvailable(product);
  const primaryImage = product.images?.[0] ?? null;

  return (
    <Link href={`/store/products/${product.slug}`}>
      <div
        className={cn(
          "flex items-center gap-3 glass-panel border border-[var(--border)] rounded-2xl p-2.5 shadow-soft active:scale-[0.99] transition-transform",
          !available && "opacity-60"
        )}
      >
        <div className="relative w-16 h-16 rounded-xl bg-gradient-to-br from-amber-500/10 to-nova-500/10 flex items-center justify-center shrink-0 overflow-hidden">
          {primaryImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={primaryImage} alt={product.name} className="w-full h-full object-cover" />
          ) : (
            <Package className="w-6 h-6 text-amber-500/40" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          {product.brand && (
            <p className="text-[10px] text-[var(--text-muted)] mb-0.5">{product.brand.name}</p>
          )}
          <p className="text-sm font-semibold leading-tight line-clamp-2">{product.name}</p>

          <div className="flex items-center gap-2 mt-1">
            {price ? (
              <span className="font-bold text-sm">{formatPriceINR(price)}</span>
            ) : null}
            {comparePrice && price && comparePrice > price && (
              <span className="text-[11px] text-[var(--text-muted)] line-through">
                {formatPriceINR(comparePrice)}
              </span>
            )}
            {discount > 0 && (
              <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                {discount}% off
              </span>
            )}
          </div>

          {product.ratingCount > 0 ? (
            <div className="flex items-center gap-1 mt-1">
              <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
              <span className="text-[11px] text-[var(--text-muted)]">
                {product.ratingAverage.toFixed(1)} ({product.ratingCount.toLocaleString()})
              </span>
            </div>
          ) : stock ? (
            <p className="text-[11px] mt-1 text-orange-500 dark:text-orange-400 font-medium">{stock}</p>
          ) : null}
        </div>
      </div>
    </Link>
  );
}

// ── List ──────────────────────────────────────────────────────────────────

interface ProductListProps {
  products: StoreProduct[];
  loading?: boolean;
  emptyMessage?: string;
}

export function ProductList({ products, loading, emptyMessage }: ProductListProps) {
  if (loading) {
    return (
      <div className="space-y-2.5">
        {Array.from({ length: 4 }).map((_, i) => (
          <ProductListItemSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (!products.length) {
    return <ProductsEmpty message={emptyMessage} />;
  }

  return (
    <div className="space-y-2.5">
      {products.map((p) => (
        <ProductListItem key={p.id} product={p} />
      ))}
    </div>
  );
}
