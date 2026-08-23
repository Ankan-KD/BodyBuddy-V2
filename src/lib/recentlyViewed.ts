"use client";

// ════════════════════════════════════════════════════════════════════════
// BB Store — Phase 5 Recently Viewed
// Local, per-user, best-effort view history used to power the "Recently
// Viewed" rail on Store Home and the product detail page. Intentionally
// simple (localStorage, no backend table) — this is a discovery aid, not
// order/cart state.
// ════════════════════════════════════════════════════════════════════════

const MAX_ITEMS = 12;

function storageKey(userId: string): string {
  return `bb_store_recently_viewed_${userId}`;
}

/** Record a product view. Most-recent-first, de-duplicated, capped. */
export function trackRecentlyViewed(userId: string | null | undefined, productId: string): void {
  if (!userId || !productId || typeof window === "undefined") return;
  try {
    const ids = getRecentlyViewedIds(userId).filter((id) => id !== productId);
    ids.unshift(productId);
    window.localStorage.setItem(storageKey(userId), JSON.stringify(ids.slice(0, MAX_ITEMS)));
  } catch {
    // localStorage unavailable (private browsing, etc) — fail silently.
  }
}

/** Most-recently-viewed product ids for a user, newest first. */
export function getRecentlyViewedIds(userId: string | null | undefined): string[] {
  if (!userId || typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(storageKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((v) => typeof v === "string") : [];
  } catch {
    return [];
  }
}
