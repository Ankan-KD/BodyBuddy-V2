// ════════════════════════════════════════════════════════════════════════
// BB Store — Phase 9: Offer Types
// ════════════════════════════════════════════════════════════════════════

export type DiscountType = "percentage" | "fixed_paise";

export interface StoreOffer {
  id: string;
  title: string;
  code: string | null;
  description: string;
  discountType: DiscountType;
  discountValue: number;          // % or paise
  isActive: boolean;
  startsAt: string | null;
  endsAt: string | null;
  productIds: string[];           // empty = sitewide
  minOrderPaise: number | null;
  maxUses: number | null;
  usedCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface OfferRow {
  id: string;
  title: string;
  code: string | null;
  description: string;
  discount_type: DiscountType;
  discount_value: number;
  is_active: boolean;
  starts_at: string | null;
  ends_at: string | null;
  product_ids: string[];
  min_order_paise: number | null;
  max_uses: number | null;
  used_count: number;
  created_at: string;
  updated_at: string;
}

export function offerFromRow(r: OfferRow): StoreOffer {
  return {
    id: r.id,
    title: r.title,
    code: r.code,
    description: r.description,
    discountType: r.discount_type,
    discountValue: Number(r.discount_value),
    isActive: r.is_active,
    startsAt: r.starts_at,
    endsAt: r.ends_at,
    productIds: r.product_ids ?? [],
    minOrderPaise: r.min_order_paise != null ? Number(r.min_order_paise) : null,
    maxUses: r.max_uses,
    usedCount: r.used_count,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export interface StoreSettings {
  storeName: string;
  storeTagline: string;
  storeAnnouncement: string;
  storeAnnouncementActive: boolean;
  maintenanceMode: boolean;
  featuredCategoryIds: string[];
  // Return/ship-from address used on admin-printed shipping labels.
  returnBusinessName: string;
  returnAddressLine1: string;
  returnAddressLine2: string;
  returnCity: string;
  returnState: string;
  returnPincode: string;
  returnCountry: string;
  returnPhone: string;
}

export function settingsFromRows(
  rows: { key: string; value: string }[]
): StoreSettings {
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  return {
    storeName: map["store_name"] ?? "BB Store",
    storeTagline: map["store_tagline"] ?? "Fuel Your Goals",
    storeAnnouncement: map["store_announcement"] ?? "",
    storeAnnouncementActive: map["store_announcement_active"] === "true",
    maintenanceMode: map["maintenance_mode"] === "true",
    featuredCategoryIds: (() => {
      try {
        return JSON.parse(map["featured_category_ids"] ?? "[]");
      } catch {
        return [];
      }
    })(),
    returnBusinessName: map["return_business_name"] ?? "BB Store",
    returnAddressLine1: map["return_address_line1"] ?? "",
    returnAddressLine2: map["return_address_line2"] ?? "",
    returnCity: map["return_city"] ?? "",
    returnState: map["return_state"] ?? "",
    returnPincode: map["return_pincode"] ?? "",
    returnCountry: map["return_country"] ?? "India",
    returnPhone: map["return_phone"] ?? "",
  };
}

/** Compute discounted price for display */
export function applyDiscount(
  pricePaise: number,
  offer: StoreOffer
): number {
  if (offer.discountType === "percentage") {
    return Math.round(pricePaise * (1 - offer.discountValue / 100));
  }
  return Math.max(0, pricePaise - offer.discountValue);
}

/** Human-readable discount label */
export function offerLabel(offer: StoreOffer): string {
  if (offer.discountType === "percentage") {
    return `${offer.discountValue}% off`;
  }
  return `₹${Math.round(offer.discountValue / 100)} off`;
}

/** Whether an offer is currently valid (date-wise) */
export function isOfferCurrentlyValid(offer: StoreOffer): boolean {
  const now = Date.now();
  if (offer.startsAt && new Date(offer.startsAt).getTime() > now) return false;
  if (offer.endsAt && new Date(offer.endsAt).getTime() < now) return false;
  return true;
}
