"use client";

// ════════════════════════════════════════════════════════════════════════
// BB Store — Phase 6: Cart Context
// Manages cart state with Supabase persistence for logged-in users and
// localStorage fallback for guests. Merges guest cart on sign-in.
// ════════════════════════════════════════════════════════════════════════

import React, {
  createContext,
  useContext,
  useEffect,
  useReducer,
  useCallback,
  useRef,
} from "react";
import { supabase } from "./supabase";
import { useAuth } from "./auth";
import {
  StoreProductVariant,
  StoreProduct,
  formatPriceINR,
  discountPercent,
} from "./storeTypes";

// ── Types ────────────────────────────────────────────────────────────────

export interface CartItem {
  /** Unique cart line id (DB row id or local uuid) */
  id: string;
  productId: string;
  variantId: string;
  quantity: number;
  /** Snapshot of variant data at time of add/refresh */
  variant: StoreProductVariant;
  /** Snapshot of product data */
  product: StoreProduct;
}

export interface CartTotals {
  subtotalPaise: number;
  savingsPaise: number;
  totalPaise: number;
  itemCount: number;
}

interface CartState {
  items: CartItem[];
  loading: boolean;
  /** Per-item loading keys: variantId → true while updating */
  updatingIds: Set<string>;
}

type CartAction =
  | { type: "SET_ITEMS"; items: CartItem[] }
  | { type: "SET_LOADING"; loading: boolean }
  | { type: "SET_UPDATING"; variantId: string; updating: boolean }
  | { type: "UPSERT_ITEM"; item: CartItem }
  | { type: "REMOVE_ITEM"; variantId: string }
  | { type: "CLEAR" };

function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case "SET_ITEMS":
      return { ...state, items: action.items, loading: false };
    case "SET_LOADING":
      return { ...state, loading: action.loading };
    case "SET_UPDATING": {
      const next = new Set(state.updatingIds);
      if (action.updating) next.add(action.variantId);
      else next.delete(action.variantId);
      return { ...state, updatingIds: next };
    }
    case "UPSERT_ITEM": {
      const idx = state.items.findIndex(
        (i) => i.variantId === action.item.variantId
      );
      if (idx >= 0) {
        const items = [...state.items];
        items[idx] = action.item;
        return { ...state, items };
      }
      return { ...state, items: [...state.items, action.item] };
    }
    case "REMOVE_ITEM":
      return {
        ...state,
        items: state.items.filter((i) => i.variantId !== action.variantId),
      };
    case "CLEAR":
      return { ...state, items: [] };
    default:
      return state;
  }
}

const initialState: CartState = {
  items: [],
  loading: true,
  updatingIds: new Set(),
};

// ── Context ──────────────────────────────────────────────────────────────

interface CartContextValue {
  items: CartItem[];
  loading: boolean;
  updatingIds: Set<string>;
  totals: CartTotals;
  /** Add a product variant (or increment quantity). */
  addItem: (product: StoreProduct, variant: StoreProductVariant, qty?: number) => Promise<void>;
  /** Change quantity of an existing line. qty=0 removes it. */
  updateQty: (variantId: string, qty: number) => Promise<void>;
  /** Remove a line entirely. */
  removeItem: (variantId: string) => Promise<void>;
  /** Empty the cart. */
  clearCart: () => Promise<void>;
  /** Refresh all items from the DB (e.g. after product changes). */
  refreshCart: () => Promise<void>;
}

const CartContext = createContext<CartContextValue | null>(null);

// ── Helpers ───────────────────────────────────────────────────────────────

const LOCAL_CART_KEY = "bb_store_guest_cart";

function genLocalId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function loadGuestCart(): CartItem[] {
  try {
    if (typeof window === "undefined") return [];
    const raw = localStorage.getItem(LOCAL_CART_KEY);
    return raw ? (JSON.parse(raw) as CartItem[]) : [];
  } catch {
    return [];
  }
}

