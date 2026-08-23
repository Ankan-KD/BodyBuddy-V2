// ════════════════════════════════════════════════════════════════════════
// BB Store Admin API — Phase 4
// All Supabase queries for the admin product management interface.
// Only import this from admin surfaces — customers never hit these.
// ════════════════════════════════════════════════════════════════════════

import { supabase } from "./supabase";
import {
  StoreProduct,
  StoreProductVariant,
  StoreCategory,
  StoreBrand,
  ProductRow,
  VariantRow,
  CategoryRow,
  BrandRow,
  productFromRow,
  variantFromRow,
  categoryFromRow,
  brandFromRow,
} from "./storeTypes";

// ── Products (admin — sees ALL regardless of published/availability) ───────

export interface AdminFetchProductsOptions {
  search?: string;
  categoryId?: string;
  published?: boolean;
  availability?: string;
  limit?: number;
  offset?: number;
}

export async function adminFetchProducts(
  opts: AdminFetchProductsOptions = {}
): Promise<{ products: StoreProduct[]; total: number }> {
  if (!supabase) return { products: [], total: 0 };

  const { search, categoryId, published, availability, limit = 25, offset = 0 } = opts;

  let query = supabase
    .from("store_products")
    .select("*, store_brands(*), store_categories(*)", { count: "exact" })
    .order("created_at", { ascending: false });

  if (search?.trim()) {
    query = query.ilike("name", `%${search.trim()}%`);
  }
  if (categoryId) {
    query = query.eq("category_id", categoryId);
  }
  if (published !== undefined) {
    query = query.eq("published", published);
  }
  if (availability) {
    query = query.eq("availability", availability);
  }

  query = query.range(offset, offset + limit - 1);

  const { data, error, count } = await query;

  if (error) {
    console.error("[storeAdminApi] adminFetchProducts:", error.message);
    return { products: [], total: 0 };
  }

  const products = (data as ProductRow[]).map((row) => {
    const product = productFromRow(row);
    if ((row as any).store_brands) product.brand = brandFromRow((row as any).store_brands as BrandRow);
    if ((row as any).store_categories) product.category = categoryFromRow((row as any).store_categories as CategoryRow);
    return product;
  });

  return { products, total: count ?? 0 };
}

export async function adminFetchProductById(id: string): Promise<StoreProduct | null> {
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("store_products")
    .select("*, store_brands(*), store_categories(*)")
    .eq("id", id)
    .single();

  if (error || !data) return null;

  const product = productFromRow(data as ProductRow);
  if ((data as any).store_brands) product.brand = brandFromRow((data as any).store_brands);
  if ((data as any).store_categories) product.category = categoryFromRow((data as any).store_categories);

  // Fetch variants (admin sees all including discontinued)
  const { data: variantData } = await supabase
    .from("store_product_variants")
    .select("*")
    .eq("product_id", id)
    .order("sort_order", { ascending: true });

  if (variantData) {
    product.variants = (variantData as VariantRow[]).map(variantFromRow);
  }

  return product;
}

// ── Create / Update / Delete Products ────────────────────────────────────

export interface ProductUpsertPayload {
  name: string;
  slug: string;
  brand_id: string | null;
  category_id: string | null;
  short_description: string;
  full_description: string;
  usage_info: string;
  ingredients: string;
  warnings: string;
  images: string[];
  tags: string[];
  health_goal_tags: string[];
  serving_size_label: string;
  serving_size_g: number | null;
  calories_per_serving: number | null;
  protein_per_serving: number | null;
  carbs_per_serving: number | null;
  fat_per_serving: number | null;
  fibre_per_serving: number | null;
  sodium_per_serving: number | null;
  sugar_per_serving: number | null;
  published: boolean;
  availability: string;
  is_featured: boolean;
  sort_order: number;
}

export async function adminCreateProduct(
  payload: ProductUpsertPayload
): Promise<{ product: StoreProduct | null; error: string | null }> {
  if (!supabase) return { product: null, error: "No database connection" };

  const { data, error } = await supabase
    .from("store_products")
    .insert(payload)
    .select()
    .single();

  if (error) return { product: null, error: error.message };
  return { product: productFromRow(data as ProductRow), error: null };
}

