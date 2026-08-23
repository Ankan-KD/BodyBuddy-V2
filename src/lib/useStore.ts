// ════════════════════════════════════════════════════════════════════════
// BB Store — Phase 2 React Hooks
// Lightweight hooks over storeApi. Each hook manages its own loading/error
// state so components stay simple.
// ════════════════════════════════════════════════════════════════════════

"use client";

import { useCallback, useEffect, useState } from "react";
import {
  fetchTopLevelCategories,
  fetchSubcategories,
  fetchProducts,
  fetchProductBySlug,
  fetchBrands,
  FetchProductsOptions,
} from "./storeApi";
import {
  StoreCategory,
  StoreProduct,
  StoreBrand,
} from "./storeTypes";

// ── useStoreCategories ────────────────────────────────────────────────────

interface UseCategoriesResult {
  categories: StoreCategory[];
  loading: boolean;
  error: string | null;
  reload: () => void;
}

export function useStoreCategories(): UseCategoriesResult {
  const [categories, setCategories] = useState<StoreCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchTopLevelCategories();
      setCategories(data);
    } catch (e) {
      setError("Failed to load categories.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return { categories, loading, error, reload: load };
}

// ── useStoreSubcategories ─────────────────────────────────────────────────

export function useStoreSubcategories(parentId: string | null) {
  const [subcategories, setSubcategories] = useState<StoreCategory[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!parentId) { setSubcategories([]); return; }
    setLoading(true);
    fetchSubcategories(parentId)
      .then(setSubcategories)
      .finally(() => setLoading(false));
  }, [parentId]);

  return { subcategories, loading };
}

// ── useStoreProducts ──────────────────────────────────────────────────────

interface UseProductsResult {
  products: StoreProduct[];
  loading: boolean;
  error: string | null;
  reload: () => void;
}

export function useStoreProducts(opts: FetchProductsOptions = {}): UseProductsResult {
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Stringify opts so the effect re-runs only when options truly change
  const optsKey = JSON.stringify(opts);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchProducts(JSON.parse(optsKey));
      setProducts(data);
    } catch (e) {
      setError("Failed to load products.");
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [optsKey]);

  useEffect(() => { load(); }, [load]);

  return { products, loading, error, reload: load };
}

// ── useStoreProduct (single, by slug) ─────────────────────────────────────

interface UseProductResult {
  product: StoreProduct | null;
  loading: boolean;
  error: string | null;
}

export function useStoreProduct(slug: string | null): UseProductResult {
  const [product, setProduct] = useState<StoreProduct | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) { setProduct(null); return; }
    setLoading(true);
    setError(null);
    fetchProductBySlug(slug)
      .then((p) => {
        if (!p) setError("Product not found.");
        else setProduct(p);
      })
      .catch(() => setError("Failed to load product."))
      .finally(() => setLoading(false));
  }, [slug]);

  return { product, loading, error };
}

// ── useStoreBrands ────────────────────────────────────────────────────────

export function useStoreBrands() {
  const [brands, setBrands] = useState<StoreBrand[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBrands().then(setBrands).finally(() => setLoading(false));
  }, []);

  return { brands, loading };
}
