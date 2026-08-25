"use client";

import { X } from "lucide-react";
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
  /** Optional: fine-grained Type filter, shown as a further filtration row under Goals/Sort */
  typeOptions?: string[];
  typeValue?: string | null;
  onTypeChange?: (value: string | null) => void;
}

/**
 * Redesigned filter bar:
 * 1. Goal chips — always visible at the top as the PRIMARY filter
 * 2. Sort chips — secondary row below
 * 3. Type chips (optional) — further filtration under the broad Category,
 *    e.g. on a category page: "Whey Protein", "Creatine", ...
 *
 * Goals are the main discovery tool customers use to find products,
 * so they should never be hidden behind a collapsible panel.
 */
export function StoreFilterBar({
  sortOptions,
  sortValue,
  onSortChange,
  goalValue,
  onGoalChange,
  typeOptions,
  typeValue,
  onTypeChange,
}: StoreFilterBarProps) {
  return (
    <div className="mb-5 space-y-3">
      {/* ── Goal filter — PRIMARY, always visible ── */}
      <div>
        <div className="flex items-center justify-between mb-2">
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
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
          {GOAL_SHOPPING.map((g) => {
            const Icon = g.icon;
            const active = goalValue === g.key;
            return (
              <button
                key={g.key}
                onClick={() => onGoalChange(active ? null : g.key)}
                className={cn(
                  "shrink-0 flex items-center gap-1.5 text-xs font-semibold px-3.5 py-2 rounded-full border transition-colors",
                  active
                    ? `${g.bg} ${g.ring} ${g.text}`
                    : "glass-panel border-[var(--border)] text-[var(--text-muted)]"
                )}
              >
                <Icon className="w-3.5 h-3.5" />
                {g.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Type filter — optional, further filtration under Category ── */}
      {typeOptions && typeOptions.length > 0 && onTypeChange && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide">
              Filter by Type
            </p>
            {typeValue && (
              <button
                onClick={() => onTypeChange(null)}
                className="text-[11px] font-medium text-amber-500 dark:text-amber-400 flex items-center gap-0.5"
              >
                Clear <X className="w-3 h-3" />
              </button>
            )}
          </div>
          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
            {typeOptions.map((t) => {
              const active = typeValue === t;
              return (
                <button
                  key={t}
                  onClick={() => onTypeChange(active ? null : t)}
                  className={cn(
                    "shrink-0 text-xs font-medium px-3.5 py-1.5 rounded-full border transition-colors",
                    active
                      ? "bg-amber-500/15 border-amber-500/30 text-amber-600 dark:text-amber-300"
                      : "glass-panel border-[var(--border)] text-[var(--text-muted)]"
                  )}
                >
                  {t}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Sort chips — secondary ── */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-0.5">
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
    </div>
  );
}