function saveGuestCart(items: CartItem[]) {
  try {
    if (typeof window !== "undefined") {
      localStorage.setItem(LOCAL_CART_KEY, JSON.stringify(items));
    }
  } catch {}
}

function clearGuestCart() {
  try {
    if (typeof window !== "undefined") {
      localStorage.removeItem(LOCAL_CART_KEY);
    }
  } catch {}
}

export function calcTotals(items: CartItem[]): CartTotals {
  let subtotalPaise = 0;
  let savingsPaise = 0;
  let itemCount = 0;

  for (const item of items) {
    const price = item.variant.pricePaise;
    const compare = item.variant.comparePricePaise;
    subtotalPaise += price * item.quantity;
    if (compare && compare > price) {
      savingsPaise += (compare - price) * item.quantity;
    }
    itemCount += item.quantity;
  }

  return {
    subtotalPaise,
    savingsPaise,
    totalPaise: subtotalPaise, // no delivery fee in V1
    itemCount,
  };
}

// ── DB row → CartItem ─────────────────────────────────────────────────────

interface CartRow {
  id: string;
  user_id: string;
  product_id: string;
  variant_id: string;
  quantity: number;
  created_at: string;
  updated_at: string;
  // Joined
  store_product_variants?: VariantWithProduct | null;
}

interface VariantWithProduct {
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
  availability: string;
  is_default: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
  store_products?: ProductRow | null;
}

interface ProductRow {
  id: string;
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
  rating_average: number;
  rating_count: number;
  sort_order: number;
  is_featured: boolean;
  created_at: string;
  updated_at: string;
}

function rowToCartItem(row: CartRow): CartItem | null {
  const vr = row.store_product_variants;
  if (!vr) return null;
  const pr = vr.store_products;
  if (!pr) return null;

  const variant: StoreProductVariant = {
    id: vr.id,
    productId: vr.product_id,
    sku: vr.sku,
    name: vr.name,
    sizeLabel: vr.size_label,
    flavour: vr.flavour,
    color: vr.color,
    pricePaise: Number(vr.price_paise),
    comparePricePaise: vr.compare_price_paise != null ? Number(vr.compare_price_paise) : null,
    stockQuantity: vr.stock_quantity,
    lowStockThreshold: vr.low_stock_threshold,
    images: vr.images ?? [],
    availability: vr.availability as StoreProductVariant["availability"],
    isDefault: vr.is_default,
    sortOrder: vr.sort_order,
    createdAt: vr.created_at,
    updatedAt: vr.updated_at,
  };

  const product: StoreProduct = {
    id: pr.id,
    name: pr.name,
    slug: pr.slug,
    brandId: pr.brand_id,
    categoryId: pr.category_id,
    productType: pr.product_type ?? "",
    catalogSourceId: pr.catalog_source_id ?? null,
    shortDescription: pr.short_description,
    fullDescription: pr.full_description,
    usageInfo: pr.usage_info,
    ingredients: pr.ingredients,
    warnings: pr.warnings,
    images: pr.images ?? [],
    tags: pr.tags ?? [],
    healthGoalTags: pr.health_goal_tags ?? [],
    nutrition: {
      servingSizeLabel: pr.serving_size_label,
      servingSizeG: pr.serving_size_g != null ? Number(pr.serving_size_g) : null,
      caloriesPerServing: pr.calories_per_serving != null ? Number(pr.calories_per_serving) : null,
      proteinPerServing: pr.protein_per_serving != null ? Number(pr.protein_per_serving) : null,
      carbsPerServing: pr.carbs_per_serving != null ? Number(pr.carbs_per_serving) : null,
      fatPerServing: pr.fat_per_serving != null ? Number(pr.fat_per_serving) : null,
      fibrePerServing: pr.fibre_per_serving != null ? Number(pr.fibre_per_serving) : null,
      sodiumPerServing: pr.sodium_per_serving != null ? Number(pr.sodium_per_serving) : null,
      sugarPerServing: pr.sugar_per_serving != null ? Number(pr.sugar_per_serving) : null,
    },
    published: pr.published,
    availability: pr.availability as StoreProduct["availability"],
    ratingAverage: Number(pr.rating_average),
    ratingCount: pr.rating_count,
    sortOrder: pr.sort_order,
    isFeatured: pr.is_featured,
    createdAt: pr.created_at,
    updatedAt: pr.updated_at,
  };

  return {
    id: row.id,
    productId: row.product_id,
    variantId: row.variant_id,
    quantity: row.quantity,
    variant,
    product,
  };
}