export async function adminUpdateProduct(
  id: string,
  payload: Partial<ProductUpsertPayload>
): Promise<{ product: StoreProduct | null; error: string | null }> {
  if (!supabase) return { product: null, error: "No database connection" };

  const { data, error } = await supabase
    .from("store_products")
    .update(payload)
    .eq("id", id)
    .select()
    .single();

  if (error) return { product: null, error: error.message };
  return { product: productFromRow(data as ProductRow), error: null };
}

export async function adminDeleteProduct(id: string): Promise<string | null> {
  if (!supabase) return "No database connection";
  const { error } = await supabase.from("store_products").delete().eq("id", id);
  return error ? error.message : null;
}

// ── Variants ──────────────────────────────────────────────────────────────

export interface VariantUpsertPayload {
  product_id: string;
  sku: string;
  name: string;
  size_label: string;
  flavour: string;
  color: string;
  price_paise: number;
  compare_price_paise: number | null;
  stock_quantity: number;
  low_stock_threshold: number;
  images: string[];
  availability: string;
  is_default: boolean;
  sort_order: number;
}

export async function adminCreateVariant(
  payload: VariantUpsertPayload
): Promise<{ variant: StoreProductVariant | null; error: string | null }> {
  if (!supabase) return { variant: null, error: "No database connection" };

  const { data, error } = await supabase
    .from("store_product_variants")
    .insert(payload)
    .select()
    .single();

  if (error) return { variant: null, error: error.message };
  return { variant: variantFromRow(data as VariantRow), error: null };
}

export async function adminUpdateVariant(
  id: string,
  payload: Partial<VariantUpsertPayload>
): Promise<{ variant: StoreProductVariant | null; error: string | null }> {
  if (!supabase) return { variant: null, error: "No database connection" };

  const { data, error } = await supabase
    .from("store_product_variants")
    .update(payload)
    .eq("id", id)
    .select()
    .single();

  if (error) return { variant: null, error: error.message };
  return { variant: variantFromRow(data as VariantRow), error: null };
}

export async function adminDeleteVariant(id: string): Promise<string | null> {
  if (!supabase) return "No database connection";
  const { error } = await supabase.from("store_product_variants").delete().eq("id", id);
  return error ? error.message : null;
}

// ── Categories (admin sees ALL including inactive) ────────────────────────

export async function adminFetchAllCategories(): Promise<StoreCategory[]> {
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("store_categories")
    .select("*")
    .order("sort_order", { ascending: true });

  if (error) return [];
  return (data as CategoryRow[]).map(categoryFromRow);
}

// ── Brands ────────────────────────────────────────────────────────────────

export async function adminFetchAllBrands(): Promise<StoreBrand[]> {
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("store_brands")
    .select("*")
    .order("name", { ascending: true });

  if (error) return [];
  return (data as BrandRow[]).map(brandFromRow);
}

export async function adminCreateBrand(
  name: string
): Promise<{ brand: StoreBrand | null; error: string | null }> {
  if (!supabase) return { brand: null, error: "No database connection" };

  const slug = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  const { data, error } = await supabase
    .from("store_brands")
    .insert({ name: name.trim(), slug })
    .select()
    .single();

  if (error) return { brand: null, error: error.message };
  return { brand: brandFromRow(data as BrandRow), error: null };
}

// ── Image upload via Supabase Storage ────────────────────────────────────

export async function adminUploadProductImage(
  file: File,
  productSlug: string
): Promise<{ url: string | null; error: string | null }> {
  if (!supabase) return { url: null, error: "No database connection" };

  const ext = file.name.split(".").pop() ?? "jpg";
  const path = `products/${productSlug}/${Date.now()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("store-images")
    .upload(path, file, { upsert: true, cacheControl: "3600" });

  if (uploadError) return { url: null, error: uploadError.message };

  const { data } = supabase.storage.from("store-images").getPublicUrl(path);
  return { url: data.publicUrl, error: null };
}

// ── Slug generation helper ────────────────────────────────────────────────

export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
