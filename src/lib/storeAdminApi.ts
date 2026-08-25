// ════════════════════════════════════════════════════════════════════════
// BB Store Admin API — Phase 4
// All Supabase queries for the admin product management interface.
// Only import this from admin surfaces — customers never hit these.
// ════════════════════════════════════════════════════════════════════════

import { supabase } from "./supabase";
import {
  StoreOffer,
  StoreSettings,
  OfferRow,
  offerFromRow,
  settingsFromRows,
} from "./offerTypes";
import {
  StoreOrder,
  OrderRow,
  OrderStatus,
  orderFromRow,
} from "./orderTypes";
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
  productType?: string;
  published?: boolean;
  availability?: string;
  limit?: number;
  offset?: number;
}

export async function adminFetchProducts(
  opts: AdminFetchProductsOptions = {}
): Promise<{ products: StoreProduct[]; total: number }> {
  if (!supabase) return { products: [], total: 0 };

  const { search, categoryId, productType, published, availability, limit = 25, offset = 0 } = opts;

  let query = supabase
    .from("store_products")
    .select("*, store_brands(*), category:store_categories!category_id(*), store_product_variants(*)", { count: "exact" })
    .order("created_at", { ascending: false });

  if (search?.trim()) {
    query = query.ilike("name", `%${search.trim()}%`);
  }
  if (categoryId) {
    query = query.eq("category_id", categoryId);
  }
  if (productType) {
    query = query.eq("product_type", productType);
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
    if ((row as any).category) product.category = categoryFromRow((row as any).category as CategoryRow);
    if ((row as any).store_product_variants) {
      product.variants = ((row as any).store_product_variants as VariantRow[])
        .map(variantFromRow)
        .sort((a, b) => a.sortOrder - b.sortOrder);
    }
    return product;
  });

  return { products, total: count ?? 0 };
}

