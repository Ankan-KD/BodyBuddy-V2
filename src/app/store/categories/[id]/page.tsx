"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useCategoryBySlug, useSubcategories, useProducts, useProductTypesForCategory } from "@/lib/useStoreData";
import { ProductGrid } from "@/components/store/ProductCard";
import { CategoryIcon } from "@/components/store/CategoryIcon";
import { StoreFilterBar, SortOption } from "@/components/store/StoreFilterBar";

const SORT_OPTIONS: SortOption[] = [
  { label: "Featured",  value: "sort_order"     },
  { label: "Top Rated", value: "rating_average" },
  { label: "Newest",    value: "created_at"     },
];

export default function CategoryDetailPage() {
  const params = useParams();
  const slug = params.id as string;

  const [sort, setSort] = useState("sort_order");
  const [goal, setGoal] = useState<string | null>(null);
  const [type, setType] = useState<string | null>(null);

  const { data: category, loading: catLoading } = useCategoryBySlug(slug);
  const { data: subcategories } = useSubcategories(category?.id ?? null);
  const { data: types } = useProductTypesForCategory(slug);
  const { data: products, loading: prodLoading } = useProducts({
    categorySlug: slug,
    limit: 30,
    orderBy: sort as "sort_order" | "rating_average" | "created_at",
    orderDir: sort === "sort_order" ? "asc" : "desc",
    healthGoalTag: goal ?? undefined,
    productType: type ?? undefined,
  });

  const title = category?.name ?? slug.split("-").map((w) => w[0].toUpperCase() + w.slice(1)).join(" ");

  // Reset the Type filter when navigating to a different category
  useEffect(() => { setType(null); }, [slug]);

  return (
    <div className="px-4 pt-4">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        {category && (
          <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-amber-500/10 shrink-0">
            <CategoryIcon iconKey={category.iconKey} className="w-5 h-5 text-amber-500 dark:text-amber-400" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          {catLoading ? (
            <div className="h-5 w-32 rounded bg-[var(--border)] animate-pulse" />
          ) : (
            <h1 className="font-display text-xl font-semibold">{title}</h1>
          )}
          {category?.description && (
            <p className="text-xs text-[var(--text-muted)] truncate">{category.description}</p>
          )}
        </div>
      </div>

      {/* Subcategories */}
      {subcategories.length > 0 && (
        <div className="flex gap-2 overflow-x-auto no-scrollbar mb-4 pb-1">
          {subcategories.map((sub) => (
            <Link
              key={sub.id}
              href={`/store/categories/${sub.slug}`}
              className="shrink-0 flex items-center gap-1.5 text-xs font-medium px-3.5 py-1.5 rounded-full glass-panel border border-[var(--border)] text-[var(--text-muted)] hover:border-amber-500/40 transition-colors"
            >
              <CategoryIcon iconKey={sub.iconKey} className="w-3.5 h-3.5" />
              {sub.name}
            </Link>
          ))}
        </div>
      )}

      {/* Sort / filter */}
      <StoreFilterBar
        sortOptions={SORT_OPTIONS}
        sortValue={sort}
        onSortChange={setSort}
        goalValue={goal}
        onGoalChange={setGoal}
        typeOptions={types}
        typeValue={type}
        onTypeChange={setType}
      />

      {/* Product count */}
      {!prodLoading && products.length > 0 && (
        <p className="text-xs text-[var(--text-muted)] mb-3">{products.length} products</p>
      )}

      {/* Always render the grid — shows empty state when no products, but the Category is still visible above */}
      <ProductGrid
        products={products}
        loading={prodLoading}
        emptyMessage={`No products added to ${title} yet. Check back soon!`}
      />

      <div className="h-4" />
    </div>
  );
}
