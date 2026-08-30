// ════════════════════════════════════════════════════════════════════════
// BB Store — Delivery Profile API
// CRUD for the signed-in user's saved Store delivery addresses. RLS
// ensures a user can only read/write their own rows. A user may save
// several addresses (Home, Work, a relative's place, ...) — exactly one
// is flagged is_default at a time (enforced server-side by a trigger, see
// supabase/014_wishlist_and_addresses.sql), and checkout pre-fills from
// that one. Completely separate from any BB Health profile data/table.
// ════════════════════════════════════════════════════════════════════════

import { supabase } from "./supabase";
import {
  DeliveryProfile,
  DeliveryProfileRow,
  DeliveryProfileInput,
  deliveryProfileFromRow,
} from "./deliveryProfileTypes";

/** Fetches every saved address for the user, default first, then most recently updated. */
export async function listMyDeliveryProfiles(userId: string): Promise<DeliveryProfile[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("store_delivery_profiles")
    .select("*")
    .eq("user_id", userId)
    .order("is_default", { ascending: false })
    .order("updated_at", { ascending: false });

  if (error || !data) return [];
  return (data as DeliveryProfileRow[]).map(deliveryProfileFromRow);
}

/** Fetches the user's default saved delivery address, or null. */
export async function fetchMyDeliveryProfile(userId: string): Promise<DeliveryProfile | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("store_delivery_profiles")
    .select("*")
    .eq("user_id", userId)
    .eq("is_default", true)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  return deliveryProfileFromRow(data as DeliveryProfileRow);
}

/**
 * Creates a new saved address, or updates an existing one (when
 * `existingId` is given). The very first address a user ever saves is
 * always forced to default so checkout always has something to pre-fill
 * from; afterwards, `input.isDefault` controls it.
 */
export async function saveMyDeliveryProfile(
  userId: string,
  existingId: string | null,
  input: DeliveryProfileInput
): Promise<{ profile: DeliveryProfile | null; error: string | null }> {
  if (!supabase) return { profile: null, error: "Supabase is not configured." };

  let isDefault = input.isDefault ?? false;
  if (!existingId && !isDefault) {
    // First-ever address for this user must be the default.
    const existing = await listMyDeliveryProfiles(userId);
    if (existing.length === 0) isDefault = true;
  }

  const payload = {
    user_id: userId,
    label: input.label.trim() || "Home",
    recipient_name: input.recipientName.trim(),
    phone: input.phone.trim(),
    line1: input.line1.trim(),
    line2: input.line2.trim(),
    city: input.city.trim(),
    state: input.state.trim(),
    pincode: input.pincode.trim(),
    country: input.country.trim() || "India",
    delivery_instructions: input.deliveryInstructions.trim(),
    is_default: isDefault,
  };

  if (existingId) {
    const { data, error } = await supabase
      .from("store_delivery_profiles")
      .update(payload)
      .eq("id", existingId)
      .eq("user_id", userId)
      .select()
      .single();
    if (error) return { profile: null, error: error.message };
    return { profile: deliveryProfileFromRow(data as DeliveryProfileRow), error: null };
  }

  const { data, error } = await supabase
    .from("store_delivery_profiles")
    .insert(payload)
    .select()
    .single();
  if (error) return { profile: null, error: error.message };
  return { profile: deliveryProfileFromRow(data as DeliveryProfileRow), error: null };
}

/** Marks one saved address as the default (unsets any previous default). */
export async function setDefaultDeliveryProfile(userId: string, id: string): Promise<string | null> {
  if (!supabase) return "Supabase is not configured.";
  const { error } = await supabase
    .from("store_delivery_profiles")
    .update({ is_default: true })
    .eq("id", id)
    .eq("user_id", userId);
  return error ? error.message : null;
}

export async function deleteMyDeliveryProfile(
  userId: string,
  id: string
): Promise<string | null> {
  if (!supabase) return "Supabase is not configured.";
  const { error } = await supabase
    .from("store_delivery_profiles")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);
  if (error) return error.message;

  // If the deleted address happened to be the default, promote the most
  // recently updated remaining address so checkout still has a default.
  const remaining = await listMyDeliveryProfiles(userId);
  if (remaining.length > 0 && !remaining.some((p) => p.isDefault)) {
    await setDefaultDeliveryProfile(userId, remaining[0].id);
  }
  return null;
}

/** Admin-side: read (never write) a specific customer's default saved
 * address. Relies on the "Admins view delivery profiles" RLS policy. */
export async function adminFetchDeliveryProfile(userId: string): Promise<DeliveryProfile | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("store_delivery_profiles")
    .select("*")
    .eq("user_id", userId)
    .eq("is_default", true)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return deliveryProfileFromRow(data as DeliveryProfileRow);
}