export async function adminFetchProductById(id: string): Promise<StoreProduct | null> {
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("store_products")
    .select("*, store_brands(*), category:store_categories!category_id(*)")
    .eq("id", id)
    .single();

  if (error || !data) return null;

  const product = productFromRow(data as ProductRow);
  if ((data as any).store_brands) product.brand = brandFromRow((data as any).store_brands);
  if ((data as any).category) product.category = categoryFromRow((data as any).category);

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

/**
 * Distinct, non-empty product types currently in use across all store
 * products — used to populate the Type filter dropdown in the admin
 * products list. Fine-grained (e.g. "Whey Protein", "Creatine"); separate
 * from the broad customer-facing Category.
 */
export async function adminFetchDistinctProductTypes(): Promise<string[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("store_products")
    .select("product_type")
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
 * All catalog product_ids that already have a matching store product
 * (via catalog_source_id) — used by the admin Catalog browser to show
 * "Already in store" instead of silently allowing duplicate imports.
 */
export async function adminFetchImportedCatalogIds(): Promise<Set<string>> {
  if (!supabase) return new Set();
  const { data, error } = await supabase
    .from("store_products")
    .select("catalog_source_id")
    .not("catalog_source_id", "is", null);
  if (error || !data) return new Set();
  return new Set(
    (data as { catalog_source_id: string | null }[])
      .map((r) => r.catalog_source_id)
      .filter(Boolean) as string[]
  );
}

// ── Create / Update / Delete Products ────────────────────────────────────

export interface ProductUpsertPayload {
  name: string;
  slug: string;
  brand_id: string | null;
  category_id: string | null;
  product_type: string;
  catalog_source_id: string | null;
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

// ════════════════════════════════════════════════════════════════════════
// Phase 8 — Admin Orders & Inventory
// ════════════════════════════════════════════════════════════════════════

// ── Admin Order Fetch ─────────────────────────────────────────────────────

export interface AdminFetchOrdersOptions {
  status?: OrderStatus | "";
  search?: string;       // searches order_number or customer_name
  limit?: number;
  offset?: number;
}

export async function adminFetchOrders(
  opts: AdminFetchOrdersOptions = {}
): Promise<{ orders: StoreOrder[]; total: number }> {
  if (!supabase) return { orders: [], total: 0 };

  const { status, search, limit = 25, offset = 0 } = opts;

  let query = supabase
    .from("store_orders")
    .select("*, store_order_items(*)", { count: "exact" })
    .order("created_at", { ascending: false });

  if (status) query = query.eq("status", status);
  if (search?.trim()) {
    query = query.or(
      `order_number.ilike.%${search.trim()}%,customer_name.ilike.%${search.trim()}%,customer_email.ilike.%${search.trim()}%`
    );
  }

  query = query.range(offset, offset + limit - 1);

  const { data, error, count } = await query;

  if (error) {
    console.error("[storeAdminApi] adminFetchOrders:", error.message);
    return { orders: [], total: 0 };
  }

  return {
    orders: (data as OrderRow[]).map(orderFromRow),
    total: count ?? 0,
  };
}

export async function adminFetchOrderById(
  orderId: string
): Promise<StoreOrder | null> {
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("store_orders")
    .select("*, store_order_items(*)")
    .eq("id", orderId)
    .single();

  if (error || !data) return null;
  return orderFromRow(data as OrderRow);
}

// ── Admin Order Status Update ─────────────────────────────────────────────

export async function adminUpdateOrderStatus(
  orderId: string,
  status: OrderStatus
): Promise<string | null> {
  if (!supabase) return "No database connection";

  const { error } = await supabase
    .from("store_orders")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", orderId);

  return error ? error.message : null;
}

// ── Admin Inventory ────────────────────────────────────────────────────────

export interface InventoryVariantRow {
  variantId: string;
  sku: string;
  variantName: string;
  sizeLabel: string;
  flavour: string;
  stockQuantity: number;
  lowStockThreshold: number;
  availability: string;
  productId: string;
  productName: string;
  productAvailability: string;
  /** Whether the parent product is published (visible to customers). */
  productPublished: boolean;
}

export async function adminFetchInventory(opts: {
  search?: string;
  lowStockOnly?: boolean;
  limit?: number;
  offset?: number;
} = {}): Promise<{ rows: InventoryVariantRow[]; total: number }> {
  if (!supabase) return { rows: [], total: 0 };

  const { search, lowStockOnly, limit = 50, offset = 0 } = opts;

  // Join variants with products
  let query = supabase
    .from("store_product_variants")
    .select(
      "id, sku, name, size_label, flavour, stock_quantity, low_stock_threshold, availability, product_id, store_products!inner(id, name, availability, published)",
      { count: "exact" }
    )
    .order("stock_quantity", { ascending: true });

  if (search?.trim()) {
    query = query.or(`sku.ilike.%${search.trim()}%,name.ilike.%${search.trim()}%`);
  }

  if (lowStockOnly) {
    // Supabase doesn't support column comparisons directly in filter, so we filter client-side after fetch
  }

  query = query.range(offset, offset + limit - 1);

  const { data, error, count } = await query;

  if (error) {
    console.error("[storeAdminApi] adminFetchInventory:", error.message);
    return { rows: [], total: 0 };
  }

  let rows: InventoryVariantRow[] = (data as any[]).map((r) => ({
    variantId: r.id,
    sku: r.sku,
    variantName: r.name,
    sizeLabel: r.size_label,
    flavour: r.flavour,
    stockQuantity: Number(r.stock_quantity),
    lowStockThreshold: Number(r.low_stock_threshold),
    availability: r.availability,
    productId: r.store_products?.id ?? "",
    productName: r.store_products?.name ?? "",
    productAvailability: r.store_products?.availability ?? "",
    productPublished: r.store_products?.published ?? false,
  }));

  if (lowStockOnly) {
    rows = rows.filter((r) => r.stockQuantity <= r.lowStockThreshold);
  }

  return { rows, total: lowStockOnly ? rows.length : (count ?? 0) };
}

export async function adminRestockVariant(
  variantId: string,
  newQuantity: number
): Promise<string | null> {
  if (!supabase) return "No database connection";

  // If quantity > 0 and variant was out_of_stock, set back to active
  const { data: current } = await supabase
    .from("store_product_variants")
    .select("availability")
    .eq("id", variantId)
    .single();

  const updates: Record<string, unknown> = {
    stock_quantity: newQuantity,
    updated_at: new Date().toISOString(),
  };

  if (
    current?.availability === "out_of_stock" &&
    newQuantity > 0
  ) {
    updates.availability = "active";
  }

  if (newQuantity === 0) {
    updates.availability = "out_of_stock";
  }

  const { error } = await supabase
    .from("store_product_variants")
    .update(updates)
    .eq("id", variantId);

  return error ? error.message : null;
}

// ════════════════════════════════════════════════════════════════════════
// Phase 9 — Admin Categories, Offers & Store Controls
// ════════════════════════════════════════════════════════════════════════

// ── Category CRUD ─────────────────────────────────────────────────────

export interface CategoryUpsertPayload {
  parent_id: string | null;
  slug: string;
  name: string;
  description: string;
  icon_key: string;
  image_url: string | null;
  sort_order: number;
  is_active: boolean;
  is_featured?: boolean;
}

export async function adminCreateCategory(
  payload: CategoryUpsertPayload
): Promise<{ data: import("./storeTypes").StoreCategory | null; error: string | null }> {
  if (!supabase) return { data: null, error: "No database connection" };
  const { data, error } = await supabase
    .from("store_categories")
    .insert(payload)
    .select()
    .single();
  if (error) return { data: null, error: error.message };
  const { categoryFromRow } = await import("./storeTypes");
  return { data: categoryFromRow(data as any), error: null };
}

export async function adminUpdateCategory(
  id: string,
  payload: Partial<CategoryUpsertPayload>
): Promise<{ data: import("./storeTypes").StoreCategory | null; error: string | null }> {
  if (!supabase) return { data: null, error: "No database connection" };
  const { data, error } = await supabase
    .from("store_categories")
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();
  if (error) return { data: null, error: error.message };
  const { categoryFromRow } = await import("./storeTypes");
  return { data: categoryFromRow(data as any), error: null };
}

export async function adminDeleteCategory(id: string): Promise<string | null> {
  if (!supabase) return "No database connection";
  const { error } = await supabase.from("store_categories").delete().eq("id", id);
  return error ? error.message : null;
}

export async function adminReorderCategories(
  items: { id: string; sort_order: number }[]
): Promise<string | null> {
  if (!supabase) return "No database connection";
  const promises = items.map((item) =>
    supabase!
      .from("store_categories")
      .update({ sort_order: item.sort_order, updated_at: new Date().toISOString() })
      .eq("id", item.id)
  );
  const results = await Promise.all(promises);
  const err = results.find((r) => r.error);
  return err?.error?.message ?? null;
}

// ── Offers CRUD ───────────────────────────────────────────────────────

export async function adminFetchAllOffers(): Promise<StoreOffer[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("store_offers")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) return [];
  return (data as OfferRow[]).map(offerFromRow);
}

export async function adminFetchOfferById(id: string): Promise<StoreOffer | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("store_offers")
    .select("*")
    .eq("id", id)
    .single();
  if (error || !data) return null;
  return offerFromRow(data as OfferRow);
}

export interface OfferUpsertPayload {
  title: string;
  code: string | null;
  description: string;
  discount_type: "percentage" | "fixed_paise";
  discount_value: number;
  is_active: boolean;
  starts_at: string | null;
  ends_at: string | null;
  product_ids: string[];
  min_order_paise: number | null;
  max_uses: number | null;
}

export async function adminCreateOffer(
  payload: OfferUpsertPayload
): Promise<{ offer: StoreOffer | null; error: string | null }> {
  if (!supabase) return { offer: null, error: "No database connection" };
  const { data, error } = await supabase
    .from("store_offers")
    .insert(payload)
    .select()
    .single();
  if (error) return { offer: null, error: error.message };
  return { offer: offerFromRow(data as OfferRow), error: null };
}

export async function adminUpdateOffer(
  id: string,
  payload: Partial<OfferUpsertPayload>
): Promise<{ offer: StoreOffer | null; error: string | null }> {
  if (!supabase) return { offer: null, error: "No database connection" };
  const { data, error } = await supabase
    .from("store_offers")
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();
  if (error) return { offer: null, error: error.message };
  return { offer: offerFromRow(data as OfferRow), error: null };
}

export async function adminDeleteOffer(id: string): Promise<string | null> {
  if (!supabase) return "No database connection";
  const { error } = await supabase.from("store_offers").delete().eq("id", id);
  return error ? error.message : null;
}

export async function adminToggleOfferActive(
  id: string,
  isActive: boolean
): Promise<string | null> {
  if (!supabase) return "No database connection";
  const { error } = await supabase
    .from("store_offers")
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq("id", id);
  return error ? error.message : null;
}

// ── Store Settings ────────────────────────────────────────────────────

export async function adminFetchSettings(): Promise<StoreSettings> {
  if (!supabase) return settingsFromRows([]);
  const { data, error } = await supabase.from("store_settings").select("key, value");
  if (error || !data) return settingsFromRows([]);
  return settingsFromRows(data as { key: string; value: string }[]);
}

export async function adminSaveSetting(
  key: string,
  value: string
): Promise<string | null> {
  if (!supabase) return "No database connection";
  const { error } = await supabase
    .from("store_settings")
    .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: "key" });
  return error ? error.message : null;
}

