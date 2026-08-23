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
}

/**
 * Subset of catalog data passed as query params from the Catalog page to
 * the new-product form. The form reads this and prefills its state —
 * nothing is written to the CSV.
 */
export interface CatalogPrefill {
  catalogId: string;
  name: string;
  brand: string;
  category: string;
  slug: string;
  shortDescription: string;
  fullDescription: string;
  usageInfo: string;
  ingredients: string;
  warnings: string;
  images: string[];
  goalTags: string[];
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
}

export interface CatalogProduct {
  // Identifiers
  productId: string;          // e.g. "CAT-0001"
  productName: string;
  slug: string;
  brand: string;
  category: string;

  // Content
  shortDescription: string;
  fullDescription: string;
  productStatus: string;      // "active" | "inactive" etc. — catalog-level hint
  sortOrder: number;
  goalTags: string[];         // ["weight-gain", "muscle-building", ...]
  searchTags: string[];

  // Images
  primaryImageUrl: string;
  imageUrls: string[];        // all images including primary

  // Nutrition (per serving)
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

  // Variants (one catalog product can have multiple variants)
  variants: CatalogVariant[];
}
