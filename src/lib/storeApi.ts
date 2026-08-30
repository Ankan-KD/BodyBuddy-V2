// ════════════════════════════════════════════════════════════════════════
// BB Store — Phase 2 Data API
// All Supabase queries for the customer-facing storefront.
// Never import this from admin-only surfaces (use storeAdminApi instead).
// ════════════════════════════════════════════════════════════════════════

import { supabase } from "./supabase";
import { StoreOffer, OfferRow, offerFromRow, StoreSettings, settingsFromRows } from "./offerTypes";
import {
  StoreCategory,
  StoreProduct,
  StoreProductVariant,
  StoreBrand,
  categoryFromProductGroupRow,
  productFromRow,
  variantFromRow,
  brandFromRow,
  defaultVariant,
  ProductGroupRow,
  ProductRow,
  VariantRow,
  BrandRow,
} from "./storeTypes";

// ── Categories (backed by Product Groups) ──────────────────────────────────
// Customers browse the storefront by Product Group (supabase/
// 009_catalogue_redesign.sql) — admin's "Categories" page was replaced by
// "Product Groups & Types" long ago, and products are classified via
// product_group_id, not the old category_id/store_categories table. These
// functions keep their original names/shapes (StoreCategory,
// fetchTopLevelCategories, etc.) so every consuming component keeps working
// unchanged — only the underlying table changed.

/**
 * Fetch all Product Groups — what customers browse by ("Shop by Group" /
 * the storefront's "Categories" section), ordered by sort_order.
 */
export async function fetchTopLevelCategories(): Promise<StoreCategory[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("product_groups")
    .select("*")
    .order("sort_order", { ascending: true });

  if (error) {
    console.error("[storeApi] fetchTopLevelCategories:", error.message);
    return [];
  }
  return (data as ProductGroupRow[]).map(categoryFromProductGroupRow);
}

/**
 * Product Groups are a flat list — there's no sub-group concept (unlike the
 * old store_categories parent/child hierarchy). Kept as a no-op so any
 * caller still asking for subcategories degrades gracefully to "none"
 * instead of erroring.
 */
export async function fetchSubcategories(_parentId: string): Promise<StoreCategory[]> {
  return [];
}

/**
 * Fetch a single Product Group by slug.
 */
export async function fetchCategoryBySlug(slug: string): Promise<StoreCategory | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("product_groups")
    .select("*")
    .eq("slug", slug)
    .single();

  if (error) return null;
  return categoryFromProductGroupRow(data as ProductGroupRow);
}

// ── Products ──────────────────────────────────────────────────────────────

export interface FetchProductsOptions {
  categorySlug?: string;
  brandId?: string;
  productType?: string;
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
    productType,
    healthGoalTag,
    featured,
    search,
    limit = 20,
    offset = 0,
    orderBy = "sort_order",
    orderDir = "asc",
  } = opts;

  // When filtering by category (Product Group) slug, first resolve the slug
  // to an id. PostgREST cannot filter on joined columns
  // (e.g. .eq("product_group.slug", ...)), so we do a quick lookup first and
  // then filter by product_group_id.
  let resolvedGroupId: string | null = null;
  if (categorySlug) {
    const { data: groupData } = await supabase
      .from("product_groups")
      .select("id")
      .eq("slug", categorySlug)
      .single();
    resolvedGroupId = groupData?.id ?? null;
    // If slug doesn't match any group, bail early — no results possible.
    if (!resolvedGroupId) return [];
  }

  let query = supabase
    .from("store_products")
    .select(`*, product_group:product_groups!product_group_id(*), store_brands(*), store_product_variants(*)`)
    .eq("published", true)
    .eq("availability", "active");

  if (resolvedGroupId) {
    query = query.eq("product_group_id", resolvedGroupId);
  }
  if (brandId) {
    query = query.eq("brand_id", brandId);
  }
  if (productType) {
    query = query.eq("product_type", productType);
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
    if ((row as any).product_group) {
      product.category = categoryFromProductGroupRow((row as any).product_group as ProductGroupRow);
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
 * Distinct, non-empty product types among published+active products in a
 * Product Group — used to render the "Type" filter chips under a group page.
 * Fine-grained (e.g. "Whey Protein"), separate from the broad group.
 */
export async function fetchProductTypesForCategory(categorySlug: string): Promise<string[]> {
  if (!supabase || !categorySlug) return [];

  const { data: groupData } = await supabase
    .from("product_groups")
    .select("id")
    .eq("slug", categorySlug)
    .single();
  if (!groupData?.id) return [];

  const { data, error } = await supabase
    .from("store_products")
    .select("product_type")
    .eq("product_group_id", groupData.id)
    .eq("published", true)
    .eq("availability", "active")
    .neq("product_type", "");

  if (error || !data) return [];
  const set = new Set(
    (data as { product_type: string }[])
      .map((r) => r.product_type?.trim())
      .filter(Boolean) as string[]
  );
  return Array.from(set).sort();
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
    .select("*, store_brands(*), product_group:product_groups!product_group_id(*), store_product_variants(*)")
    .in("id", ids)
    .eq("published", true)
    .eq("availability", "active");

  if (error || !data) return [];

  const products = (data as ProductRow[]).map((row) => {
    const product = productFromRow(row);
    if ((row as any).store_brands) product.brand = brandFromRow((row as any).store_brands as BrandRow);
    if ((row as any).product_group) product.category = categoryFromProductGroupRow((row as any).product_group as ProductGroupRow);
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
    .select("*, store_brands(*), product_group:product_groups!product_group_id(*)")
    .eq("slug", slug)
    .eq("published", true)
    .single();

  if (productError || !productData) return null;

  const product = productFromRow(productData as ProductRow);

  if ((productData as any).store_brands) {
    product.brand = brandFromRow((productData as any).store_brands as BrandRow);
  }
  if ((productData as any).product_group) {
    product.category = categoryFromProductGroupRow((productData as any).product_group as ProductGroupRow);
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
    .select("*, store_brands(*), product_group:product_groups!product_group_id(*), store_product_variants(*)")
    .eq("id", id)
    .eq("published", true)
    .single();

  if (error || !data) return null;

  const product = productFromRow(data as ProductRow);
  if ((data as any).store_brands) product.brand = brandFromRow((data as any).store_brands);
  if ((data as any).product_group) product.category = categoryFromProductGroupRow((data as any).product_group);
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

// ════════════════════════════════════════════════════════════════════════
// Phase 9 — Customer-facing store settings & offers
// ════════════════════════════════════════════════════════════════════════

/** Fetch store-wide settings (read-only for customers). */
export async function fetchStoreSettings(): Promise<StoreSettings> {
  if (!supabase) return settingsFromRows([]);
  const { data, error } = await supabase.from("store_settings").select("key, value");
  if (error || !data) return settingsFromRows([]);
  return settingsFromRows(data as { key: string; value: string }[]);
}

/** Fetch all currently active offers (for customer display / cart application). */
export async function fetchActiveOffers(): Promise<StoreOffer[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("store_offers")
    .select("*")
    .eq("is_active", true)
    .order("created_at", { ascending: false });
  if (error) return [];
  const now = Date.now();
  return (data as OfferRow[])
    .map(offerFromRow)
    .filter(o => {
      if (o.startsAt && new Date(o.startsAt).getTime() > now) return false;
      if (o.endsAt && new Date(o.endsAt).getTime() < now) return false;
      return true;
    });
}
