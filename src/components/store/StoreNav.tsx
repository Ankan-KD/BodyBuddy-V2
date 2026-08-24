"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Search, Tag, ShoppingCart, Package } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCart } from "@/lib/cartContext";

const STORE_NAV = [
  { href: "/store", label: "Home", icon: Home },
  { href: "/store/search", label: "Search", icon: Search },
  { href: "/store/categories", label: "Categories", icon: Tag },
  { href: "/store/cart", label: "Cart", icon: ShoppingCart, showBadge: true },
  { href: "/store/orders", label: "Orders", icon: Package },
];

export function StoreNav() {
  const pathname = usePathname();
  const { totals } = useCart();
  const cartCount = totals.itemCount;

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 border-t border-[var(--border)] pb-[env(safe-area-inset-bottom)]"
      style={{
        background: "color-mix(in srgb, var(--bg-elevated) 92%, transparent)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
      }}
      aria-label="Store navigation"
    >
      <div className="mx-auto max-w-md grid grid-cols-5 items-end px-2 pt-2 pb-2">
        {STORE_NAV.map(({ href, label, icon: Icon, showBadge }) => {
          const active =
            href === "/store"
              ? pathname === "/store"
              : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className="flex flex-col items-center gap-1 py-1.5 rounded-xl"
            >
              <div className="relative">
                <Icon
                  className={cn(
                    "w-5 h-5 transition-colors",
                    active ? "text-amber-500 dark:text-amber-400" : "text-[var(--text-muted)]"
                  )}
                />
                {showBadge && cartCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 min-w-[15px] h-[15px] rounded-full bg-amber-500 text-white text-[9px] font-bold flex items-center justify-center px-0.5 leading-none">
                    {cartCount > 99 ? "99+" : cartCount}
                  </span>
                )}
              </div>
              <span
                className={cn(
                  "text-[11px] font-medium transition-colors",
                  active ? "text-amber-500 dark:text-amber-400" : "text-[var(--text-muted)]"
                )}
              >
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
