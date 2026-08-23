"use client";

import Link from "next/link";
import { Search, ShoppingBag, Tag, Truck, Shield, Zap, ChevronRight, Clock } from "lucide-react";
import {
  useTopLevelCategories,
  useProducts,
  useDealProducts,
  useRecentlyViewed,
} from "@/lib/useStoreData";
import { CategoryIcon } from "@/components/store/CategoryIcon";
import { ProductGrid } from "@/components/store/ProductCard";
import { ProductRail } from "@/components/store/ProductRail";
import { GOAL_SHOPPING } from "@/lib/goalShopping";

const PROMO_BADGES = [
  { icon: Truck, text: "Free delivery above ₹499" },
  { icon: Shield, text: "100% authentic products" },
  { icon: Zap, text: "Express delivery available" },
];

export default function StorePage() {
  const { data: categories, loading: catLoading } = useTopLevelCategories();
  const { data: featured, loading: prodLoading } = useProducts({ featured: true, limit: 4 });
  const { data: deals, loading: dealsLoading } = useDealProducts(8);
  const { data: recentlyViewed, loading: recentLoading } = useRecentlyViewed(8);

  return (
    <div className="px-4 pt-4 space-y-6">
      {/* Search Bar */}
      <Link
        href="/store/search"
        className="flex items-center gap-3 glass-panel border border-[var(--border)] rounded-2xl px-4 py-3 shadow-soft active:scale-[0.99] transition-transform"
      >
        <Search className="w-4 h-4 text-[var(--text-muted)]" />
        <span className="text-sm text-[var(--text-muted)]">Search supplements, proteins…</span>
      </Link>

      {/* Hero Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-amber-500/20 via-orange-500/10 to-nova-500/15 border border-amber-500/20 p-5">
        <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full bg-amber-400/10 blur-3xl" />
        <div className="absolute -bottom-8 -left-8 w-32 h-32 rounded-full bg-nova-500/10 blur-3xl" />
        <div className="relative">
          <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-300 mb-3 inline-block">
            Launch Offer
          </span>
          <h2 className="font-display text-2xl font-semibold mb-1 leading-tight">
            Your Health,
            <br />
            <span className="text-amber-500 dark:text-amber-400">Delivered.</span>
          </h2>
          <p className="text-sm text-[var(--text-muted)] mb-4">
            Premium nutrition products curated for your BB goals.
          </p>
          <Link
            href="/store/categories"
            className="inline-flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-xl bg-amber-500 text-white shadow-soft active:scale-95 transition-transform"
          >
            Shop now <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      </div>

      {/* Promo Badges */}
      <div className="grid grid-cols-3 gap-2">
        {PROMO_BADGES.map(({ icon: Icon, text }) => (
          <div
            key={text}
            className="glass-panel border border-[var(--border)] rounded-xl p-2.5 flex flex-col items-center gap-1.5 text-center"
          >
            <Icon className="w-4 h-4 text-amber-500 dark:text-amber-400" />
            <p className="text-[10px] text-[var(--text-muted)] leading-tight">{text}</p>
          </div>
        ))}
      </div>

      {/* Categories */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display text-lg font-semibold">Categories</h2>
          <Link href="/store/categories" className="text-xs text-amber-500 dark:text-amber-400 font-medium flex items-center gap-0.5">
            See all <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {catLoading ? (
          <div className="grid grid-cols-4 gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex flex-col items-center gap-2 glass-panel border border-[var(--border)] rounded-2xl p-3 animate-pulse">
                <div className="w-10 h-10 rounded-xl bg-[var(--border)]" />
                <div className="h-3 w-12 rounded bg-[var(--border)]" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-4 gap-2">
            {categories.slice(0, 3).map((cat) => (
              <Link key={cat.id} href={`/store/categories/${cat.slug}`}>
                <div className="flex flex-col items-center gap-2 glass-panel border border-[var(--border)] rounded-2xl p-3 active:scale-95 transition-transform">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-amber-500/10">
                    <CategoryIcon iconKey={cat.iconKey} className="w-5 h-5 text-amber-500 dark:text-amber-400" />
                  </div>
                  <span className="text-[10px] font-medium text-center leading-tight">{cat.name}</span>
                </div>
              </Link>
            ))}
            <Link href="/store/categories">
              <div className="flex flex-col items-center gap-2 glass-panel border border-[var(--border)] rounded-2xl p-3 active:scale-95 transition-transform">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-nova-500/10">
                  <Tag className="w-5 h-5 text-nova-500 dark:text-nova-400" />
                </div>
                <span className="text-[10px] font-medium text-center leading-tight">All</span>
              </div>
            </Link>
          </div>
        )}
      </section>

      {/* Shop by Goal */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display text-lg font-semibold">Shop by Goal</h2>
          <Link href="/store/goals" className="text-xs text-amber-500 dark:text-amber-400 font-medium flex items-center gap-0.5">
            See all <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          {GOAL_SHOPPING.map((g) => {
            const Icon = g.icon;
            return (
              <Link key={g.key} href={`/store/goals/${g.key}`}>
                <div className={`glass-panel border ${g.ring} rounded-2xl p-3.5 flex items-center gap-2.5 active:scale-[0.97] transition-transform`}>
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${g.bg}`}>
                    <Icon className={`w-4.5 h-4.5 ${g.text}`} />
                  </div>
                  <span className="text-xs font-semibold leading-tight">{g.label}</span>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Deals */}
      {(dealsLoading || deals.length > 0) && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-1.5">
              <Tag className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
              <h2 className="font-display text-lg font-semibold">Deals</h2>
            </div>
            <Link href="/store/deals" className="text-xs text-amber-500 dark:text-amber-400 font-medium flex items-center gap-0.5">
              See all <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          <ProductRail products={deals} loading={dealsLoading} />
        </section>
      )}

      {/* Featured Products */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display text-lg font-semibold">Featured</h2>
          <Link href="/store/products" className="text-xs text-amber-500 dark:text-amber-400 font-medium flex items-center gap-0.5">
            See all <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>
        <ProductGrid
          products={featured}
          loading={prodLoading}
          emptyMessage="No featured products yet. Check back soon."
        />
      </section>

      {/* Recently Viewed */}
      {(recentLoading || recentlyViewed.length > 0) && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <Clock className="w-4 h-4 text-[var(--text-muted)]" />
            <h2 className="font-display text-lg font-semibold">Recently Viewed</h2>
          </div>
          <ProductRail products={recentlyViewed} loading={recentLoading} />
        </section>
      )}

      {!recentLoading && recentlyViewed.length === 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <Clock className="w-4 h-4 text-[var(--text-muted)]" />
            <h2 className="font-display text-lg font-semibold">Recently Viewed</h2>
          </div>
          <div className="glass-panel border border-[var(--border)] rounded-2xl p-6 text-center">
            <ShoppingBag className="w-8 h-8 text-[var(--text-muted)] mx-auto mb-2 opacity-40" />
            <p className="text-sm text-[var(--text-muted)]">Products you view will appear here.</p>
          </div>
        </section>
      )}

      <div className="h-4" />
    </div>
  );
}
