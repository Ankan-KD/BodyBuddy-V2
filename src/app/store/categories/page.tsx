"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { useTopLevelCategories } from "@/lib/useStoreData";
import { CategoryIcon } from "@/components/store/CategoryIcon";

const CATEGORY_COLORS: Record<string, { text: string; bg: string }> = {
  Dumbbell:  { text: "text-amber-500 dark:text-amber-400",   bg: "bg-amber-500/10" },
  Flame:     { text: "text-orange-500 dark:text-orange-400", bg: "bg-orange-500/10" },
  Leaf:      { text: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-500/10" },
  Pill:      { text: "text-purple-500 dark:text-purple-400", bg: "bg-purple-500/10" },
  Zap:       { text: "text-yellow-500 dark:text-yellow-400", bg: "bg-yellow-500/10" },
  Apple:     { text: "text-red-500 dark:text-red-400",       bg: "bg-red-500/10" },
  Heart:     { text: "text-rose-500 dark:text-rose-400",     bg: "bg-rose-500/10" },
  Droplets:  { text: "text-cyan-500 dark:text-cyan-400",     bg: "bg-cyan-500/10" },
  Moon:      { text: "text-indigo-500 dark:text-indigo-400", bg: "bg-indigo-500/10" },
  Activity:  { text: "text-nova-500 dark:text-nova-400",     bg: "bg-nova-500/10" },
  Scale:     { text: "text-teal-500 dark:text-teal-400",     bg: "bg-teal-500/10" },
  ShoppingBag: { text: "text-amber-500 dark:text-amber-400", bg: "bg-amber-500/10" },
};

export default function CategoriesPage() {
  const { data: categories, loading } = useTopLevelCategories();

  return (
    <div className="px-4 pt-4">
      <h1 className="font-display text-xl font-semibold mb-4">All Categories</h1>

      {loading ? (
        <div className="space-y-2.5">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3.5 glass-panel border border-[var(--border)] rounded-2xl px-4 py-3.5 animate-pulse">
              <div className="w-11 h-11 rounded-xl bg-[var(--border)] shrink-0" />
              <div className="flex-1 space-y-1.5">
                <div className="h-4 w-28 rounded bg-[var(--border)]" />
                <div className="h-3 w-40 rounded bg-[var(--border)]" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-2.5">
          {categories.map((cat) => {
            const colors = CATEGORY_COLORS[cat.iconKey] ?? {
              text: "text-amber-500 dark:text-amber-400",
              bg: "bg-amber-500/10",
            };
            return (
              <Link key={cat.id} href={`/store/categories/${cat.slug}`}>
                <div className="flex items-center gap-3.5 glass-panel border border-[var(--border)] rounded-2xl px-4 py-3.5 shadow-soft active:scale-[0.99] transition-transform">
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${colors.bg}`}>
                    <CategoryIcon iconKey={cat.iconKey} className={`w-5 h-5 ${colors.text}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-[15px]">{cat.name}</p>
                    {cat.description && (
                      <p className="text-xs text-[var(--text-muted)] truncate">{cat.description}</p>
                    )}
                  </div>
                  <ChevronRight className="w-4 h-4 text-[var(--text-muted)] shrink-0" />
                </div>
              </Link>
            );
          })}
        </div>
      )}

      <div className="h-4" />
    </div>
  );
}
