// ════════════════════════════════════════════════════════════════════════
// BB Store — Phase 2 React Hooks
// Thin wrappers around storeApi that give components loading/error state.
// ════════════════════════════════════════════════════════════════════════

"use client";

import { useEffect, useState, useCallback } from "react";
import { fetchStoreSettings, fetchActiveOffers } from "./storeApi";
import type { StoreSettings, StoreOffer } from "./offerTypes";
import { useAuth } from "./auth";
import {
  fetchTopLevelCategories,
  fetchSubcategories,
  fetchCategoryBySlug,
  fetchProducts,
  fetchProductBySlug,
  fetchProductById,
  fetchProductsByIds,
  fetchDealProducts,
  fetchVariantsByProductId,
  searchProductNames,
  fetchBrands,
  FetchProductsOptions,
} from "./storeApi";
import { getRecentlyViewedIds } from "./recentlyViewed";
import {
  StoreCategory,
  StoreProduct,
  StoreProductVariant,
  StoreBrand,
} from "./storeTypes";

// ── Generic async hook ────────────────────────────────────────────────────

function useAsync<T>(
  fn: () => Promise<T>,
  deps: unknown[],
  initial: T
): { data: T; loading: boolean; error: string | null; refetch: () => void } {
  const [data, setData] = useState<T>(initial);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rev, setRev] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fn()
      .then((result) => {
        if (!cancelled) {
          setData(result);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(String(err?.message ?? err));
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, rev]);

  const refetch = useCallback(() => setRev((r) => r + 1), []);
  return { data, loading, error, refetch };
}

// ── Categories ────────────────────────────────────────────────────────────

export function useTopLevelCategories() {
  return useAsync<StoreCategory[]>(fetchTopLevelCategories, [], []);
}

export function useSubcategories(parentId: string | null) {
  return useAsync<StoreCategory[]>(
    () => (parentId ? fetchSubcategories(parentId) : Promise.resolve([])),
    [parentId],
    []
  );
}

export function useCategoryBySlug(slug: string | null) {
  return useAsync<StoreCategory | null>(
    () => (slug ? fetchCategoryBySlug(slug) : Promise.resolve(null)),
    [slug],
    null
  );
}

// ── Products ──────────────────────────────────────────────────────────────

export function useProducts(opts: FetchProductsOptions = {}) {
  // Stringify opts so the dep array works correctly
  const key = JSON.stringify(opts);
  return useAsync<StoreProduct[]>(
    () => fetchProducts(opts),
    [key],
    []
  );
}

/** Products currently on promotional pricing (compare price > selling price). */
export function useDealProducts(limit = 20) {
  return useAsync<StoreProduct[]>(() => fetchDealProducts(limit), [limit], []);
}

/**
 * The current user's recently viewed products, most-recent-first.
 * Reads the id list from local storage; call trackRecentlyViewed()
 * (see recentlyViewed.ts) from the product detail page to populate it.
 */
export function useRecentlyViewed(limit = 10) {
  const { user } = useAuth();
  const ids = user ? getRecentlyViewedIds(user.id).slice(0, limit) : [];
  const key = ids.join(",");
  return useAsync<StoreProduct[]>(
    () => (ids.length ? fetchProductsByIds(ids) : Promise.resolve([])),
    [key],
    []
  );
}

export function useProductBySlug(slug: string | null) {
  return useAsync<StoreProduct | null>(
    () => (slug ? fetchProductBySlug(slug) : Promise.resolve(null)),
    [slug],
    null
  );
}

export function useProductById(id: string | null) {
  return useAsync<StoreProduct | null>(
    () => (id ? fetchProductById(id) : Promise.resolve(null)),
    [id],
    null
  );
}

export function useVariants(productId: string | null) {
  return useAsync<StoreProductVariant[]>(
    () => (productId ? fetchVariantsByProductId(productId) : Promise.resolve([])),
    [productId],
    []
  );
}

// ── Search ────────────────────────────────────────────────────────────────

export function useProductSearch(query: string, limit = 8) {
  return useAsync<{ id: string; name: string; slug: string }[]>(
    () => searchProductNames(query, limit),
    [query, limit],
    []
  );
}

// ── Brands ────────────────────────────────────────────────────────────────

export function useBrands() {
  return useAsync<StoreBrand[]>(fetchBrands, [], []);
}

// ── Phase 9 — Settings & Offers ───────────────────────────────────────────

export function useStoreSettings() {
  return useAsync<StoreSettings | null>(
    fetchStoreSettings,
    [],
    null
  );
}

export function useActiveOffers() {
  return useAsync<StoreOffer[]>(fetchActiveOffers, [], []);
}

// ── Phase 10 — Personalized hooks ────────────────────────────────────────

/**
 * Products matching the user's BB Health goal tag.
 * Returns an empty array when goalTag is null/empty.
 */
export function useGoalProducts(goalTag: string | null, limit = 10) {
  return useAsync<StoreProduct[]>(
    () =>
      goalTag
        ? fetchProducts({ healthGoalTag: goalTag, limit })
        : Promise.resolve([]),
    [goalTag, limit],
    []
  );
}

/**
 * High-protein products (tagged "muscle-building") useful for any user
 * trying to hit their protein target regardless of primary goal.
 */
export function useHighProteinProducts(limit = 10) {
  return useAsync<StoreProduct[]>(
    () => fetchProducts({ healthGoalTag: "muscle-building", limit }),
    [limit],
    []
  );
}
