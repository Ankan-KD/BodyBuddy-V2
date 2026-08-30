// ════════════════════════════════════════════════════════════════════════
// BB Store — Wishlist Types
// Product-level "save for later" list. Kept separate from the cart —
// no variant, no quantity — the shopper picks those when they actually
// decide to buy.
// ════════════════════════════════════════════════════════════════════════

import { StoreProduct } from "./storeTypes";

export interface WishlistItem {
  /** Wishlist row id (DB row id for signed-in users, local id for guests) */
  id: string;
  productId: string;
  createdAt: string;
  /** Snapshot of product data, populated on fetch */
  product: StoreProduct;
}
