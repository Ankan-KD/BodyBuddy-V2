"use client";

// ════════════════════════════════════════════════════════════════════════
// BB Store — Phase 10 Personalized Section
// Shows a "Recommended for You" rail on Store Home when the user has
// an active BB Health goal. Reads goal/nutrition context from BB Health
// without modifying anything in the health app itself.
// ════════════════════════════════════════════════════════════════════════

import Link from "next/link";
import { ChevronRight, Sparkles } from "lucide-react";
import { usePersonalization } from "@/lib/usePersonalization";
import { useProducts } from "@/lib/useStoreData";
import { ProductRail } from "./ProductRail";
import { goalByKey } from "@/lib/goalShopping";

export function PersonalizedSection() {
  const ctx = usePersonalization();

  // Fetch products matching the user's goal tag
  const { data: goalProducts, loading } = useProducts({
    healthGoalTag: ctx.goalTag,
    limit: 10,
  });

  const goal = goalByKey(ctx.goalTag);

  // Only render when the user has real BB Health data
  if (!ctx.hasHealthData) return null;
  if (!loading && goalProducts.length === 0) return null;

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${goal?.bg ?? "bg-amber-500/10"}`}>
            <Sparkles className={`w-3.5 h-3.5 ${goal?.text ?? "text-amber-500"}`} />
          </div>
          <div>
            <h2 className="font-display text-lg font-semibold leading-none">
              For You
            </h2>
            <p className="text-[11px] text-[var(--text-muted)] mt-0.5">{ctx.goalLabel} · Personalised picks</p>
          </div>
        </div>
        <Link
          href={`/store/goals/${ctx.goalTag}`}
          className="text-xs text-amber-500 dark:text-amber-400 font-medium flex items-center gap-0.5"
        >
          See all <ChevronRight className="w-3.5 h-3.5" />
        </Link>
      </div>
      <ProductRail products={goalProducts} loading={loading} />
    </section>
  );
}
