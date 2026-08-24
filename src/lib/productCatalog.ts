// ════════════════════════════════════════════════════════════════════════
// BB Store — Product Catalog
//
// Loads the static product catalog from src/data/product_catalog.csv
// (bundled at build time via Next.js import). This is a read-only template
// library — it is NEVER written to at runtime. It is not the live store.
//
// Flow:
//   CSV (catalog)  →  Admin selects  →  ProductForm prefills  →  Supabase
//
// After the admin saves a product to Supabase, that database record becomes
// the source of truth and is fully independent of this catalog.
// ════════════════════════════════════════════════════════════════════════

import type { CatalogProduct, CatalogVariant } from "./catalogTypes";

// ── CSV row shape (mirrors product_catalog.csv columns exactly) ───────────

interface CatalogRow {
  product_id: string;
  product_name: string;
  slug: string;
  brand: string;
  category: string;
  short_description: string;
  full_description: string;
  product_status: string;
  sort_order: string;
  goals: string;          // broad: "Muscle Building, Weight Loss"
  aim: string;            // detailed: "Muscle Recovery, Lean Muscle, Protein Support"
  goal_tags: string;      // legacy/duplicate column — ignored; we use goals + aim
  search_tags: string;
  primary_image_url: string;
  image_url_2: string;
  image_url_3: string;
  image_url_4: string;
  image_url_5: string;
  serving_size_label: string;
  serving_size_g: string;
  calories: string;
  protein_g: string;
  carbohydrates_g: string;
  fat_g: string;
  fibre_g: string;
  sugar_g: string;
  sodium_mg: string;
  usage_information: string;
  ingredients: string;
  warnings_allergens: string;
  variant_id: string;
  sku: string;
  variant_name: string;
  size_weight: string;
  flavour: string;
  colour: string;
  variant_status: string;
  price_inr: string;
  compare_at_price_inr: string;
  stock_quantity: string;
  low_stock_threshold: string;
  is_default_variant: string;
  // variant-level nutrition columns (may be blank → falls back to product-level)
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

// ── Goal normalisation ────────────────────────────────────────────────────

/** Maps human-readable goal strings to canonical slug keys used by the filter. */
const GOAL_SLUG_MAP: Record<string, string> = {
  "weight gain":     "weight-gain",
  "weight loss":     "weight-loss",
  "muscle building": "muscle-building",
  "general fitness": "general-fitness",
};

/**
 * Parse a "goals" or "aim" cell that may contain comma-separated values.
 * Returns an array of trimmed non-empty strings.
 */
function parseTags(s: string): string[] {
  if (!s?.trim()) return [];
  return s
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}

/**
 * Parse the broad Goals cell — normalises to lowercase-hyphen slugs so the
 * filter dropdown can match them reliably regardless of how they are written
 * in the CSV ("Muscle Building", "muscle-building", "muscle building" all
 * normalise to "muscle-building").
 */
function parseGoalSlugs(s: string): string[] {
  return parseTags(s).map((tag) => {
    const lower = tag.toLowerCase().trim();
    return GOAL_SLUG_MAP[lower] ?? lower.replace(/\s+/g, "-");
  });
}

// ── Numeric helpers ───────────────────────────────────────────────────────

function parseNum(s: string): number | null {
  if (!s?.trim()) return null;
  const n = parseFloat(s.trim());
  return isNaN(n) ? null : n;
}

function parseIntSafe(s: string, fallback = 0): number {
  if (!s?.trim()) return fallback;
  const n = parseInt(s.trim(), 10);
  return isNaN(n) ? fallback : n;
}

function parseBool(s: string): boolean {
  return s?.trim().toLowerCase() === "true" || s?.trim() === "1";
}

// ── Minimal CSV parser ────────────────────────────────────────────────────

/** Handles quoted fields with embedded commas/newlines. */
function parseCSV(text: string): CatalogRow[] {
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  if (lines.length < 2) return [];

  const headers = splitCSVLine(lines[0]);
  const rows: CatalogRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const cells = splitCSVLine(line);
    const obj: Record<string, string> = {};
    headers.forEach((h, idx) => {
      obj[h.trim()] = cells[idx] ?? "";
    });
    rows.push(obj as unknown as CatalogRow);
  }

  return rows;
}

function splitCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

// ── Build CatalogProduct[] from rows ─────────────────────────────────────

