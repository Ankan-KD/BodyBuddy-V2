"use client";

// ════════════════════════════════════════════════════════════════════════
// BB Store — Phase 10 High-Protein Rail
// Surfaces products that can help users hit their protein target.
// Uses the BB Health proteinGoal to frame the section contextually.
// Only shown to onboarded users — hides gracefully otherwise.
// ════════════════════════════════════════════════════════════════════════

import Link from "next/link";
import { ChevronRight, Zap } from "lucide-react";
import { usePersonalization } from "@/lib/usePersonalization";
import { useProducts } from "@/lib/useStoreData";
import { ProductRail } from "./ProductRail";

export function HighProteinSection() {
  const ctx = usePersonalization();

  // Protein products → always tagged "muscle-building" in the catalog
  const { data: products, loading } = useProducts({
    healthGoalTag: "muscle-building",
    limit: 10,
  });

  if (!ctx.hasHealthData) return null;
  if (!loading && products.length === 0) return null;

  const proteinLabel = ctx.proteinGoalG > 0
    ? `Your goal: ${ctx.proteinGoalG}g / day`
    : "Hit your protein target";

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 bg-nova-500/10">
            <Zap className="w-3.5 h-3.5 text-nova-500 dark:text-nova-400" />
          </div>
          <div>
            <h2 className="font-display text-lg font-semibold leading-none">High Protein</h2>
            <p className="text-[11px] text-[var(--text-muted)] mt-0.5">{proteinLabel}</p>
          </div>
        </div>
        <Link
          href="/store/goals/muscle-building"
          className="text-xs text-amber-500 dark:text-amber-400 font-medium flex items-center gap-0.5"
        >
          See all <ChevronRight className="w-3.5 h-3.5" />
        </Link>
      </div>
      <ProductRail products={products} loading={loading} />
    </section>
  );
}
