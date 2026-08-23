"use client";

import { useState } from "react";
import { LayoutGrid, List } from "lucide-react";
import { useProducts } from "@/lib/useStoreData";
import { ProductGrid } from "@/components/store/ProductCard";
import { ProductList } from "@/components/store/ProductListItem";
import { StoreFilterBar } from "@/components/store/StoreFilterBar";
import { FetchProductsOptions } from "@/lib/storeApi";
import { cn } from "@/lib/utils";

const FILTERS: { label: string; opts: Partial<FetchProductsOptions>; key: string }[] = [
  { label: "All",          key: "all",      opts: {}                                              },
  { label: "Featured",     key: "featured", opts: { featured: true }                              },
  { label: "Top Rated",    key: "rated",    opts: { orderBy: "rating_average", orderDir: "desc" } },
  { label: "New Arrivals", key: "new",      opts: { orderBy: "created_at",     orderDir: "desc" } },
];

export default function ProductsPage() {
  const [activeKey, setActiveKey] = useState("all");
  const [goal, setGoal] = useState<string | null>(null);
  const [view, setView] = useState<"grid" | "list">("grid");

  const activeFilter = FILTERS.find((f) => f.key === activeKey) ?? FILTERS[0];
  const { data: products, loading } = useProducts({
    limit: 40,
    ...activeFilter.opts,
    healthGoalTag: goal ?? undefined,
  });

  return (
    <div className="px-4 pt-4">
      <div className="flex items-center justify-between mb-4">
        <h1 className="font-display text-xl font-semibold">All Products</h1>
        <div className="flex items-center gap-1 glass-panel border border-[var(--border)] rounded-xl p-1">
          <button
            onClick={() => setView("grid")}
            aria-label="Grid view"
            className={cn(
              "h-7 w-7 flex items-center justify-center rounded-lg transition-colors",
              view === "grid" ? "bg-amber-500/15 text-amber-600 dark:text-amber-300" : "text-[var(--text-muted)]"
            )}
          >
            <LayoutGrid className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setView("list")}
            aria-label="List view"
            className={cn(
              "h-7 w-7 flex items-center justify-center rounded-lg transition-colors",
              view === "list" ? "bg-amber-500/15 text-amber-600 dark:text-amber-300" : "text-[var(--text-muted)]"
            )}
          >
            <List className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <StoreFilterBar
        sortOptions={FILTERS.map((f) => ({ label: f.label, value: f.key }))}
        sortValue={activeKey}
        onSortChange={setActiveKey}
        goalValue={goal}
        onGoalChange={setGoal}
      />

      {!loading && products.length > 0 && (
        <p className="text-xs text-[var(--text-muted)] mb-3">{products.length} products</p>
      )}

      {view === "grid" ? (
        <ProductGrid products={products} loading={loading} emptyMessage="No products match these filters." />
      ) : (
        <ProductList products={products} loading={loading} emptyMessage="No products match these filters." />
      )}

      <div className="h-4" />
    </div>
  );
}
