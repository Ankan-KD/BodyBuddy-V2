"use client";

import { useState } from "react";
import { SlidersHorizontal, X } from "lucide-react";
import { GOAL_SHOPPING } from "@/lib/goalShopping";
import { cn } from "@/lib/utils";

export interface SortOption {
  label: string;
  value: string;
}

interface StoreFilterBarProps {
  sortOptions: SortOption[];
  sortValue: string;
  onSortChange: (value: string) => void;
  goalValue: string | null;
  onGoalChange: (value: string | null) => void;
}

/**
 * Sort chips (always visible) + a collapsible goal-tag filter panel.
 * Shared between /store/products and /store/categories/[id] so
 * "discovery filtering" behaves consistently across the store.
 */
export function StoreFilterBar({
  sortOptions,
  sortValue,
  onSortChange,
  goalValue,
  onGoalChange,
}: StoreFilterBarProps) {
  const [panelOpen, setPanelOpen] = useState(false);
  const activeFilterCount = goalValue ? 1 : 0;

  return (
    <div className="mb-4">
      <div className="flex items-center gap-2">
        <div className="flex-1 flex gap-2 overflow-x-auto no-scrollbar pb-1">
          {sortOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => onSortChange(opt.value)}
              className={cn(
                "shrink-0 text-xs font-medium px-3.5 py-1.5 rounded-full border transition-colors",
                sortValue === opt.value
                  ? "bg-amber-500/15 border-amber-500/30 text-amber-600 dark:text-amber-300"
                  : "glass-panel border-[var(--border)] text-[var(--text-muted)]"
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <button
          onClick={() => setPanelOpen((v) => !v)}
          className={cn(
            "relative h-9 px-3.5 shrink-0 flex items-center gap-1.5 rounded-xl border shadow-soft text-sm transition-colors",
            panelOpen || activeFilterCount
              ? "bg-amber-500/15 border-amber-500/30 text-amber-600 dark:text-amber-300"
              : "glass-panel border-[var(--border)] text-[var(--text-muted)]"
          )}
        >
          <SlidersHorizontal className="w-4 h-4" />
          {activeFilterCount > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-amber-500 text-white text-[9px] font-bold flex items-center justify-center">
              {activeFilterCount}
            </span>
          )}
        </button>
      </div>

      {panelOpen && (
        <div className="mt-2.5 glass-panel border border-[var(--border)] rounded-2xl p-3.5">
          <div className="flex items-center justify-between mb-2.5">
            <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide">
              Shop by Goal
            </p>
            {goalValue && (
              <button
                onClick={() => onGoalChange(null)}
                className="text-[11px] font-medium text-amber-500 dark:text-amber-400 flex items-center gap-0.5"
              >
                Clear <X className="w-3 h-3" />
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {GOAL_SHOPPING.map((g) => (
              <button
                key={g.key}
                onClick={() => onGoalChange(goalValue === g.key ? null : g.key)}
                className={cn(
                  "text-xs font-medium px-3 py-1.5 rounded-full border transition-colors",
                  goalValue === g.key
                    ? `${g.bg} ${g.ring} ${g.text}`
                    : "glass-panel border-[var(--border)] text-[var(--text-muted)]"
                )}
              >
                {g.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
