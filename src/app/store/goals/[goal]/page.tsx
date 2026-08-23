"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Target } from "lucide-react";
import { useProducts } from "@/lib/useStoreData";
import { ProductGrid } from "@/components/store/ProductCard";
import { goalByKey } from "@/lib/goalShopping";

export default function GoalDetailPage() {
  const params = useParams();
  const goalKey = params.goal as string;
  const meta = goalByKey(goalKey);

  const { data: products, loading } = useProducts({
    healthGoalTag: goalKey,
    limit: 40,
  });

  return (
    <div className="px-4 pt-4">
      <Link href="/store/goals" className="inline-flex items-center gap-1 text-sm text-[var(--text-muted)] mb-3">
        <ChevronLeft className="w-4 h-4" /> All goals
      </Link>

      <div className="flex items-center gap-3 mb-1">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${meta?.bg ?? "bg-amber-500/10"}`}>
          {meta ? (
            <meta.icon className={`w-5 h-5 ${meta.text}`} />
          ) : (
            <Target className="w-5 h-5 text-amber-500" />
          )}
        </div>
        <h1 className="font-display text-xl font-semibold">{meta?.label ?? "Shop by Goal"}</h1>
      </div>
      {meta?.blurb && <p className="text-sm text-[var(--text-muted)] mb-4 ml-[52px] -mt-1">{meta.blurb}</p>}
      {!meta && <div className="mb-4" />}

      {!loading && products.length > 0 && (
        <p className="text-xs text-[var(--text-muted)] mb-3">{products.length} products</p>
      )}

      <ProductGrid
        products={products}
        loading={loading}
        emptyMessage={`No products tagged for ${meta?.label ?? "this goal"} yet.`}
      />

      <div className="h-4" />
    </div>
  );
}
