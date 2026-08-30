"use client";

// ════════════════════════════════════════════════════════════════════════
// BB Store — Wishlist Context
// Manages the shopper's saved-for-later product list, mirroring the
// cart's persistence pattern: Supabase-backed for signed-in users,
// localStorage fallback for guests, with a guest list merged in on
// sign-in. Product-level only (no variant/quantity) — variant selection
// happens when the item is actually moved into the cart.
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
import { StoreProduct } from "./storeTypes";
import { fetchProductsByIds } from "./storeApi";
import { WishlistItem } from "./wishlistTypes";

// ── State ────────────────────────────────────────────────────────────────

interface WishlistState {
  items: WishlistItem[];
  loading: boolean;
  /** Per-product loading keys: productId → true while toggling */
  updatingIds: Set<string>;
}

type WishlistAction =
  | { type: "SET_ITEMS"; items: WishlistItem[] }
  | { type: "SET_LOADING"; loading: boolean }
  | { type: "SET_UPDATING"; productId: string; updating: boolean }
  | { type: "ADD_ITEM"; item: WishlistItem }
  | { type: "REMOVE_ITEM"; productId: string }
  | { type: "CLEAR" };

function wishlistReducer(state: WishlistState, action: WishlistAction): WishlistState {
  switch (action.type) {
    case "SET_ITEMS":
      return { ...state, items: action.items, loading: false };
    case "SET_LOADING":
      return { ...state, loading: action.loading };
    case "SET_UPDATING": {
      const next = new Set(state.updatingIds);
      if (action.updating) next.add(action.productId);
      else next.delete(action.productId);
      return { ...state, updatingIds: next };
    }
    case "ADD_ITEM": {
      if (state.items.some((i) => i.productId === action.item.productId)) return state;
      return { ...state, items: [action.item, ...state.items] };
    }
    case "REMOVE_ITEM":
      return { ...state, items: state.items.filter((i) => i.productId !== action.productId) };
    case "CLEAR":
      return { ...state, items: [] };
    default:
      return state;
  }
}

const initialState: WishlistState = { items: [], loading: true, updatingIds: new Set() };

// ── Context ──────────────────────────────────────────────────────────────

interface WishlistContextValue {
  items: WishlistItem[];
  loading: boolean;
  updatingIds: Set<string>;
  isWishlisted: (productId: string) => boolean;
  toggleWishlist: (product: StoreProduct) => Promise<void>;
  addToWishlist: (product: StoreProduct) => Promise<void>;
  removeFromWishlist: (productId: string) => Promise<void>;
  refreshWishlist: () => Promise<void>;
}

const WishlistContext = createContext<WishlistContextValue | null>(null);

// ── Guest (localStorage) persistence — stores product ids only ─────────────

const LOCAL_WISHLIST_KEY = "bb_store_guest_wishlist";

