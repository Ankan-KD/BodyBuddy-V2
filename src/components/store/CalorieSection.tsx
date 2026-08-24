"use client";

// ════════════════════════════════════════════════════════════════════════
// BB Store — Phase 10 Calorie-Context Rail
// Shows calorie-dense products for surplus goals (gain) or lighter
// options for deficit goals (lose). Adapts its header copy and goal
// tag entirely from BB Health data without touching the health app.
// ════════════════════════════════════════════════════════════════════════

import Link from "next/link";
import { ChevronRight, Flame, Scale } from "lucide-react";
import { usePersonalization } from "@/lib/usePersonalization";
import { useProducts } from "@/lib/useStoreData";
import { ProductRail } from "./ProductRail";

export function CalorieSection() {
  const ctx = usePersonalization();

  const isSurplus = ctx.isCalorieSurplus;
  const isDeficit = ctx.isCalorieDeficit;

  // Only show for gain or lose goals — maintain users get the generic "For You" section
  const shouldShow = isSurplus || isDeficit;

  const goalTag = isSurplus ? "weight-gain" : "weight-loss";
  const { data: products, loading } = useProducts({
    healthGoalTag: goalTag,
    limit: 10,
  });

  if (!ctx.hasHealthData || !shouldShow) return null;
  if (!loading && products.length === 0) return null;

  const Icon = isSurplus ? Scale : Flame;
  const iconColor = isSurplus
    ? "text-amber-500 dark:text-amber-400"
    : "text-orange-500 dark:text-orange-400";
  const iconBg = isSurplus ? "bg-amber-500/10" : "bg-orange-500/10";

  const title = isSurplus ? "Calorie-Dense Picks" : "Lighter Options";
  const subLabel = isSurplus
    ? `Your goal: ${ctx.calorieGoal} kcal / day`
    : `Staying within ${ctx.calorieGoal} kcal / day`;

  const href = `/store/goals/${goalTag}`;

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${iconBg}`}>
            <Icon className={`w-3.5 h-3.5 ${iconColor}`} />
          </div>
          <div>
            <h2 className="font-display text-lg font-semibold leading-none">{title}</h2>
            <p className="text-[11px] text-[var(--text-muted)] mt-0.5">{subLabel}</p>
          </div>
        </div>
        <Link
          href={href}
          className="text-xs text-amber-500 dark:text-amber-400 font-medium flex items-center gap-0.5"
        >
          See all <ChevronRight className="w-3.5 h-3.5" />
        </Link>
      </div>
      <ProductRail products={products} loading={loading} />
    </section>
  );
}
