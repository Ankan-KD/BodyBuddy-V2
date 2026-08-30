"use client";

// ════════════════════════════════════════════════════════════════════════
// BB Store — Wishlist Page
// Shows every product the shopper has saved for later. Each card can be
// removed from the wishlist or added straight to the cart (using its
// default variant) without leaving the page.
// ════════════════════════════════════════════════════════════════════════

import Link from "next/link";
import { Heart, Loader2, ShoppingCart, Package } from "lucide-react";
import { useWishlist } from "@/lib/wishlistContext";
import { ProductCard, ProductCardSkeleton } from "@/components/store/ProductCard";

export default function WishlistPage() {
  const { items, loading } = useWishlist();

  return (
    <div className="px-4 pt-4 pb-8">
      <h1 className="font-display text-xl font-semibold flex items-center gap-2 mb-4">
        <Heart className="w-5 h-5 text-rose-500" /> My Wishlist
      </h1>

      {loading && (
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <ProductCardSkeleton key={i} />
          ))}
        </div>
      )}

      {!loading && items.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-full bg-rose-500/10 flex items-center justify-center mb-4">
            <Heart className="w-7 h-7 text-rose-400" />
          </div>
          <p className="font-semibold text-sm mb-1">Your wishlist is empty</p>
          <p className="text-xs text-[var(--text-muted)] mb-5 max-w-[240px]">
            Tap the heart icon on any product to save it here for later.
          </p>
          <Link
            href="/store/products"
            className="inline-flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-xl bg-amber-500 text-white shadow-soft active:scale-95 transition-transform"
          >
            <Package className="w-4 h-4" /> Browse Products
          </Link>
        </div>
      )}

      {!loading && items.length > 0 && (
        <>
          <p className="text-xs text-[var(--text-muted)] mb-3">
            {items.length} saved item{items.length === 1 ? "" : "s"}
          </p>
          <div className="grid grid-cols-2 gap-3">
            {items.map((item) => (
              <ProductCard key={item.productId} product={item.product} />
            ))}
          </div>
          <p className="text-[11px] text-[var(--text-muted)] text-center mt-6 flex items-center justify-center gap-1.5">
            <ShoppingCart className="w-3 h-3" /> Use the cart icon on each card to add it to your cart.
          </p>
        </>
      )}
    </div>
  );
}