export async function adminSaveSettings(
  settings: Partial<{
    store_name: string;
    store_tagline: string;
    store_announcement: string;
    store_announcement_active: string;
    maintenance_mode: string;
    featured_category_ids: string;
  }>
): Promise<string | null> {
  if (!supabase) return "No database connection";
  const rows = Object.entries(settings).map(([key, value]) => ({
    key,
    value: value ?? "",
    updated_at: new Date().toISOString(),
  }));
  const { error } = await supabase
    .from("store_settings")
    .upsert(rows, { onConflict: "key" });
  return error ? error.message : null;
}

// ── Featured Product Toggle ───────────────────────────────────────────

export async function adminToggleFeaturedProduct(
  productId: string,
  isFeatured: boolean
): Promise<string | null> {
  if (!supabase) return "No database connection";
  const { error } = await supabase
    .from("store_products")
    .update({ is_featured: isFeatured, updated_at: new Date().toISOString() })
    .eq("id", productId);
  return error ? error.message : null;
}

// ═══════════════════════════════════════════════════════════════════════
// Phase 11 — Customer Management & Top Products
// ═══════════════════════════════════════════════════════════════════════

export interface AdminCustomer {
  userId: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  orderCount: number;
  totalSpentPaise: number;
  lastOrderAt: string;
  lastOrderStatus: string;
}

