// ════════════════════════════════════════════════════════════════════════
// BB Store — Phase 2 Data API
// All Supabase queries for the customer-facing storefront.
// Never import this from admin-only surfaces (use storeAdminApi instead).
// ════════════════════════════════════════════════════════════════════════

import { supabase } from "./supabase";
import {
  StoreCategory,
  StoreProduct,
  StoreProductVariant,
  StoreBrand,
  categoryFromRow,
  productFromRow,
  variantFromRow,
  brandFromRow,
  defaultVariant,
  CategoryRow,
  ProductRow,
  VariantRow,
  BrandRow,
} from "./storeTypes";

// ── Categories ────────────────────────────────────────────────────────────

/**
 * Fetch all active top-level categories (parent_id IS NULL), ordered by sort_order.
 */
export async function fetchTopLevelCategories(): Promise<StoreCategory[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("store_categories")
    .select("*")
    .is("parent_id", null)
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  if (error) {
    console.error("[storeApi] fetchTopLevelCategories:", error.message);
    return [];
  }
  return (data as CategoryRow[]).map(categoryFromRow);
}

/**
 * Fetch subcategories for a given parent category id.
 */
export async function fetchSubcategories(parentId: string): Promise<StoreCategory[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("store_categories")
    .select("*")
    .eq("parent_id", parentId)
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  if (error) {
    console.error("[storeApi] fetchSubcategories:", error.message);
    return [];
  }
  return (data as CategoryRow[]).map(categoryFromRow);
}

/**
 * Fetch a single category by slug.
 */
export async function fetchCategoryBySlug(slug: string): Promise<StoreCategory | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("store_categories")
    .select("*")
    .eq("slug", slug)
    .eq("is_active", true)
    .single();

  if (error) return null;
  return categoryFromRow(data as CategoryRow);
}

// ── Products ──────────────────────────────────────────────────────────────

export interface FetchProductsOptions {
  categorySlug?: string;
  brandId?: string;
  healthGoalTag?: string;
  featured?: boolean;
  search?: string;
  limit?: number;
  offset?: number;
  orderBy?: "sort_order" | "rating_average" | "created_at";
  orderDir?: "asc" | "desc";
}

/**
 * Fetch published + active products with optional filtering.
 * Includes each product's variants so cards can show price/discount/stock.
 */
export async function fetchProducts(opts: FetchProductsOptions = {}): Promise<StoreProduct[]> {
  if (!supabase) return [];

  const {
    categorySlug,
    brandId,
    healthGoalTag,
    featured,
    search,
    limit = 20,
    offset = 0,
    orderBy = "sort_order",
    orderDir = "asc",
  } = opts;

  let query = supabase
    .from("store_products")
    .select(
      categorySlug
        ? `*, store_categories!inner(slug), store_brands(*), store_product_variants(*)`
        : `*, store_categories(*), store_brands(*), store_product_variants(*)`
    )
    .eq("published", true)
    .eq("availability", "active");

  if (categorySlug) {
    query = query.eq("store_categories.slug", categorySlug);
  }
  if (brandId) {
    query = query.eq("brand_id", brandId);
  }
  if (healthGoalTag) {
    query = query.contains("health_goal_tags", [healthGoalTag]);
  }
  if (featured) {
    query = query.eq("is_featured", true);
  }
  if (search && search.trim()) {
    query = query.textSearch(
      "name,short_description,full_description",
      search.trim(),
      { type: "websearch", config: "english" }
    );
  }

  query = query
    .order(orderBy, { ascending: orderDir === "asc" })
    .range(offset, offset + limit - 1);

  const { data, error } = await query;

  if (error) {
    console.error("[storeApi] fetchProducts:", error.message);
    return [];
  }

  return (data as ProductRow[]).map((row) => {
    const product = productFromRow(row);
    // Attach joined brand/category if present
    if ((row as any).store_brands) {
      product.brand = brandFromRow((row as any).store_brands as BrandRow);
    }
    if ((row as any).store_categories) {
      product.category = categoryFromRow((row as any).store_categories as CategoryRow);
    }
    // Attach variants (needed for price/discount/stock display in cards)
    if ((row as any).store_product_variants) {
      product.variants = ((row as any).store_product_variants as VariantRow[])
        .filter((v) => v.availability !== "discontinued")
        .map(variantFromRow)
        .sort((a, b) => a.sortOrder - b.sortOrder);
    }
    return product;
  });
}

/**
 * Fetch products currently on promotional pricing (a variant whose
 * compare price is set and higher than its selling price). There's no
 * direct DB column for "on sale", so this fetches a generous page of
 * published/active products (with variants already joined by
 * fetchProducts) and filters client-side. Fine for a V1-sized catalog.
 */
