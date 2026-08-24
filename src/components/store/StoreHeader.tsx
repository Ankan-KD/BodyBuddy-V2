"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ShoppingCart, ArrowLeft } from "lucide-react";
import { useCart } from "@/lib/cartContext";

const ROUTE_TITLES: Record<string, string> = {
  "/store": "BB Store",
  "/store/search": "Search",
  "/store/categories": "Categories",
  "/store/products": "Products",
  "/store/cart": "Cart",
  "/store/checkout": "Checkout",
  "/store/orders": "My Orders",
  "/store/goals": "Shop by Goal",
  "/store/deals": "Deals",
};

export function StoreHeader() {
  const pathname = usePathname();
  const { totals } = useCart();

  // Dynamic nested routes (category detail, product detail, goal detail)
  let title = ROUTE_TITLES[pathname];
  if (!title) {
    if (pathname.startsWith("/store/categories/")) title = "Category";
    else if (pathname.startsWith("/store/products/")) title = "Product";
    else if (pathname.startsWith("/store/goals/")) title = "Shop by Goal";
    else title = "BB Store";
  }

  const isHome = pathname === "/store";
  const cartCount = totals.itemCount;

  return (
    <header className="sticky top-0 z-30 border-b border-[var(--border)] bg-[var(--bg-elevated)]/90 backdrop-blur-md px-4 pt-[env(safe-area-inset-top)]">
      <div className="flex items-center h-14 gap-3">
        {!isHome ? (
          <Link
            href={pathname.startsWith("/store/categories/") ? "/store/categories"
              : pathname.startsWith("/store/products/") ? "/store/products"
              : pathname.startsWith("/store/goals/") ? "/store/goals"
              : "/store"}
            className="h-9 w-9 flex items-center justify-center rounded-full text-[var(--text-muted)] hover:bg-nova-500/10 transition-colors"
            aria-label="Back"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
        ) : (
          /* BB Store wordmark on home */
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-soft">
              <span className="text-white font-bold text-[13px]">BB</span>
            </div>
            <span className="font-display text-lg font-semibold">
              BB <span className="text-amber-500 dark:text-amber-400">Store</span>
            </span>
          </div>
        )}

        {!isHome && (
          <h1 className="flex-1 font-display text-base font-semibold truncate">{title}</h1>
        )}

        <div className="ml-auto flex items-center gap-1">
          {/* Back to BB Health */}
          {isHome && (
            <Link
              href="/"
              className="text-xs font-medium px-3 py-1.5 rounded-full border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text)] transition-colors mr-1"
            >
              ← BB Health
            </Link>
          )}
          {/* Cart icon with live badge */}
          <Link
            href="/store/cart"
            aria-label={`Cart${cartCount > 0 ? `, ${cartCount} items` : ""}`}
            className="relative h-9 w-9 flex items-center justify-center rounded-full text-[var(--text-muted)] hover:bg-amber-500/10 transition-colors"
          >
            <ShoppingCart className="w-5 h-5" />
            {cartCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] rounded-full bg-amber-500 text-white text-[10px] font-bold flex items-center justify-center px-1 leading-none">
                {cartCount > 99 ? "99+" : cartCount}
              </span>
            )}
          </Link>
        </div>
      </div>
    </header>
  );
}
