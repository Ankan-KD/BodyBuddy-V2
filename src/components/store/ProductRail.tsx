"use client";

import { StoreProduct } from "@/lib/storeTypes";
import { ProductCard, ProductCardSkeleton } from "./ProductCard";

interface ProductRailProps {
  products: StoreProduct[];
  loading?: boolean;
  emptyMessage?: string;
}

/**
 * Horizontal, snap-scrolling row of product cards. Used where a full
 * 2-column grid would take up too much vertical space on Store Home
 * (Deals, Recently Viewed, etc).
 */
export function ProductRail({ products, loading, emptyMessage }: ProductRailProps) {
  if (loading) {
    return (
      <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1 snap-x snap-mandatory">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="w-[42vw] max-w-[168px] shrink-0 snap-start">
            <ProductCardSkeleton />
          </div>
        ))}
      </div>
    );
  }

  if (!products.length) {
    return (
      <div className="glass-panel border border-[var(--border)] rounded-2xl px-4 py-6 text-center">
        <p className="text-sm text-[var(--text-muted)]">{emptyMessage ?? "Nothing here yet."}</p>
      </div>
    );
  }

  return (
    <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1 snap-x snap-mandatory">
      {products.map((p) => (
        <div key={p.id} className="w-[42vw] max-w-[168px] shrink-0 snap-start">
          <ProductCard product={p} />
        </div>
      ))}
    </div>
  );
}
