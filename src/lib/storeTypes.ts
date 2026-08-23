// ════════════════════════════════════════════════════════════════════════
// BB Store — Phase 2 Types
// All product/category/variant types that map directly to store_schema.sql
// ════════════════════════════════════════════════════════════════════════

// ── Availability / publishing ─────────────────────────────────────────────

export type ProductAvailability = "active" | "inactive" | "out_of_stock" | "discontinued";

// ── Categories ────────────────────────────────────────────────────────────

export interface StoreCategory {
  id: string;
  parentId: string | null;
  slug: string;
  name: string;
  description: string;
  iconKey: string;       // lucide-react icon key
  imageUrl: string | null;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  // Populated client-side when fetching with subcategories
  subcategories?: StoreCategory[];
}

// ── Brands ────────────────────────────────────────────────────────────────

export interface StoreBrand {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  websiteUrl: string | null;
  isActive: boolean;
  createdAt: string;
}

// ── Health / Nutrition metadata (per serving) ─────────────────────────────

export interface NutritionInfo {
  servingSizeLabel: string;   // e.g. "1 scoop (30g)"
  servingSizeG: number | null;
  caloriesPerServing: number | null;
  proteinPerServing: number | null;   // grams
  carbsPerServing: number | null;
  fatPerServing: number | null;
  fibrePerServing: number | null;
  sodiumPerServing: number | null;    // milligrams
  sugarPerServing: number | null;
}

// ── Product Variant ───────────────────────────────────────────────────────

export interface StoreProductVariant {
  id: string;
  productId: string;
  sku: string;
  name: string;           // e.g. "1kg – Chocolate"
  sizeLabel: string;      // e.g. "1kg", "500g", "60 caps"
  flavour: string;        // e.g. "Chocolate Fudge", "" for unflavoured
  color: string;
  pricePaise: number;         // selling price in paise (÷100 = ₹)
  comparePricePaise: number | null;  // strikethrough price; null = no sale
  stockQuantity: number;
  lowStockThreshold: number;
  images: string[];
  availability: ProductAvailability;
  isDefault: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

// ── Product ───────────────────────────────────────────────────────────────

export interface StoreProduct {
  id: string;
  name: string;
  slug: string;
  brandId: string | null;
  categoryId: string | null;

  shortDescription: string;
  fullDescription: string;     // markdown
  usageInfo: string;
  ingredients: string;
  warnings: string;

  images: string[];            // first = primary

  tags: string[];
  healthGoalTags: string[];    // e.g. ["muscle-gain","weight-loss"]

  nutrition: NutritionInfo;

  published: boolean;
  availability: ProductAvailability;

  ratingAverage: number;
  ratingCount: number;

  sortOrder: number;
  isFeatured: boolean;

  createdAt: string;
  updatedAt: string;

