"use client";

import { Tag } from "lucide-react";
import { useDealProducts } from "@/lib/useStoreData";
import { ProductGrid } from "@/components/store/ProductCard";

export default function DealsPage() {
  const { data: products, loading } = useDealProducts(40);

  return (
    <div className="px-4 pt-4">
      <div className="flex items-center gap-2 mb-1">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-emerald-500/10 shrink-0">
          <Tag className="w-4.5 h-4.5 text-emerald-500 dark:text-emerald-400" />
        </div>
        <h1 className="font-display text-xl font-semibold">Deals</h1>
      </div>
      <p className="text-sm text-[var(--text-muted)] mb-4">Products currently on promotional pricing.</p>

      {!loading && products.length > 0 && (
        <p className="text-xs text-[var(--text-muted)] mb-3">{products.length} deals</p>
      )}

      <ProductGrid
        products={products}
        loading={loading}
        emptyMessage="No active deals right now. Check back soon."
      />

      <div className="h-4" />
    </div>
  );
}