// ── DB queries ────────────────────────────────────────────────────────────

const VARIANT_JOIN = `
  store_product_variants (
    *,
    store_products (*)
  )
`;

async function dbFetchCart(userId: string): Promise<CartItem[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("store_cart_items")
    .select(`*, ${VARIANT_JOIN}`)
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("[cart] dbFetchCart:", error.message);
    return [];
  }

  return (data as CartRow[])
    .map(rowToCartItem)
    .filter((x): x is CartItem => x !== null)
    .filter(
      (item) =>
        item.product.published &&
        item.product.availability !== "inactive" &&
        item.product.availability !== "discontinued"
    );
}

async function dbUpsertCartItem(
  userId: string,
  productId: string,
  variantId: string,
  quantity: number
): Promise<string | null> {
  if (!supabase) return null;
  // Check for existing row
  const { data: existing } = await supabase
    .from("store_cart_items")
    .select("id, quantity")
    .eq("user_id", userId)
    .eq("variant_id", variantId)
    .single();

  if (existing) {
    const { error } = await supabase
      .from("store_cart_items")
      .update({ quantity, updated_at: new Date().toISOString() })
      .eq("id", existing.id);
    if (error) console.error("[cart] dbUpsertCartItem update:", error.message);
    return existing.id;
  } else {
    const { data, error } = await supabase
      .from("store_cart_items")
      .insert({ user_id: userId, product_id: productId, variant_id: variantId, quantity })
      .select("id")
      .single();
    if (error) {
      console.error("[cart] dbUpsertCartItem insert:", error.message);
      return null;
    }
    return (data as { id: string }).id;
  }
}

async function dbRemoveCartItem(userId: string, variantId: string): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase
    .from("store_cart_items")
    .delete()
    .eq("user_id", userId)
    .eq("variant_id", variantId);
  if (error) console.error("[cart] dbRemoveCartItem:", error.message);
}

async function dbClearCart(userId: string): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase
    .from("store_cart_items")
    .delete()
    .eq("user_id", userId);
  if (error) console.error("[cart] dbClearCart:", error.message);
}

// ── Provider ─────────────────────────────────────────────────────────────