export async function fetchDealProducts(limit = 20): Promise<StoreProduct[]> {
  const candidates = await fetchProducts({ limit: 100, orderBy: "sort_order", orderDir: "asc" });
  const deals = candidates.filter((p) => {
    const v = defaultVariant(p.variants ?? []);
    return !!v && v.comparePricePaise != null && v.comparePricePaise > v.pricePaise;
  });
  return deals.slice(0, limit);
}

/**
 * Fetch a specific set of products by id, preserving the given order.
 * Used for "Recently Viewed".
 */
export async function fetchProductsByIds(ids: string[]): Promise<StoreProduct[]> {
  if (!supabase || !ids.length) return [];

  const { data, error } = await supabase
    .from("store_products")
    .select("*, store_brands(*), store_categories(*), store_product_variants(*)")
    .in("id", ids)
    .eq("published", true)
    .eq("availability", "active");

  if (error || !data) return [];

  const products = (data as ProductRow[]).map((row) => {
    const product = productFromRow(row);
    if ((row as any).store_brands) product.brand = brandFromRow((row as any).store_brands as BrandRow);
    if ((row as any).store_categories) product.category = categoryFromRow((row as any).store_categories as CategoryRow);
    if ((row as any).store_product_variants) {
      product.variants = ((row as any).store_product_variants as VariantRow[])
        .filter((v) => v.availability !== "discontinued")
        .map(variantFromRow)
        .sort((a, b) => a.sortOrder - b.sortOrder);
    }
    return product;
  });

  const order = new Map(ids.map((id, i) => [id, i]));
  return products.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
}

/**
 * Fetch a single product by slug, including all its variants.
 */
export async function fetchProductBySlug(slug: string): Promise<StoreProduct | null> {
  if (!supabase) return null;

  const { data: productData, error: productError } = await supabase
    .from("store_products")
    .select("*, store_brands(*), store_categories(*)")
    .eq("slug", slug)
    .eq("published", true)
    .single();

  if (productError || !productData) return null;

  const product = productFromRow(productData as ProductRow);

  if ((productData as any).store_brands) {
    product.brand = brandFromRow((productData as any).store_brands as BrandRow);
  }
  if ((productData as any).store_categories) {
    product.category = categoryFromRow((productData as any).store_categories as CategoryRow);
  }

  // Fetch variants
  const { data: variantData, error: variantError } = await supabase
    .from("store_product_variants")
    .select("*")
    .eq("product_id", product.id)
    .neq("availability", "discontinued")
    .order("sort_order", { ascending: true });

  if (!variantError && variantData) {
    product.variants = (variantData as VariantRow[]).map(variantFromRow);
  }

  return product;
}

/**
 * Fetch a product by id (used when we have id not slug, e.g. cart lookups).
 */
export async function fetchProductById(id: string): Promise<StoreProduct | null> {
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("store_products")
    .select("*, store_brands(*), store_categories(*), store_product_variants(*)")
    .eq("id", id)
    .eq("published", true)
    .single();

  if (error || !data) return null;

  const product = productFromRow(data as ProductRow);
  if ((data as any).store_brands) product.brand = brandFromRow((data as any).store_brands);
  if ((data as any).store_categories) product.category = categoryFromRow((data as any).store_categories);
  if ((data as any).store_product_variants) {
    product.variants = ((data as any).store_product_variants as VariantRow[]).map(variantFromRow);
  }
  return product;
}

/**
 * Fetch variants for a product (standalone call, e.g. after the product card is loaded).
 */
export async function fetchVariantsByProductId(productId: string): Promise<StoreProductVariant[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("store_product_variants")
    .select("*")
    .eq("product_id", productId)
    .neq("availability", "discontinued")
    .order("sort_order", { ascending: true });

  if (error) {
    console.error("[storeApi] fetchVariantsByProductId:", error.message);
    return [];
  }
  return (data as VariantRow[]).map(variantFromRow);
}

/**
 * Lightweight search — returns product name + slug for autocomplete.
 */
export async function searchProductNames(
  query: string,
  limit = 8
): Promise<{ id: string; name: string; slug: string }[]> {
  if (!supabase || !query.trim()) return [];
  const { data, error } = await supabase
    .from("store_products")
    .select("id, name, slug")
    .eq("published", true)
    .eq("availability", "active")
    .ilike("name", `%${query.trim()}%`)
    .limit(limit);

  if (error) return [];
  return (data ?? []) as { id: string; name: string; slug: string }[];
}

// ── Brands ────────────────────────────────────────────────────────────────

export async function fetchBrands(): Promise<StoreBrand[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("store_brands")
    .select("*")
    .eq("is_active", true)
    .order("name", { ascending: true });

  if (error) return [];
  return (data as BrandRow[]).map(brandFromRow);
}
