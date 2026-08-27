// ════════════════════════════════════════════════════════════════════════
// BB Admin — Product Catalogue API
//
// All Supabase operations for the three redesigned admin pages:
//   • Product Catalogue (source of truth for product data)
//   • Store Products    (store-operational view)
//   • Product Groups & Types (classification management)
//
// Terminology:
//   user_category → product_group
//   category      → product_type
// ════════════════════════════════════════════════════════════════════════

import { supabase } from "./supabase";

// ── Types ─────────────────────────────────────────────────────────────────

export interface ProductGroup {
  id: string;
  name: string;
  slug: string;
  iconKey: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface ProductType {
  id: string;
  name: string;
  slug: string;
  productGroupId: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface CatalogueVariant {
  id: string;
  catalogueId: string;
  variantId: string;
  sku: string;
  variantName: string;
  sizeWeight: string;
  flavour: string;
  colour: string;
  variantStatus: string;
  suggestedPriceINR: number | null;
  compareAtPriceINR: number | null;
  stockQuantity: number;
  lowStockThreshold: number;
  isDefaultVariant: boolean;
  calories: number | null;
  proteinG: number | null;
  carbohydratesG: number | null;
  fatG: number | null;
  fibreG: number | null;
  sugarG: number | null;
  sodiumMg: number | null;
  servingSizeLabel: string | null;
  servingSizeG: number | null;
}

export interface CatalogueProduct {
  id: string;
  productId: string;
  productName: string;
  slug: string;
  brand: string;
  productGroupId: string | null;
  productTypeId: string | null;
  productGroupName: string;
  productTypeName: string;
  goalTags: string[];
  aimTags: string[];
  searchTags: string[];
  shortDescription: string;
  fullDescription: string;
  usageInformation: string;
  ingredients: string;
  warningsAllergens: string;
  imageUrls: string[];
  servingSizeLabel: string;
  servingSizeG: number | null;
  calories: number | null;
  proteinG: number | null;
  carbohydratesG: number | null;
  fatG: number | null;
  fibreG: number | null;
  sugarG: number | null;
  sodiumMg: number | null;
  productStatus: string;
  sortOrder: number;
  variants: CatalogueVariant[];
  createdAt: string;
  updatedAt: string;
}

// ── Row → Type mappers ────────────────────────────────────────────────────

function groupFromRow(r: Record<string, unknown>): ProductGroup {
  return {
    id: r.id as string,
    name: r.name as string,
    slug: r.slug as string,
    iconKey: (r.icon_key as string) ?? "Tag",
    sortOrder: Number(r.sort_order ?? 0),
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
  };
}

function typeFromRow(r: Record<string, unknown>): ProductType {
  return {
    id: r.id as string,
    name: r.name as string,
    slug: r.slug as string,
    productGroupId: (r.product_group_id as string) ?? null,
    sortOrder: Number(r.sort_order ?? 0),
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
  };
}

function variantFromCatalogueRow(r: Record<string, unknown>): CatalogueVariant {
  return {
    id: r.id as string,
    catalogueId: r.catalogue_id as string,
    variantId: r.variant_id as string,
    sku: r.sku as string,
    variantName: (r.variant_name as string) ?? "",
    sizeWeight: (r.size_weight as string) ?? "",
    flavour: (r.flavour as string) ?? "",
    colour: (r.colour as string) ?? "",
    variantStatus: (r.variant_status as string) ?? "active",
    suggestedPriceINR: r.suggested_price_inr != null ? Number(r.suggested_price_inr) : null,
    compareAtPriceINR: r.compare_at_price_inr != null ? Number(r.compare_at_price_inr) : null,
    stockQuantity: Number(r.stock_quantity ?? 0),
    lowStockThreshold: Number(r.low_stock_threshold ?? 5),
    isDefaultVariant: Boolean(r.is_default_variant),
    calories: r.calories != null ? Number(r.calories) : null,
    proteinG: r.protein_g != null ? Number(r.protein_g) : null,
    carbohydratesG: r.carbohydrates_g != null ? Number(r.carbohydrates_g) : null,
    fatG: r.fat_g != null ? Number(r.fat_g) : null,
    fibreG: r.fibre_g != null ? Number(r.fibre_g) : null,
    sugarG: r.sugar_g != null ? Number(r.sugar_g) : null,
    sodiumMg: r.sodium_mg != null ? Number(r.sodium_mg) : null,
    servingSizeLabel: (r.serving_size_label as string) ?? null,
    servingSizeG: r.serving_size_g != null ? Number(r.serving_size_g) : null,
  };
}

function catalogueFromRow(
  r: Record<string, unknown>,
  groups: ProductGroup[],
  types: ProductType[],
  variants: CatalogueVariant[]
): CatalogueProduct {
  const grp = groups.find((g) => g.id === (r.product_group_id as string));
  const typ = types.find((t) => t.id === (r.product_type_id as string));
  return {
    id: r.id as string,
    productId: r.product_id as string,
    productName: r.product_name as string,
    slug: r.slug as string,
    brand: (r.brand as string) ?? "",
    productGroupId: (r.product_group_id as string) ?? null,
    productTypeId: (r.product_type_id as string) ?? null,
    productGroupName: grp?.name ?? "",
    productTypeName: typ?.name ?? "",
    goalTags: (r.goal_tags as string[]) ?? [],
    aimTags: (r.aim_tags as string[]) ?? [],
    searchTags: (r.search_tags as string[]) ?? [],
    shortDescription: (r.short_description as string) ?? "",
    fullDescription: (r.full_description as string) ?? "",
    usageInformation: (r.usage_information as string) ?? "",
    ingredients: (r.ingredients as string) ?? "",
    warningsAllergens: (r.warnings_allergens as string) ?? "",
    imageUrls: (r.image_urls as string[]) ?? [],
    servingSizeLabel: (r.serving_size_label as string) ?? "",
    servingSizeG: r.serving_size_g != null ? Number(r.serving_size_g) : null,
    calories: r.calories != null ? Number(r.calories) : null,
    proteinG: r.protein_g != null ? Number(r.protein_g) : null,
    carbohydratesG: r.carbohydrates_g != null ? Number(r.carbohydrates_g) : null,
    fatG: r.fat_g != null ? Number(r.fat_g) : null,
    fibreG: r.fibre_g != null ? Number(r.fibre_g) : null,
    sugarG: r.sugar_g != null ? Number(r.sugar_g) : null,
    sodiumMg: r.sodium_mg != null ? Number(r.sodium_mg) : null,
    productStatus: (r.product_status as string) ?? "active",
    sortOrder: Number(r.sort_order ?? 0),
    variants,
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
  };
}

// ════════════════════════════════════════════════════════════════════════
// Product Groups
// ════════════════════════════════════════════════════════════════════════

export async function fetchAllProductGroups(): Promise<ProductGroup[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("product_groups")
    .select("*")
    .order("sort_order", { ascending: true });
  if (error || !data) return [];
  return (data as Record<string, unknown>[]).map(groupFromRow);
}

export async function createProductGroup(
  name: string,
  iconKey = "Tag"
): Promise<{ data: ProductGroup | null; error: string | null }> {
  if (!supabase) return { data: null, error: "No database connection" };
  const slug = slugify(name);
  const { data, error } = await supabase
    .from("product_groups")
    .insert({ name: name.trim(), slug, icon_key: iconKey })
    .select()
    .single();
  if (error) return { data: null, error: error.message };
  return { data: groupFromRow(data as Record<string, unknown>), error: null };
}

export async function updateProductGroup(
  id: string,
  name: string,
  iconKey?: string
): Promise<{ data: ProductGroup | null; error: string | null }> {
  if (!supabase) return { data: null, error: "No database connection" };
  const slug = slugify(name);
  const { data, error } = await supabase
    .from("product_groups")
    .update({ name: name.trim(), slug, icon_key: iconKey, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();
  if (error) return { data: null, error: error.message };
  return { data: groupFromRow(data as Record<string, unknown>), error: null };
}

// ════════════════════════════════════════════════════════════════════════
// Product Types
// ════════════════════════════════════════════════════════════════════════

export async function fetchAllProductTypes(): Promise<ProductType[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("product_types")
    .select("*")
    .order("sort_order", { ascending: true });
  if (error || !data) return [];
  return (data as Record<string, unknown>[]).map(typeFromRow);
}

export async function createProductType(
  name: string,
  productGroupId: string | null
): Promise<{ data: ProductType | null; error: string | null }> {
  if (!supabase) return { data: null, error: "No database connection" };
  const slug = slugify(name);
  const { data, error } = await supabase
    .from("product_types")
    .insert({ name: name.trim(), slug, product_group_id: productGroupId })
    .select()
    .single();
  if (error) return { data: null, error: error.message };
  return { data: typeFromRow(data as Record<string, unknown>), error: null };
}

/**
 * Rename a product type. Cascade-updates all store_products.product_type
 * text column via the DB function.
 */
export async function updateProductType(
  id: string,
  name: string,
  productGroupId?: string | null
): Promise<{ data: ProductType | null; error: string | null }> {
  if (!supabase) return { data: null, error: "No database connection" };
  const slug = slugify(name);
  const updates: Record<string, unknown> = { name: name.trim(), slug, updated_at: new Date().toISOString() };
  if (productGroupId !== undefined) updates.product_group_id = productGroupId;
  const { data, error } = await supabase
    .from("product_types")
    .update(updates)
    .eq("id", id)
    .select()
    .single();
  if (error) return { data: null, error: error.message };
  // Cascade the text column on store_products for backward-compat
  await supabase
    .from("store_products")
    .update({ product_type: name.trim(), updated_at: new Date().toISOString() })
    .eq("product_type_id", id);
  return { data: typeFromRow(data as Record<string, unknown>), error: null };
}

// ════════════════════════════════════════════════════════════════════════
// Product Catalogue CRUD
// ════════════════════════════════════════════════════════════════════════

export async function fetchCatalogue(opts: {
  search?: string;
  productGroupId?: string;
  productTypeId?: string;
  limit?: number;
  offset?: number;
} = {}): Promise<{ products: CatalogueProduct[]; total: number }> {
  if (!supabase) return { products: [], total: 0 };

  const { search, productGroupId, productTypeId, limit = 25, offset = 0 } = opts;

  // Fetch groups and types for denormalization
  const [groups, types] = await Promise.all([fetchAllProductGroups(), fetchAllProductTypes()]);

  let query = supabase
    .from("product_catalogue")
    .select("*", { count: "exact" })
    .order("sort_order", { ascending: true })
    .order("product_name", { ascending: true });

  if (search?.trim()) {
    query = query.or(
      `product_name.ilike.%${search.trim()}%,brand.ilike.%${search.trim()}%`
    );
  }
  if (productGroupId) query = query.eq("product_group_id", productGroupId);
  if (productTypeId) query = query.eq("product_type_id", productTypeId);

  query = query.range(offset, offset + limit - 1);

  const { data, error, count } = await query;
  if (error || !data) return { products: [], total: 0 };

  // Fetch variants for this page
  const ids = (data as Record<string, unknown>[]).map((r) => r.id as string);
  let variantRows: Record<string, unknown>[] = [];
  if (ids.length > 0) {
    const { data: vd } = await supabase
      .from("product_catalogue_variants")
      .select("*")
      .in("catalogue_id", ids)
      .order("is_default_variant", { ascending: false });
    variantRows = (vd as Record<string, unknown>[]) ?? [];
  }

  const products = (data as Record<string, unknown>[]).map((row) => {
    const variants = variantRows
      .filter((v) => v.catalogue_id === row.id)
      .map(variantFromCatalogueRow);
    return catalogueFromRow(row, groups, types, variants);
  });

  return { products, total: count ?? 0 };
}

export async function fetchCatalogueProductById(id: string): Promise<CatalogueProduct | null> {
  if (!supabase) return null;
  const [groups, types] = await Promise.all([fetchAllProductGroups(), fetchAllProductTypes()]);
  const { data, error } = await supabase
    .from("product_catalogue")
    .select("*")
    .eq("id", id)
    .single();
  if (error || !data) return null;
  const { data: vd } = await supabase
    .from("product_catalogue_variants")
    .select("*")
    .eq("catalogue_id", id)
    .order("is_default_variant", { ascending: false });
  const variants = ((vd as Record<string, unknown>[]) ?? []).map(variantFromCatalogueRow);
  return catalogueFromRow(data as Record<string, unknown>, groups, types, variants);
}

export interface CatalogueProductPayload {
  product_id: string;
  product_name: string;
  slug: string;
  brand: string;
  product_group_id: string | null;
  product_type_id: string | null;
  goal_tags: string[];
  aim_tags: string[];
  search_tags: string[];
  short_description: string;
  full_description: string;
  usage_information: string;
  ingredients: string;
  warnings_allergens: string;
  image_urls: string[];
  serving_size_label: string;
  serving_size_g: number | null;
  calories: number | null;
  protein_g: number | null;
  carbohydrates_g: number | null;
  fat_g: number | null;
  fibre_g: number | null;
  sugar_g: number | null;
  sodium_mg: number | null;
  product_status: string;
  sort_order: number;
}

export async function updateCatalogueProduct(
  id: string,
  payload: Partial<CatalogueProductPayload>
): Promise<{ error: string | null }> {
  if (!supabase) return { error: "No database connection" };
  const { error } = await supabase
    .from("product_catalogue")
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq("id", id);
  return { error: error?.message ?? null };
}

// ── Bulk CSV Import ───────────────────────────────────────────────────────

export interface CatalogueImportRow {
  product_id: string;
  product_name: string;
  slug: string;
  brand: string;
  user_category: string;   // → resolves to product_group
  category: string;        // → resolves to product_type
  short_description?: string;
  full_description?: string;
  usage_information?: string;
  ingredients?: string;
  warnings_allergens?: string;
  goals?: string;
  aim?: string;
  search_tags?: string;
  primary_image_url?: string;
  image_url_2?: string;
  image_url_3?: string;
  image_url_4?: string;
  image_url_5?: string;
  serving_size_label?: string;
  serving_size_g?: string;
  calories?: string;
  protein_g?: string;
  carbohydrates_g?: string;
  fat_g?: string;
  fibre_g?: string;
  sugar_g?: string;
  sodium_mg?: string;
  product_status?: string;
  sort_order?: string;
  // variant fields
  variant_id?: string;
  sku?: string;
  variant_name?: string;
  size_weight?: string;
  flavour?: string;
  colour?: string;
  variant_status?: string;
  price_inr?: string;
  compare_at_price_inr?: string;
  stock_quantity?: string;
  low_stock_threshold?: string;
  is_default_variant?: string;
  variant_calories?: string;
  variant_protein_g?: string;
  variant_carbohydrates_g?: string;
  variant_fat_g?: string;
  variant_fibre_g?: string;
  variant_sugar_g?: string;
  variant_sodium_mg?: string;
  variant_serving_size_label?: string;
  variant_serving_size_g?: string;
}

const GOAL_MAP: Record<string, string> = {
  "weight gain":     "weight-gain",
  "weight loss":     "weight-loss",
  "muscle building": "muscle-building",
  "general fitness": "general-fitness",
};

function normalizeGoals(raw: string): string[] {
  return raw
    .split(/[,;|]+/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
    .map((s) => GOAL_MAP[s] ?? s);
}

function parseTags(raw: string): string[] {
  return raw
    .split(/[,;|]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function numOrNull(s: string | undefined): number | null {
  if (!s || !s.trim()) return null;
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
}

/**
 * Bulk-import CSV rows into product_catalogue + product_catalogue_variants.
 * Creates product_groups and product_types as needed.
 * Uses upsert so re-running is safe.
 */
export async function importCatalogueFromRows(
  rows: CatalogueImportRow[]
): Promise<{ imported: number; errors: string[] }> {
  if (!supabase) return { imported: 0, errors: ["No database connection"] };

  const errors: string[] = [];

  // ── 1. Collect distinct groups + types, upsert them ─────────────────
  const groupNames = new Set(rows.map((r) => r.user_category?.trim()).filter(Boolean));
  const typeNames  = new Set(rows.map((r) => r.category?.trim()).filter(Boolean));

  // Upsert groups
  const groupInserts = Array.from(groupNames).map((name) => ({
    name,
    slug: slugify(name),
    icon_key: "Tag",
  }));
  if (groupInserts.length > 0) {
    await supabase
      .from("product_groups")
      .upsert(groupInserts, { onConflict: "name", ignoreDuplicates: false });
  }

  // Upsert types
  const typeInserts = Array.from(typeNames).map((name) => ({
    name,
    slug: slugify(name),
  }));
  if (typeInserts.length > 0) {
    await supabase
      .from("product_types")
      .upsert(typeInserts, { onConflict: "name", ignoreDuplicates: false });
  }

  // Fetch fresh ID maps
  const [groups, types] = await Promise.all([fetchAllProductGroups(), fetchAllProductTypes()]);
  const groupMap = new Map(groups.map((g) => [g.name, g.id]));
  const typeMap  = new Map(types.map((t) => [t.name, t.id]));

  // ── 2. Group rows by product_id ───────────────────────────────────────
  const productMap = new Map<string, CatalogueImportRow[]>();
  for (const row of rows) {
    if (!row.product_id?.trim()) continue;
    if (!productMap.has(row.product_id)) productMap.set(row.product_id, []);
    productMap.get(row.product_id)!.push(row);
  }

  let imported = 0;

  for (const [productId, productRows] of productMap) {
    const first = productRows[0];
    const imageUrls = [
      first.primary_image_url,
      first.image_url_2,
      first.image_url_3,
      first.image_url_4,
      first.image_url_5,
    ].filter(Boolean) as string[];

    const productPayload = {
      product_id:       productId,
      product_name:     first.product_name?.trim() ?? "",
      slug:             first.slug?.trim() || slugify(first.product_name ?? productId),
      brand:            first.brand?.trim() ?? "",
      product_group_id: groupMap.get(first.user_category?.trim()) ?? null,
      product_type_id:  typeMap.get(first.category?.trim())       ?? null,
      goal_tags:        normalizeGoals(first.goals ?? ""),
      aim_tags:         parseTags(first.aim ?? ""),
      search_tags:      parseTags(first.search_tags ?? ""),
      short_description:  first.short_description?.trim()  ?? "",
      full_description:   first.full_description?.trim()   ?? "",
      usage_information:  first.usage_information?.trim()  ?? "",
      ingredients:        first.ingredients?.trim()        ?? "",
      warnings_allergens: first.warnings_allergens?.trim() ?? "",
      image_urls:         imageUrls,
      serving_size_label: first.serving_size_label?.trim() ?? "",
      serving_size_g:     numOrNull(first.serving_size_g),
      calories:           numOrNull(first.calories),
      protein_g:          numOrNull(first.protein_g),
      carbohydrates_g:    numOrNull(first.carbohydrates_g),
      fat_g:              numOrNull(first.fat_g),
      fibre_g:            numOrNull(first.fibre_g),
      sugar_g:            numOrNull(first.sugar_g),
      sodium_mg:          numOrNull(first.sodium_mg),
      product_status:     first.product_status?.trim() || "active",
      sort_order:         parseInt(first.sort_order ?? "0") || 0,
      updated_at:         new Date().toISOString(),
    };

    const { data: upserted, error: upsertErr } = await supabase
      .from("product_catalogue")
      .upsert(productPayload, { onConflict: "product_id" })
      .select("id")
      .single();

    if (upsertErr || !upserted) {
      errors.push(`Product ${productId}: ${upsertErr?.message ?? "upsert failed"}`);
      continue;
    }

    const catalogueDbId = (upserted as { id: string }).id;

    // ── 3. Upsert variants ──────────────────────────────────────────────
    const variantUpserts = productRows
      .filter((r) => r.variant_id?.trim())
      .map((r) => ({
        catalogue_id:        catalogueDbId,
        variant_id:          r.variant_id!.trim(),
        sku:                 r.sku?.trim() ?? "",
        variant_name:        r.variant_name?.trim() ?? "",
        size_weight:         r.size_weight?.trim() ?? "",
        flavour:             r.flavour?.trim() ?? "",
        colour:              r.colour?.trim() ?? "",
        variant_status:      r.variant_status?.trim() ?? "active",
        suggested_price_inr: numOrNull(r.price_inr),
        compare_at_price_inr: numOrNull(r.compare_at_price_inr),
        stock_quantity:      parseInt(r.stock_quantity ?? "0") || 0,
        low_stock_threshold: parseInt(r.low_stock_threshold ?? "5") || 5,
        is_default_variant:  r.is_default_variant?.toLowerCase() === "true",
        calories:            numOrNull(r.variant_calories),
        protein_g:           numOrNull(r.variant_protein_g),
        carbohydrates_g:     numOrNull(r.variant_carbohydrates_g),
        fat_g:               numOrNull(r.variant_fat_g),
        fibre_g:             numOrNull(r.variant_fibre_g),
        sugar_g:             numOrNull(r.variant_sugar_g),
        sodium_mg:           numOrNull(r.variant_sodium_mg),
        serving_size_label:  r.variant_serving_size_label?.trim() ?? null,
        serving_size_g:      numOrNull(r.variant_serving_size_g),
        updated_at:          new Date().toISOString(),
      }));

    if (variantUpserts.length > 0) {
      const { error: varErr } = await supabase
        .from("product_catalogue_variants")
        .upsert(variantUpserts, { onConflict: "catalogue_id,variant_id" });
      if (varErr) errors.push(`Variants for ${productId}: ${varErr.message}`);
    }

    imported++;
  }

  return { imported, errors };
}

// ── Helpers ───────────────────────────────────────────────────────────────

export function slugify(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Fetch distinct product_group and product_type values from the catalogue
 * for use in dropdowns/filters across the app.
 */
export async function fetchCatalogueClassification(): Promise<{
  groups: ProductGroup[];
  types: ProductType[];
}> {
  const [groups, types] = await Promise.all([
    fetchAllProductGroups(),
    fetchAllProductTypes(),
  ]);
  return { groups, types };
}