function buildCatalog(rows: CatalogRow[]): CatalogProduct[] {
  const map = new Map<string, CatalogProduct>();

  for (const row of rows) {
    const pid = row.product_id?.trim();
    if (!pid) continue;

    // Product-level nutrition (used as fallback for all variants)
    const prodCalories       = parseNum(row.calories);
    const prodProteinG       = parseNum(row.protein_g);
    const prodCarbsG         = parseNum(row.carbohydrates_g);
    const prodFatG           = parseNum(row.fat_g);
    const prodFibreG         = parseNum(row.fibre_g);
    const prodSugarG         = parseNum(row.sugar_g);
    const prodSodiumMg       = parseNum(row.sodium_mg);
    const prodServLabel      = row.serving_size_label?.trim() ?? "";
    const prodServG          = parseNum(row.serving_size_g);

    if (!map.has(pid)) {
      const allImages = [
        row.primary_image_url,
        row.image_url_2,
        row.image_url_3,
        row.image_url_4,
        row.image_url_5,
      ]
        .map((u) => u?.trim())
        .filter(Boolean) as string[];

      // Parse goals (broad segments) from the 'goals' column
      const goalSlugs = parseGoalSlugs(row.goals);

      // Parse aim (detailed purposes) from the 'aim' column
      const aimTags = parseTags(row.aim);

      // Parse search tags — use search_tags column if present, otherwise aim
      const searchTagsRaw = row.search_tags?.trim()
        ? parseTags(row.search_tags)
        : aimTags;

      map.set(pid, {
        productId: pid,
        productName: row.product_name?.trim() ?? "",
        slug: row.slug?.trim() ?? "",
        brand: row.brand?.trim() ?? "",
        category: row.category?.trim() ?? "",
        shortDescription: row.short_description?.trim() ?? "",
        fullDescription: row.full_description?.trim() ?? "",
        productStatus: row.product_status?.trim() ?? "active",
        sortOrder: parseIntSafe(row.sort_order, 0),
        goalTags: goalSlugs,
        aimTags,
        searchTags: searchTagsRaw,
        primaryImageUrl: row.primary_image_url?.trim() ?? "",
        imageUrls: allImages,
        servingSizeLabel: prodServLabel,
        servingSizeG: prodServG,
        calories: prodCalories,
        proteinG: prodProteinG,
        carbohydratesG: prodCarbsG,
        fatG: prodFatG,
        fibreG: prodFibreG,
        sugarG: prodSugarG,
        sodiumMg: prodSodiumMg,
        usageInformation: row.usage_information?.trim() ?? "",
        ingredients: row.ingredients?.trim() ?? "",
        warningsAllergens: row.warnings_allergens?.trim() ?? "",
        variants: [],
      });
    }

    // Add variant if present
    const vid = row.variant_id?.trim();
    if (vid) {
      // Variant-level nutrition: if variant-specific columns exist and are
      // populated, use them; otherwise fall back to product-level values.
      const variantCalories  = parseNum(row.variant_calories ?? "") ?? prodCalories;
      const variantProteinG  = parseNum(row.variant_protein_g ?? "") ?? prodProteinG;
      const variantCarbsG    = parseNum(row.variant_carbohydrates_g ?? "") ?? prodCarbsG;
      const variantFatG      = parseNum(row.variant_fat_g ?? "") ?? prodFatG;
      const variantFibreG    = parseNum(row.variant_fibre_g ?? "") ?? prodFibreG;
      const variantSugarG    = parseNum(row.variant_sugar_g ?? "") ?? prodSugarG;
      const variantSodiumMg  = parseNum(row.variant_sodium_mg ?? "") ?? prodSodiumMg;
      const variantServLabel = row.variant_serving_size_label?.trim() || prodServLabel;
      const variantServG     = parseNum(row.variant_serving_size_g ?? "") ?? prodServG;

      const variant: CatalogVariant = {
        variantId: vid,
        sku: row.sku?.trim() ?? "",
        variantName: row.variant_name?.trim() ?? "",
        sizeWeight: row.size_weight?.trim() ?? "",
        flavour: row.flavour?.trim() ?? "",
        colour: row.colour?.trim() ?? "",
        variantStatus: row.variant_status?.trim() ?? "active",
        suggestedPriceINR: parseNum(row.price_inr),
        compareAtPriceINR: parseNum(row.compare_at_price_inr),
        stockQuantity: parseIntSafe(row.stock_quantity, 0),
        lowStockThreshold: parseIntSafe(row.low_stock_threshold, 5),
        isDefaultVariant: parseBool(row.is_default_variant),
        calories: variantCalories,
        proteinG: variantProteinG,
        carbohydratesG: variantCarbsG,
        fatG: variantFatG,
        fibreG: variantFibreG,
        sugarG: variantSugarG,
        sodiumMg: variantSodiumMg,
        servingSizeLabel: variantServLabel,
        servingSizeG: variantServG,
      };
      map.get(pid)!.variants.push(variant);
    }
  }

  return Array.from(map.values()).sort((a, b) => a.sortOrder - b.sortOrder);
}

// ── Module-level cache (singleton per server process / client bundle) ─────

let _catalog: CatalogProduct[] | null = null;

/**
 * Returns the full catalog. Parses the bundled CSV exactly once per
 * runtime context, then caches the result in memory.
 */
export async function getProductCatalog(): Promise<CatalogProduct[]> {
  if (_catalog) return _catalog;

  const raw = await import("../data/product_catalog.csv?raw")
    .then((m) => m.default as string)
    .catch(() => null);

  if (!raw) {
    _catalog = [];
    return _catalog;
  }

  const rows = parseCSV(raw);
  _catalog = buildCatalog(rows);
  return _catalog;
}

/**
 * Get the unique categories present in the catalog.
 */
export async function getCatalogCategories(): Promise<string[]> {
  const catalog = await getProductCatalog();
  const set = new Set(catalog.map((p) => p.category).filter(Boolean));
  return Array.from(set).sort();
}

/**
 * Search/filter the catalog. All filters are optional.
 * goalTag should be a slug like "muscle-building".
 */
export async function searchCatalog(opts: {
  search?: string;
  category?: string;
  goalTag?: string;
}): Promise<CatalogProduct[]> {
  const catalog = await getProductCatalog();
  const { search, category, goalTag } = opts;

  return catalog.filter((p) => {
    if (
      search?.trim() &&
      !p.productName.toLowerCase().includes(search.toLowerCase()) &&
      !p.brand.toLowerCase().includes(search.toLowerCase()) &&
      !p.searchTags.some((t) =>
        t.toLowerCase().includes(search.toLowerCase())
      ) &&
      !p.aimTags.some((t) =>
        t.toLowerCase().includes(search.toLowerCase())
      )
    ) {
      return false;
    }
    if (category && p.category !== category) return false;
    if (goalTag && !p.goalTags.includes(goalTag)) return false;
    return true;
  });
}