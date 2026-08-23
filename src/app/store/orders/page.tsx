"use client";

import Link from "next/link";
import { Package, ChevronRight } from "lucide-react";

export default function OrdersPage() {
  return (
    <div className="px-4 pt-4">
      <h1 className="font-display text-xl font-semibold mb-4">My Orders</h1>

      {/* Filter tabs */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar mb-5 pb-1">
        {["All", "Processing", "Shipped", "Delivered", "Cancelled"].map((tab) => (
          <button
            key={tab}
            className={`shrink-0 text-xs font-medium px-3.5 py-1.5 rounded-full border transition-colors ${
              tab === "All"
                ? "bg-amber-500/15 border-amber-500/30 text-amber-600 dark:text-amber-300"
                : "glass-panel border-[var(--border)] text-[var(--text-muted)]"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Empty state */}
      <div className="flex flex-col items-center justify-center text-center py-16">
        <div className="w-20 h-20 rounded-full bg-amber-500/10 flex items-center justify-center mb-4">
          <Package className="w-9 h-9 text-amber-500/60" />
        </div>
        <h2 className="font-display text-lg font-semibold mb-1">No orders yet</h2>
        <p className="text-sm text-[var(--text-muted)] mb-6 max-w-[220px]">
          Your order history will appear here once you make a purchase.
        </p>
        <Link
          href="/store"
          className="inline-flex items-center gap-1.5 text-sm font-semibold px-5 py-2.5 rounded-xl bg-amber-500 text-white shadow-soft active:scale-95 transition-transform"
        >
          Start Shopping <ChevronRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );
}