export interface AdminFetchCustomersOptions {
  search?: string;
  limit?: number;
  offset?: number;
}

export async function adminFetchCustomers(
  opts: AdminFetchCustomersOptions = {}
): Promise<{ customers: AdminCustomer[]; total: number }> {
  if (!supabase) return { customers: [], total: 0 };

  const { search, limit = 25, offset = 0 } = opts;

  // Fetch all non-cancelled orders to aggregate by customer
  let query = supabase
    .from("store_orders")
    .select("user_id, customer_name, customer_email, customer_phone, total_paise, status, created_at")
    .order("created_at", { ascending: false });

  if (search?.trim()) {
    query = query.or(
      `customer_name.ilike.%${search.trim()}%,customer_email.ilike.%${search.trim()}%`
    );
  }

  const { data, error } = await query;

  if (error) {
    console.error("[storeAdminApi] adminFetchCustomers:", error.message);
    return { customers: [], total: 0 };
  }

  // Aggregate by userId
  const map = new Map<string, AdminCustomer>();
  for (const row of (data as any[])) {
    const uid = row.user_id as string;
    if (!map.has(uid)) {
      map.set(uid, {
        userId: uid,
        customerName: row.customer_name,
        customerEmail: row.customer_email,
        customerPhone: row.customer_phone,
        orderCount: 0,
        totalSpentPaise: 0,
        lastOrderAt: row.created_at,
        lastOrderStatus: row.status,
      });
    }
    const c = map.get(uid)!;
    c.orderCount += 1;
    if (row.status !== "cancelled") {
      c.totalSpentPaise += Number(row.total_paise);
    }
  }

  const all = Array.from(map.values()).sort(
    (a, b) => b.totalSpentPaise - a.totalSpentPaise
  );

  return {
    customers: all.slice(offset, offset + limit),
    total: all.length,
  };
}

export interface TopProduct {
  productId: string;
  productName: string;
  imageUrl: string | null;
  unitsSold: number;
  revenuePaise: number;
}

export async function adminFetchTopProducts(limit = 5): Promise<TopProduct[]> {
  if (!supabase) return [];

  // Aggregate order items (from non-cancelled orders)
  const { data: orders, error: oErr } = await supabase
    .from("store_orders")
    .select("id, status")
    .neq("status", "cancelled");

  if (oErr || !orders || orders.length === 0) return [];

  const orderIds = (orders as { id: string }[]).map((o) => o.id);

  const { data: items, error: iErr } = await supabase
    .from("store_order_items")
    .select("product_id, product_name, image_url, quantity, line_total_paise")
    .in("order_id", orderIds);

  if (iErr || !items) return [];

  const map = new Map<string, TopProduct>();
  for (const item of (items as any[])) {
    const pid = item.product_id ?? item.product_name; // fallback to name if product deleted
    if (!map.has(pid)) {
      map.set(pid, {
        productId: item.product_id ?? "",
        productName: item.product_name,
        imageUrl: item.image_url,
        unitsSold: 0,
        revenuePaise: 0,
      });
    }
    const p = map.get(pid)!;
    p.unitsSold += Number(item.quantity);
    p.revenuePaise += Number(item.line_total_paise);
  }

  return Array.from(map.values())
    .sort((a, b) => b.revenuePaise - a.revenuePaise)
    .slice(0, limit);
}