  // Populated by joins when fetching
  brand?: StoreBrand;
  category?: StoreCategory;
  variants?: StoreProductVariant[];
}

// ── Convenience helpers ───────────────────────────────────────────────────

/** Price in rupees (2 decimal places string) */
export function formatPriceINR(paise: number): string {
  return "₹" + (paise / 100).toLocaleString("en-IN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

/** Discount percentage between selling and compare price */
export function discountPercent(
  pricePaise: number,
  comparePricePaise: number | null
): number {
  if (!comparePricePaise || comparePricePaise <= pricePaise) return 0;
  return Math.round(((comparePricePaise - pricePaise) / comparePricePaise) * 100);
}

/** The variant with isDefault=true, or the first one */
export function defaultVariant(
  variants: StoreProductVariant[]
): StoreProductVariant | null {
  if (!variants.length) return null;
  return variants.find((v) => v.isDefault) ?? variants[0];
}

/** Whether a product is visible and purchasable by customers */
export function isProductAvailable(product: StoreProduct): boolean {
  return (
    product.published &&
    product.availability === "active"
  );
}

/** Whether a specific variant can be added to the cart */
export function isVariantPurchasable(variant: StoreProductVariant): boolean {
  return variant.availability === "active";
}

/** Stock label for display */
export function stockLabel(variant: StoreProductVariant): string | null {
  if (variant.availability === "out_of_stock") return "Out of stock";
  if (variant.availability === "discontinued") return "Discontinued";
  if (variant.stockQuantity <= 0) return "Out of stock";
  if (variant.stockQuantity <= variant.lowStockThreshold)
    return `Only ${variant.stockQuantity} left`;
  return null;
}

// ── DB row → app model mappers ────────────────────────────────────────────

export interface CategoryRow {
  id: string;
  parent_id: string | null;
  slug: string;
  name: string;
  description: string;
  icon_key: string;
  image_url: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export function categoryFromRow(r: CategoryRow): StoreCategory {
  return {
    id: r.id,
    parentId: r.parent_id,
    slug: r.slug,
    name: r.name,
    description: r.description,
    iconKey: r.icon_key,
    imageUrl: r.image_url,
    sortOrder: r.sort_order,
    isActive: r.is_active,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export interface BrandRow {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  website_url: string | null;
  is_active: boolean;
  created_at: string;
}

export function brandFromRow(r: BrandRow): StoreBrand {
  return {
    id: r.id,
    name: r.name,
    slug: r.slug,
    logoUrl: r.logo_url,
    websiteUrl: r.website_url,
    isActive: r.is_active,
    createdAt: r.created_at,
  };
}

export interface ProductRow {
  id: string;
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
  availability: ProductAvailability;
  rating_average: number;
  rating_count: number;
  sort_order: number;
  is_featured: boolean;
  created_at: string;
  updated_at: string;
}

export function productFromRow(r: ProductRow): StoreProduct {
  return {
    id: r.id,
    name: r.name,
    slug: r.slug,
    brandId: r.brand_id,
    categoryId: r.category_id,
    shortDescription: r.short_description,
    fullDescription: r.full_description,
    usageInfo: r.usage_info,
    ingredients: r.ingredients,
    warnings: r.warnings,
    images: r.images ?? [],
    tags: r.tags ?? [],
    healthGoalTags: r.health_goal_tags ?? [],
    nutrition: {
      servingSizeLabel: r.serving_size_label,
      servingSizeG: r.serving_size_g != null ? Number(r.serving_size_g) : null,
      caloriesPerServing: r.calories_per_serving != null ? Number(r.calories_per_serving) : null,
      proteinPerServing: r.protein_per_serving != null ? Number(r.protein_per_serving) : null,
      carbsPerServing: r.carbs_per_serving != null ? Number(r.carbs_per_serving) : null,
      fatPerServing: r.fat_per_serving != null ? Number(r.fat_per_serving) : null,
      fibrePerServing: r.fibre_per_serving != null ? Number(r.fibre_per_serving) : null,
      sodiumPerServing: r.sodium_per_serving != null ? Number(r.sodium_per_serving) : null,
      sugarPerServing: r.sugar_per_serving != null ? Number(r.sugar_per_serving) : null,
    },
    published: r.published,
    availability: r.availability,
    ratingAverage: Number(r.rating_average),
    ratingCount: r.rating_count,
    sortOrder: r.sort_order,
    isFeatured: r.is_featured,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export interface VariantRow {
  id: string;
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
  availability: ProductAvailability;
  is_default: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export function variantFromRow(r: VariantRow): StoreProductVariant {
  return {
    id: r.id,
    productId: r.product_id,
    sku: r.sku,
    name: r.name,
    sizeLabel: r.size_label,
    flavour: r.flavour,
    color: r.color,
    pricePaise: Number(r.price_paise),
    comparePricePaise: r.compare_price_paise != null ? Number(r.compare_price_paise) : null,
    stockQuantity: r.stock_quantity,
    lowStockThreshold: r.low_stock_threshold,
    images: r.images ?? [],
    availability: r.availability,
    isDefault: r.is_default,
    sortOrder: r.sort_order,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}