export function CartProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [state, dispatch] = useReducer(cartReducer, initialState);
  // Prevent double-load on strict mode
  const loadedForRef = useRef<string | null>(null);

  // ── Load cart when user changes ─────────────────────────────────────
  useEffect(() => {
    const uid = user?.id ?? null;
    if (uid === loadedForRef.current) return;
    loadedForRef.current = uid;

    if (uid) {
      // Logged-in: load from DB, merge guest cart
      dispatch({ type: "SET_LOADING", loading: true });
      (async () => {
        // Merge any guest items first
        const guestItems = loadGuestCart();
        for (const gi of guestItems) {
          const maxQty = Math.min(gi.quantity, gi.variant.stockQuantity);
          if (maxQty > 0) {
            await dbUpsertCartItem(uid, gi.productId, gi.variantId, maxQty);
          }
        }
        clearGuestCart();

        const items = await dbFetchCart(uid);
        dispatch({ type: "SET_ITEMS", items });
      })();
    } else {
      // Guest: load from localStorage
      const items = loadGuestCart();
      dispatch({ type: "SET_ITEMS", items });
    }
  }, [user?.id]);

  // ── Helpers ────────────────────────────────────────────────────────

  const setUpdating = (variantId: string, v: boolean) =>
    dispatch({ type: "SET_UPDATING", variantId, updating: v });

  const addItem = useCallback(
    async (product: StoreProduct, variant: StoreProductVariant, qty = 1) => {
      const uid = user?.id ?? null;

      // Clamp to stock
      const existing = state.items.find((i) => i.variantId === variant.id);
      const currentQty = existing?.quantity ?? 0;
      const newQty = Math.min(currentQty + qty, variant.stockQuantity);
      if (newQty <= 0) return;

      setUpdating(variant.id, true);

      const optimisticItem: CartItem = {
        id: existing?.id ?? genLocalId(),
        productId: product.id,
        variantId: variant.id,
        quantity: newQty,
        variant,
        product,
      };
      dispatch({ type: "UPSERT_ITEM", item: optimisticItem });

      if (uid) {
        const rowId = await dbUpsertCartItem(uid, product.id, variant.id, newQty);
        if (rowId) {
          dispatch({
            type: "UPSERT_ITEM",
            item: { ...optimisticItem, id: rowId },
          });
        }
      } else {
        const updated = state.items
          .filter((i) => i.variantId !== variant.id)
          .concat(optimisticItem);
        saveGuestCart(updated);
      }

      setUpdating(variant.id, false);
    },
    [user?.id, state.items]
  );

  const updateQty = useCallback(
    async (variantId: string, qty: number) => {
      const uid = user?.id ?? null;
      const existing = state.items.find((i) => i.variantId === variantId);
      if (!existing) return;

      if (qty <= 0) {
        await removeItemFn(variantId, uid);
        return;
      }

      const clamped = Math.min(qty, existing.variant.stockQuantity);
      setUpdating(variantId, true);

      const updated: CartItem = { ...existing, quantity: clamped };
      dispatch({ type: "UPSERT_ITEM", item: updated });

      if (uid) {
        await dbUpsertCartItem(uid, existing.productId, variantId, clamped);
      } else {
        const updatedItems = state.items
          .filter((i) => i.variantId !== variantId)
          .concat(updated);
        saveGuestCart(updatedItems);
      }

      setUpdating(variantId, false);
    },
    [user?.id, state.items]
  );

  async function removeItemFn(variantId: string, uid: string | null) {
    setUpdating(variantId, true);
    dispatch({ type: "REMOVE_ITEM", variantId });

    if (uid) {
      await dbRemoveCartItem(uid, variantId);
    } else {
      const updated = state.items.filter((i) => i.variantId !== variantId);
      saveGuestCart(updated);
    }
    setUpdating(variantId, false);
  }

  const removeItem = useCallback(
    (variantId: string) => removeItemFn(variantId, user?.id ?? null),
    [user?.id, state.items]
  );

  const clearCart = useCallback(async () => {
    const uid = user?.id ?? null;
    dispatch({ type: "CLEAR" });
    if (uid) {
      await dbClearCart(uid);
    } else {
      clearGuestCart();
    }
  }, [user?.id]);

  const refreshCart = useCallback(async () => {
    const uid = user?.id ?? null;
    dispatch({ type: "SET_LOADING", loading: true });
    if (uid) {
      const items = await dbFetchCart(uid);
      dispatch({ type: "SET_ITEMS", items });
    } else {
      const items = loadGuestCart();
      dispatch({ type: "SET_ITEMS", items });
    }
  }, [user?.id]);

  const totals = calcTotals(state.items);

  const value: CartContextValue = {
    items: state.items,
    loading: state.loading,
    updatingIds: state.updatingIds,
    totals,
    addItem,
    updateQty,
    removeItem,
    clearCart,
    refreshCart,
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}

// Re-export formatPriceINR so cart UI doesn't need to import from storeTypes
export { formatPriceINR, discountPercent };
