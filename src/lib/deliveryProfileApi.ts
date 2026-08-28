// ════════════════════════════════════════════════════════════════════════
// BB Store — Delivery Profile API
// CRUD for the signed-in user's saved Store delivery details. RLS ensures
// a user can only read/write their own row. Completely separate from any
// BB Health profile data/table.
// ════════════════════════════════════════════════════════════════════════

import { supabase } from "./supabase";
import {
  DeliveryProfile,
  DeliveryProfileRow,
  DeliveryProfileInput,
  deliveryProfileFromRow,
} from "./deliveryProfileTypes";

/** Fetches the user's default (V1: only) saved delivery profile, or null. */
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

/** Creates or updates the user's default delivery profile (upsert-by-user). */
export async function saveMyDeliveryProfile(
  userId: string,
  existingId: string | null,
  input: DeliveryProfileInput
): Promise<{ profile: DeliveryProfile | null; error: string | null }> {
  if (!supabase) return { profile: null, error: "Supabase is not configured." };

  const payload = {
    user_id: userId,
    recipient_name: input.recipientName.trim(),
    phone: input.phone.trim(),
    line1: input.line1.trim(),
    line2: input.line2.trim(),
    city: input.city.trim(),
    state: input.state.trim(),
    pincode: input.pincode.trim(),
    country: input.country.trim() || "India",
    delivery_instructions: input.deliveryInstructions.trim(),
    is_default: true,
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
  return error ? error.message : null;
}

/** Admin-side: read (never write) a specific customer's saved profile.
 * Relies on the "Admins view delivery profiles" RLS policy. */
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
