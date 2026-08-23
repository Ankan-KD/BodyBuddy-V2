"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { GOAL_SHOPPING } from "@/lib/goalShopping";

export default function ShopByGoalPage() {
  return (
    <div className="px-4 pt-4">
      <h1 className="font-display text-xl font-semibold mb-1">Shop by Goal</h1>
      <p className="text-sm text-[var(--text-muted)] mb-4">
        Products picked for what you're working towards.
      </p>

      <div className="space-y-2.5">
        {GOAL_SHOPPING.map((g) => {
          const Icon = g.icon;
          return (
            <Link key={g.key} href={`/store/goals/${g.key}`}>
              <div className="flex items-center gap-3.5 glass-panel border border-[var(--border)] rounded-2xl px-4 py-3.5 shadow-soft active:scale-[0.99] transition-transform">
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${g.bg}`}>
                  <Icon className={`w-5 h-5 ${g.text}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-[15px]">{g.label}</p>
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