function genLocalId(): string {
  return "local-" + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function loadGuestWishlistIds(): string[] {
  try {
    if (typeof window === "undefined") return [];
    const raw = localStorage.getItem(LOCAL_WISHLIST_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function saveGuestWishlistIds(ids: string[]) {
  try {
    if (typeof window !== "undefined") {
      localStorage.setItem(LOCAL_WISHLIST_KEY, JSON.stringify(ids));
    }
  } catch {}
}

function clearGuestWishlistIds() {
  try {
    if (typeof window !== "undefined") localStorage.removeItem(LOCAL_WISHLIST_KEY);
  } catch {}
}

async function hydrateWishlistItems(
  ids: string[],
  createdAtByProductId: Map<string, string>,
  idByProductId: Map<string, string>
): Promise<WishlistItem[]> {
  if (!ids.length) return [];
  const products = await fetchProductsByIds(ids);
  const byId = new Map(products.map((p) => [p.id, p]));
  return ids
    .map((productId) => {
      const product = byId.get(productId);
      if (!product) return null;
      return {
        id: idByProductId.get(productId) ?? genLocalId(),
        productId,
        createdAt: createdAtByProductId.get(productId) ?? new Date().toISOString(),
        product,
      } as WishlistItem;
    })
    .filter((x): x is WishlistItem => x !== null);
}

// ── DB queries ───────────────────────────────────────────────────────────

interface WishlistRow {
  id: string;
  user_id: string;
  product_id: string;
  created_at: string;
}

async function dbFetchWishlistRows(userId: string): Promise<WishlistRow[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("store_wishlist_items")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) {
    console.error("[wishlist] dbFetchWishlistRows:", error.message);
    return [];
  }
  return data as WishlistRow[];
}

async function dbAddWishlistItem(userId: string, productId: string): Promise<string | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("store_wishlist_items")
    .upsert({ user_id: userId, product_id: productId }, { onConflict: "user_id,product_id" })
    .select("id")
    .single();
  if (error) {
    console.error("[wishlist] dbAddWishlistItem:", error.message);
    return null;
  }
  return (data as { id: string }).id;
}

async function dbRemoveWishlistItem(userId: string, productId: string): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase
    .from("store_wishlist_items")
    .delete()
    .eq("user_id", userId)
    .eq("product_id", productId);
  if (error) console.error("[wishlist] dbRemoveWishlistItem:", error.message);
}

// ── Provider ─────────────────────────────────────────────────────────────

export function WishlistProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [state, dispatch] = useReducer(wishlistReducer, initialState);
  const loadedForRef = useRef<string | null>(null);

  const loadForUser = useCallback(async (uid: string | null) => {
    dispatch({ type: "SET_LOADING", loading: true });
    if (uid) {
      // Merge any guest wishlist entries first (best-effort).
      const guestIds = loadGuestWishlistIds();
      for (const pid of guestIds) {
        await dbAddWishlistItem(uid, pid);
      }
      clearGuestWishlistIds();

      const rows = await dbFetchWishlistRows(uid);
      const ids = rows.map((r) => r.product_id);
      const createdAtByProductId = new Map(rows.map((r) => [r.product_id, r.created_at]));
      const idByProductId = new Map(rows.map((r) => [r.product_id, r.id]));
      const items = await hydrateWishlistItems(ids, createdAtByProductId, idByProductId);
      dispatch({ type: "SET_ITEMS", items });
    } else {
      const ids = loadGuestWishlistIds();
      const items = await hydrateWishlistItems(ids, new Map(), new Map());
      dispatch({ type: "SET_ITEMS", items });
    }
  }, []);

  useEffect(() => {
    const uid = user?.id ?? null;
    if (uid === loadedForRef.current) return;
    loadedForRef.current = uid;
    loadForUser(uid);
  }, [user?.id, loadForUser]);

  const setUpdating = (productId: string, v: boolean) =>
    dispatch({ type: "SET_UPDATING", productId, updating: v });

  const isWishlisted = useCallback(
    (productId: string) => state.items.some((i) => i.productId === productId),
    [state.items]
  );

  const addToWishlist = useCallback(
    async (product: StoreProduct) => {
      const uid = user?.id ?? null;
      if (state.items.some((i) => i.productId === product.id)) return;

      setUpdating(product.id, true);
      const optimistic: WishlistItem = {
        id: genLocalId(),
        productId: product.id,
        createdAt: new Date().toISOString(),
        product,
      };
      dispatch({ type: "ADD_ITEM", item: optimistic });

      if (uid) {
        await dbAddWishlistItem(uid, product.id);
      } else {
        const ids = [product.id, ...loadGuestWishlistIds().filter((id) => id !== product.id)];
        saveGuestWishlistIds(ids);
      }
      setUpdating(product.id, false);
    },
    [user?.id, state.items]
  );

  const removeFromWishlist = useCallback(
    async (productId: string) => {
      const uid = user?.id ?? null;
      setUpdating(productId, true);
      dispatch({ type: "REMOVE_ITEM", productId });

      if (uid) {
        await dbRemoveWishlistItem(uid, productId);
      } else {
        saveGuestWishlistIds(loadGuestWishlistIds().filter((id) => id !== productId));
      }
      setUpdating(productId, false);
    },
    [user?.id]
  );

  const toggleWishlist = useCallback(
    async (product: StoreProduct) => {
      if (isWishlisted(product.id)) await removeFromWishlist(product.id);
      else await addToWishlist(product);
    },
    [isWishlisted, addToWishlist, removeFromWishlist]
  );

  const refreshWishlist = useCallback(() => loadForUser(user?.id ?? null), [loadForUser, user?.id]);

  const value: WishlistContextValue = {
    items: state.items,
    loading: state.loading,
    updatingIds: state.updatingIds,
    isWishlisted,
    toggleWishlist,
    addToWishlist,
    removeFromWishlist,
    refreshWishlist,
  };

  return <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>;
}

export function useWishlist() {
  const ctx = useContext(WishlistContext);
  if (!ctx) throw new Error("useWishlist must be used within WishlistProvider");
  return ctx;
}
