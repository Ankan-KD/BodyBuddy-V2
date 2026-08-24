"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Target, Sparkles } from "lucide-react";
import { useProducts } from "@/lib/useStoreData";
import { ProductGrid } from "@/components/store/ProductCard";
import { goalByKey } from "@/lib/goalShopping";
import { usePersonalization } from "@/lib/usePersonalization";

export default function GoalDetailPage() {
  const params = useParams();
  const goalKey = params.goal as string;
  const meta = goalByKey(goalKey);
  const ctx = usePersonalization();

  const { data: products, loading } = useProducts({
    healthGoalTag: goalKey,
    limit: 40,
  });

  // Does this goal page match the user's actual BB Health goal?
  const isUsersGoal = ctx.hasHealthData && ctx.goalTag === goalKey;

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
        <div>
          <h1 className="font-display text-xl font-semibold">{meta?.label ?? "Shop by Goal"}</h1>
          {isUsersGoal && (
            <div className="flex items-center gap-1 mt-0.5">
              <Sparkles className="w-3 h-3 text-amber-500" />
              <span className="text-[11px] text-amber-500 dark:text-amber-400 font-medium">Your active goal</span>
            </div>
          )}
        </div>
      </div>

      {meta?.blurb && (
        <p className="text-sm text-[var(--text-muted)] mb-3 ml-[52px] -mt-1">{meta.blurb}</p>
      )}
      {!meta && <div className="mb-4" />}

      {/* Personalised nutrition context card */}
      {isUsersGoal && (ctx.proteinGoalG > 0 || ctx.calorieGoal > 0) && (
        <div className={`mb-4 rounded-2xl border ${meta?.ring ?? "border-amber-500/20"} px-4 py-3 flex items-center gap-3`}
          style={{ background: "linear-gradient(135deg, rgba(245,158,11,0.07), rgba(249,115,22,0.04))" }}>
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${meta?.bg ?? "bg-amber-500/10"}`}>
            <Sparkles className={`w-4 h-4 ${meta?.text ?? "text-amber-500"}`} />
          </div>
          <div className="text-xs text-[var(--text-muted)] space-y-0.5">
            <p className="font-semibold text-[var(--text)] text-[13px]">Personalised from BB Health</p>
            <div className="flex gap-3">
              {ctx.calorieGoal > 0 && (
                <span>🔥 {ctx.calorieGoal} kcal / day</span>
              )}
              {ctx.proteinGoalG > 0 && (
                <span>💪 {ctx.proteinGoalG}g protein / day</span>
              )}
            </div>
          </div>
        </div>
      )}

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
