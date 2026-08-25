// ════════════════════════════════════════════════════════════════════════
// BB Store — Product Catalog Types
//
// The catalog is a read-only template library. It is NOT the live store.
// Admin selects a catalog product → form prefills → admin saves → Supabase.
// After saving, the Supabase record is independent of this catalog.
// ════════════════════════════════════════════════════════════════════════

export interface CatalogVariant {
  variantId: string;
  sku: string;
  variantName: string;       // e.g. "1kg – Chocolate"
  sizeWeight: string;        // e.g. "1kg"
  flavour: string;
  colour: string;
  variantStatus: string;
  suggestedPriceINR: number | null;
  compareAtPriceINR: number | null;
  stockQuantity: number;
  lowStockThreshold: number;
  isDefaultVariant: boolean;
  // Variant-level nutrition (falls back to product-level when blank)
  calories: number | null;
  proteinG: number | null;
  carbohydratesG: number | null;
  fatG: number | null;
  fibreG: number | null;
  sugarG: number | null;
  sodiumMg: number | null;
  servingSizeLabel: string;
  servingSizeG: number | null;
}

/**
 * Subset of catalog data passed as query params from the Catalog page to
 * the new-product form. The form reads this and prefills its state.
 *
 * NOTE: aimTags is intentionally NOT included here. Aim is display-only
 * metadata shown in the catalog browser so the admin can understand a
 * product. It is never written to the database — only the 4 broad goalTags
 * (weight-gain, weight-loss, muscle-building, general-fitness) are stored
 * as health_goal_tags in Supabase.
 *
 * `type` vs `userCategory`:
 *   - `type`         = fine-grained product type (e.g. "Whey Protein",
 *                       "Creatine"). Comes from the catalog's `category`
 *                       CSV column. Stored as `product_type` on the store
 *                       product — a further filtration option, not the
 *                       customer-facing category.
 *   - `userCategory` = broad category the customer actually browses
 *                       (e.g. "Protein", "Vitamins"). Comes from the
 *                       catalog's `user_category` CSV column and is matched
 *                       to a `store_categories` row → `category_id`.
 */
export interface CatalogPrefill {
  catalogId: string;
  name: string;
  brand: string;
  /** Broad customer-facing category (matches store_categories.name) */
  userCategory: string;
  /** Fine-grained product type (e.g. "Whey Protein") — further filtration */
  type: string;
  slug: string;
  shortDescription: string;
  fullDescription: string;
  usageInfo: string;
  ingredients: string;
  warnings: string;
  images: string[];
  goalTags: string[];         // broad segments → stored as health_goal_tags
  searchTags: string[];
  servingSizeLabel: string;
  servingSizeG: number | null;
  calories: number | null;
  proteinG: number | null;
  carbohydratesG: number | null;
  fatG: number | null;
  fibreG: number | null;
  sugarG: number | null;
  sodiumMg: number | null;
  variants: CatalogVariant[];
  selectedVariantId?: string; // which variant the admin had selected
}

export interface CatalogProduct {
  // Identifiers
  productId: string;          // e.g. "CAT-0001"
  productName: string;
  slug: string;
  brand: string;

  // Category / Type — kept strictly separate (see CatalogPrefill note above)
  /** Broad customer-facing category, e.g. "Protein" (from `user_category` CSV column) */
  userCategory: string;
  /** Fine-grained product type, e.g. "Whey Protein" (from `category` CSV column) */
  type: string;

  // Content
  shortDescription: string;
  fullDescription: string;
  productStatus: string;
  sortOrder: number;

  // Goals & Aim — kept strictly separate
  goalTags: string[];   // BROAD segments: ["weight-gain", "muscle-building", ...]
                        // Used for the Goals filter dropdown in admin catalog.
                        // Stored as health_goal_tags in Supabase when added to store.
  aimTags: string[];    // DETAILED purposes: ["Muscle Recovery", "Lean Muscle", ...]
                        // Display-only in the catalog browser. Never stored or filtered on.
  searchTags: string[];

  // Images
  primaryImageUrl: string;
  imageUrls: string[];

  // Nutrition (per serving — product-level; variant fields may differ)
  servingSizeLabel: string;
  servingSizeG: number | null;
  calories: number | null;
  proteinG: number | null;
  carbohydratesG: number | null;
  fatG: number | null;
  fibreG: number | null;
  sugarG: number | null;
  sodiumMg: number | null;

  // Health content
  usageInformation: string;
  ingredients: string;
  warningsAllergens: string;

  // Variants
  variants: CatalogVariant[];
}
