// ════════════════════════════════════════════════════════════════════════
// BB Store — Saved Delivery Profile Types
// Store-only delivery details, kept entirely separate from BB Health data.
// ════════════════════════════════════════════════════════════════════════

export interface DeliveryProfile {
  id: string;
  userId: string;
  recipientName: string;
  phone: string;
  line1: string;
  line2: string;
  city: string;
  state: string;
  pincode: string;
  country: string;
  deliveryInstructions: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DeliveryProfileRow {
  id: string;
  user_id: string;
  recipient_name: string;
  phone: string;
  line1: string;
  line2: string;
  city: string;
  state: string;
  pincode: string;
  country: string;
  delivery_instructions: string;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export function deliveryProfileFromRow(r: DeliveryProfileRow): DeliveryProfile {
  return {
    id: r.id,
    userId: r.user_id,
    recipientName: r.recipient_name,
    phone: r.phone,
    line1: r.line1,
    line2: r.line2,
    city: r.city,
    state: r.state,
    pincode: r.pincode,
    country: r.country,
    deliveryInstructions: r.delivery_instructions,
    isDefault: r.is_default,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export interface DeliveryProfileInput {
  recipientName: string;
  phone: string;
  line1: string;
  line2: string;
  city: string;
  state: string;
  pincode: string;
  country: string;
  deliveryInstructions: string;
}
