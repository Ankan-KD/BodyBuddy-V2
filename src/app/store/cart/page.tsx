"use client";

import Link from "next/link";
import { ShoppingCart, ChevronRight } from "lucide-react";

export default function CartPage() {
  return (
    <div className="px-4 pt-4 flex flex-col min-h-[70vh]">
      <h1 className="font-display text-xl font-semibold mb-4">Your Cart</h1>

      {/* Empty cart state */}
      <div className="flex-1 flex flex-col items-center justify-center text-center py-16">
        <div className="w-20 h-20 rounded-full bg-amber-500/10 flex items-center justify-center mb-4">
          <ShoppingCart className="w-9 h-9 text-amber-500/60" />
        </div>
        <h2 className="font-display text-lg font-semibold mb-1">Cart is empty</h2>
        <p className="text-sm text-[var(--text-muted)] mb-6 max-w-[220px]">
          Add products from the store to get started.
        </p>
        <Link
          href="/store"
          className="inline-flex items-center gap-1.5 text-sm font-semibold px-5 py-2.5 rounded-xl bg-amber-500 text-white shadow-soft active:scale-95 transition-transform"
        >
          Browse Store <ChevronRight className="w-4 h-4" />
        </Link>
      </div>

      {/* Order summary (shown when items exist — backend phase) */}
      <div className="glass-panel border border-[var(--border)] rounded-2xl p-4 mb-4 opacity-40 pointer-events-none select-none">
        <div className="flex justify-between text-sm mb-2">
          <span className="text-[var(--text-muted)]">Subtotal</span>
          <span className="font-semibold">₹0</span>
        </div>
        <div className="flex justify-between text-sm mb-3">
          <span className="text-[var(--text-muted)]">Delivery</span>
          <span className="font-semibold text-emerald-600 dark:text-emerald-400">Free</span>
        </div>
        <div className="border-t border-[var(--border)] pt-3 flex justify-between">
          <span className="font-semibold">Total</span>
          <span className="font-bold text-lg">₹0</span>
        </div>
        <button className="mt-3 w-full bg-amber-500 text-white font-semibold rounded-xl py-3.5 shadow-soft">
          Proceed to Checkout
        </button>
      </div>
    </div>
  );
}
