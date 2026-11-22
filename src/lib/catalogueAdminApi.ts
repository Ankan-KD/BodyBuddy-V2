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

export interface CatalogueImportResult {
  /** Products saved (inserted or updated). */
  imported: number;
  /** Variants saved (inserted or updated). */
  variants: number;
  /** Things that failed and were NOT saved. */
  errors: string[];
  /** Things that were skipped or auto-handled; the rest of the file still imported. */
  warnings: string[];
}

/** (done, total, what's happening) — lets the UI show a progress bar. */
export type CatalogueImportProgress = (done: number, total: number, stage: string) => void;

/** Columns a catalogue CSV must have. Everything else is optional. */
const CATALOGUE_REQUIRED_COLUMNS = ["product_id", "product_name"];

/**
 * Checks a catalogue CSV's header row *before* anything touches the
 * database. Returns a message to show the admin, or null if it looks right.
 * `headers` should already be trimmed/lower-cased (parseCsvObjects does that).
 */
export function validateCatalogueHeaders(headers: string[]): string | null {
  const missing = CATALOGUE_REQUIRED_COLUMNS.filter((c) => !headers.includes(c));
  if (missing.length === 0) return null;
  return (
    `This doesn't look like a catalogue CSV — missing column${missing.length > 1 ? "s" : ""}: ` +
    `${missing.join(", ")}. Use the same columns as src/data/product_catalog.csv.`
  );
}

// How many rows go to the database per request. Products carry long text and
// image URLs, so they get a smaller batch than variants.
const PRODUCT_CHUNK = 50;
const VARIANT_CHUNK = 200;

function isTrue(v: string | undefined): boolean {
  return ["true", "1", "yes"].includes((v ?? "").trim().toLowerCase());
}

/** Reads `table` as a name → id map. Returns the error message on failure. */
async function fetchNameIdMap(
  table: "product_groups" | "product_types"
): Promise<{ map: Map<string, string>; error: string | null }> {
  const map = new Map<string, string>();
  if (!supabase) return { map, error: "No database connection" };
  const { data, error } = await supabase.from(table).select("id, name");
  if (error) return { map, error: error.message };
  for (const r of (data ?? []) as { id: string; name: string }[]) map.set(r.name, r.id);
  return { map, error: null };
}

/**
 * Bulk-imports CSV rows into product_catalogue + product_catalogue_variants.
 *
 * The CSV is the source of truth: running this again with an edited file
 * updates existing products (matched on product_id) and variants (matched on
 * product + variant_id) and adds new ones, so re-importing is always safe.
 * It never deletes anything — a product removed from the CSV stays in the
 * database until an admin removes it.
 *
 * Product groups / types named in the CSV are created if missing, but
 * existing ones are left exactly as they are (so icons and ordering an admin
 * set on /admin/categories survive a re-import).
 *
 * Rows are sent in batches (a few hundred requests became ~10), and if a
 * batch is rejected it is retried row-by-row so one bad product can't block
 * the rest — each failure is reported by product_id.
 */
