"use client";

import Link from "next/link";
import { MapPin, CreditCard, ChevronRight, Package } from "lucide-react";

const STEPS = ["Address", "Payment", "Review"];

export default function CheckoutPage() {
  return (
    <div className="px-4 pt-4">
      <h1 className="font-display text-xl font-semibold mb-4">Checkout</h1>

      {/* Stepper */}
      <div className="flex items-center mb-6">
        {STEPS.map((step, i) => (
          <div key={step} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center gap-1">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                  i === 0
                    ? "bg-amber-500 text-white"
                    : "bg-nova-700/10 dark:bg-nova-100/10 text-[var(--text-muted)]"
                }`}
              >
                {i + 1}
              </div>
              <span className={`text-[10px] font-medium ${i === 0 ? "text-amber-500" : "text-[var(--text-muted)]"}`}>
                {step}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className="flex-1 h-px bg-[var(--border)] mx-2 mb-4" />
            )}
          </div>
        ))}
      </div>

      {/* Delivery Address */}
      <section className="mb-4">
        <h2 className="font-display text-base font-semibold mb-2.5 flex items-center gap-2">
          <MapPin className="w-4 h-4 text-amber-500" /> Delivery Address
        </h2>
        <div className="glass-panel border border-[var(--border)] rounded-2xl p-4 text-sm text-[var(--text-muted)] text-center">
          Address management will be available in the next phase.
        </div>
      </section>

      {/* Payment */}
      <section className="mb-4">
        <h2 className="font-display text-base font-semibold mb-2.5 flex items-center gap-2">
          <CreditCard className="w-4 h-4 text-amber-500" /> Payment Method
        </h2>
        <div className="glass-panel border border-[var(--border)] rounded-2xl p-4 text-sm text-[var(--text-muted)] text-center">
          Payment integration will be available in the next phase.
        </div>
      </section>

      {/* Order summary */}
      <section className="mb-6">
        <h2 className="font-display text-base font-semibold mb-2.5 flex items-center gap-2">
          <Package className="w-4 h-4 text-amber-500" /> Order Summary
        </h2>
        <div className="glass-panel border border-[var(--border)] rounded-2xl p-4 text-sm text-[var(--text-muted)] text-center">
          Add items to your cart first.
        </div>
      </section>

      <div className="flex flex-col gap-3">
        <button
          disabled
          className="w-full flex items-center justify-center gap-2 bg-amber-500/50 text-white font-semibold rounded-2xl py-4 cursor-not-allowed"
        >
          Place Order <ChevronRight className="w-4 h-4" />
        </button>
        <Link href="/store/cart" className="text-center text-sm text-[var(--text-muted)]">
          ← Back to cart
        </Link>
      </div>
    </div>
  );
}
