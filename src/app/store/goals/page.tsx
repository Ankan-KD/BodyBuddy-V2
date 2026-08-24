"use client";

import Link from "next/link";
import { ChevronRight, Sparkles } from "lucide-react";
import { GOAL_SHOPPING } from "@/lib/goalShopping";
import { usePersonalization } from "@/lib/usePersonalization";

export default function ShopByGoalPage() {
  const ctx = usePersonalization();

  return (
    <div className="px-4 pt-4">
      <h1 className="font-display text-xl font-semibold mb-1">Shop by Goal</h1>
      <p className="text-sm text-[var(--text-muted)] mb-4">
        Products picked for what you&apos;re working towards.
      </p>

      {/* Personalised hint when user has BB Health data */}
      {ctx.hasHealthData && (
        <div className="mb-4 flex items-center gap-2 px-3 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20">
          <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" />
          <p className="text-xs text-amber-600 dark:text-amber-300">
            Your BB Health goal is <strong>{ctx.goalLabel}</strong> — highlighted below.
          </p>
        </div>
      )}

      <div className="space-y-2.5">
        {GOAL_SHOPPING.map((g) => {
          const Icon = g.icon;
          const isActive = ctx.hasHealthData && g.key === ctx.goalTag;
          return (
            <Link key={g.key} href={`/store/goals/${g.key}`}>
              <div className={`flex items-center gap-3.5 glass-panel border rounded-2xl px-4 py-3.5 shadow-soft active:scale-[0.99] transition-transform ${isActive ? g.ring : "border-[var(--border)]"}`}>
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${g.bg}`}>
                  <Icon className={`w-5 h-5 ${g.text}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="font-semibold text-[15px]">{g.label}</p>
                    {isActive && (
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-300">
                        Your goal
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[var(--text-muted)] truncate">{g.blurb}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-[var(--text-muted)] shrink-0" />
              </div>
            </Link>
          );
        })}
      </div>

      <div className="h-4" />
    </div>
  );
}