export async function importCatalogueFromRows(
  rows: CatalogueImportRow[],
  onProgress?: CatalogueImportProgress
): Promise<CatalogueImportResult> {
  const result: CatalogueImportResult = { imported: 0, variants: 0, errors: [], warnings: [] };
  if (!supabase) {
    result.errors.push("No database connection");
    return result;
  }

  // ── 1. Group rows by product_id (file order preserved) ───────────────
  const productMap = new Map<string, CatalogueImportRow[]>();
  let skippedNoId = 0;
  for (const row of rows) {
    const pid = row.product_id?.trim();
    if (!pid) {
      skippedNoId++;
      continue;
    }
    const list = productMap.get(pid);
    if (list) list.push(row);
    else productMap.set(pid, [row]);
  }
  if (skippedNoId > 0) {
    result.warnings.push(`${skippedNoId} row(s) had no product_id and were skipped.`);
  }
  if (productMap.size === 0) {
    result.errors.push("No rows with a product_id were found — nothing to import.");
    return result;
  }

  // ── 2. Make sure the groups / types exist (never overwrite existing) ──
  // ON CONFLICT DO NOTHING: a re-import must not reset an admin's icon/slug.
  const groupNames = new Set<string>();
  const typeNames = new Set<string>();
  for (const [, productRows] of productMap) {
    const first = productRows[0];
    const g = first.user_category?.trim();
    const t = first.category?.trim();
    if (g) groupNames.add(g);
    if (t) typeNames.add(t);
  }

  if (groupNames.size > 0) {
    const { error } = await supabase
      .from("product_groups")
      .upsert(
        Array.from(groupNames).map((name) => ({ name, slug: slugify(name), icon_key: "Tag" })),
        { onConflict: "name", ignoreDuplicates: true }
      );
    if (error) {
      result.errors.push(`Could not save product groups: ${error.message}`);
      return result;
    }
  }
  if (typeNames.size > 0) {
    const { error } = await supabase
      .from("product_types")
      .upsert(
        Array.from(typeNames).map((name) => ({ name, slug: slugify(name) })),
        { onConflict: "name", ignoreDuplicates: true }
      );
    if (error) {
      result.errors.push(`Could not save product types: ${error.message}`);
      return result;
    }
  }

  const [groups, types] = await Promise.all([
    fetchNameIdMap("product_groups"),
    fetchNameIdMap("product_types"),
  ]);
  if (groups.error || types.error) {
    result.errors.push(`Could not read groups/types: ${groups.error ?? types.error}`);
    return result;
  }

  // ── 3. Build one payload per product ──────────────────────────────────
  interface Entry {
    pid: string;
    payload: Record<string, unknown>;
    rows: CatalogueImportRow[];
  }
  const entries: Entry[] = [];
  const slugOwner = new Map<string, string>();

  for (const [pid, productRows] of productMap) {
    const first = productRows[0];
    const name = first.product_name?.trim() ?? "";
    if (!name) {
      result.errors.push(`Product ${pid}: product_name is empty — skipped.`);
      continue;
    }

    const slug = first.slug?.trim() || slugify(name);
    const owner = slugOwner.get(slug);
    if (owner) {
      result.errors.push(`Product ${pid}: slug "${slug}" is already used by ${owner} in this file — skipped.`);
      continue;
    }
    slugOwner.set(slug, pid);

    const imageUrls = [
      first.primary_image_url,
      first.image_url_2,
      first.image_url_3,
      first.image_url_4,
      first.image_url_5,
    ]
      .map((u) => u?.trim())
      .filter(Boolean) as string[];

    entries.push({
      pid,
      rows: productRows,
      payload: {
        product_id:       pid,
        product_name:     name,
        slug,
        brand:            first.brand?.trim() ?? "",
        product_group_id: groups.map.get(first.user_category?.trim() ?? "") ?? null,
        product_type_id:  types.map.get(first.category?.trim() ?? "")       ?? null,
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
      },
    });
  }

  // ── 4. Upsert products in batches ─────────────────────────────────────
  const idByPid = new Map<string, string>();
  let done = 0;
  onProgress?.(0, entries.length, "Saving products");

  for (let i = 0; i < entries.length; i += PRODUCT_CHUNK) {
    const chunk = entries.slice(i, i + PRODUCT_CHUNK);
    const { data, error } = await supabase
      .from("product_catalogue")
      .upsert(chunk.map((c) => c.payload), { onConflict: "product_id" })
      .select("id, product_id");

    if (!error && data) {
      for (const r of data as { id: string; product_id: string }[]) idByPid.set(r.product_id, r.id);
    } else {
      // Batch rejected — find out which product(s) are to blame.
      for (const c of chunk) {
        const { data: one, error: oneErr } = await supabase
          .from("product_catalogue")
          .upsert(c.payload, { onConflict: "product_id" })
          .select("id, product_id")
          .single();
        if (oneErr || !one) result.errors.push(`Product ${c.pid}: ${oneErr?.message ?? "save failed"}`);
        else idByPid.set(c.pid, (one as { id: string }).id);
      }
    }
    done += chunk.length;
    onProgress?.(done, entries.length, "Saving products");
  }
  result.imported = idByPid.size;

  // ── 5. Upsert variants in batches ─────────────────────────────────────
  interface VariantEntry {
    pid: string;
    vid: string;
    payload: Record<string, unknown>;
  }
  const variantEntries: VariantEntry[] = [];
  const seenVariant = new Set<string>();

  for (const c of entries) {
    const catalogueId = idByPid.get(c.pid);
    if (!catalogueId) continue; // the product itself failed; already reported

    for (const r of c.rows) {
      const vid = r.variant_id?.trim();
      if (!vid) continue;

      // The same (product, variant_id) twice in one batch makes Postgres
      // reject the whole statement, so keep the first and say so.
      const key = `${catalogueId}|${vid}`;
      if (seenVariant.has(key)) {
        result.warnings.push(`Product ${c.pid}: variant_id "${vid}" appears more than once — only the first row was used.`);
        continue;
      }
      seenVariant.add(key);

      variantEntries.push({
        pid: c.pid,
        vid,
        payload: {
          catalogue_id:         catalogueId,
          variant_id:           vid,
          sku:                  r.sku?.trim() ?? "",
          variant_name:         r.variant_name?.trim() ?? "",
          size_weight:          r.size_weight?.trim() ?? "",
          flavour:              r.flavour?.trim() ?? "",
          colour:               r.colour?.trim() ?? "",
          variant_status:       r.variant_status?.trim() || "active",
          suggested_price_inr:  numOrNull(r.price_inr),
          compare_at_price_inr: numOrNull(r.compare_at_price_inr),
          stock_quantity:       parseInt(r.stock_quantity ?? "0") || 0,
          low_stock_threshold:  parseInt(r.low_stock_threshold ?? "5") || 5,
          is_default_variant:   isTrue(r.is_default_variant),
          calories:             numOrNull(r.variant_calories),
          protein_g:            numOrNull(r.variant_protein_g),
          carbohydrates_g:      numOrNull(r.variant_carbohydrates_g),
          fat_g:                numOrNull(r.variant_fat_g),
          fibre_g:              numOrNull(r.variant_fibre_g),
          sugar_g:              numOrNull(r.variant_sugar_g),
          sodium_mg:            numOrNull(r.variant_sodium_mg),
          serving_size_label:   r.variant_serving_size_label?.trim() ?? null,
          serving_size_g:       numOrNull(r.variant_serving_size_g),
          updated_at:           new Date().toISOString(),
        },
      });
    }
  }

  done = 0;
  onProgress?.(0, variantEntries.length, "Saving variants");

  for (let i = 0; i < variantEntries.length; i += VARIANT_CHUNK) {
    const chunk = variantEntries.slice(i, i + VARIANT_CHUNK);
    const { error } = await supabase
      .from("product_catalogue_variants")
      .upsert(chunk.map((c) => c.payload), { onConflict: "catalogue_id,variant_id" });

    if (!error) {
      result.variants += chunk.length;
    } else {
      for (const c of chunk) {
        const { error: oneErr } = await supabase
          .from("product_catalogue_variants")
          .upsert(c.payload, { onConflict: "catalogue_id,variant_id" });
        if (oneErr) result.errors.push(`Variant ${c.vid} of ${c.pid}: ${oneErr.message}`);
        else result.variants++;
      }
    }
    done += chunk.length;
    onProgress?.(done, variantEntries.length, "Saving variants");
  }

  return result;
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
