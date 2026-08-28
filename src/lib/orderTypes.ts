// ════════════════════════════════════════════════════════════════════════
// BB Store — Phase 7: Order Types
// All order-related types that map to store_orders + store_order_items.
// ════════════════════════════════════════════════════════════════════════

// ── Delivery Address ──────────────────────────────────────────────────────

export interface DeliveryAddress {
  line1: string;
  line2: string;
  city: string;
  state: string;
  pincode: string;
  country: string;
}

// ── Order Status ──────────────────────────────────────────────────────────

export type OrderStatus =
  | "placed"
  | "confirmed"
  | "processing"
  | "shipped"
  | "delivered"
  | "cancelled";

export type PaymentMethod =
  | "razorpay"
  | "upi"
  | "card"
  | "netbanking"
  | "wallet"
  | "emi"
  | "cod"
  | "other";
export type PaymentStatus = "pending" | "paid" | "failed" | "refunded";

// ── Order Item ────────────────────────────────────────────────────────────

export interface StoreOrderItem {
  id: string;
  orderId: string;
  productId: string | null;
  variantId: string | null;
  productName: string;
  variantName: string;
  sku: string;
  imageUrl: string | null;
  unitPricePaise: number;
  comparePricePaise: number | null;
  quantity: number;
  lineTotalPaise: number;
  createdAt: string;
}

// ── Order ─────────────────────────────────────────────────────────────────

export interface StoreOrder {
  id: string;
  orderNumber: string;
  userId: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  deliveryAddress: DeliveryAddress;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  paymentReference: string | null;
  razorpayOrderId: string | null;
  razorpayPaymentId: string | null;
  subtotalPaise: number;
  discountPaise: number;
  deliveryPaise: number;
  totalPaise: number;
  status: OrderStatus;
  notes: string;
  createdAt: string;
  updatedAt: string;
  // populated by join
  items?: StoreOrderItem[];
}

// ── Create Order Payload ──────────────────────────────────────────────────

export interface CreateOrderPayload {
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  deliveryAddress: DeliveryAddress;
  paymentMethod: PaymentMethod;
  notes?: string;
}

// ── DB Row Types ──────────────────────────────────────────────────────────

export interface OrderRow {
  id: string;
  order_number: string;
  user_id: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  delivery_address: DeliveryAddress;
  payment_method: PaymentMethod;
  payment_status: PaymentStatus;
  payment_reference: string | null;
  razorpay_order_id: string | null;
  razorpay_payment_id: string | null;
  subtotal_paise: number;
  discount_paise: number;
  delivery_paise: number;
  total_paise: number;
  status: OrderStatus;
  notes: string;
  created_at: string;
  updated_at: string;
  store_order_items?: OrderItemRow[];
}

export interface OrderItemRow {
  id: string;
  order_id: string;
  product_id: string | null;
  variant_id: string | null;
  product_name: string;
  variant_name: string;
  sku: string;
  image_url: string | null;
  unit_price_paise: number;
  compare_price_paise: number | null;
  quantity: number;
  line_total_paise: number;
  created_at: string;
}

// ── Mappers ───────────────────────────────────────────────────────────────

export function orderFromRow(r: OrderRow): StoreOrder {
  return {
    id: r.id,
    orderNumber: r.order_number,
    userId: r.user_id,
    customerName: r.customer_name,
    customerEmail: r.customer_email,
    customerPhone: r.customer_phone,
    deliveryAddress: r.delivery_address,
    paymentMethod: r.payment_method,
    paymentStatus: r.payment_status,
    paymentReference: r.payment_reference,
    razorpayOrderId: r.razorpay_order_id,
    razorpayPaymentId: r.razorpay_payment_id,
    subtotalPaise: Number(r.subtotal_paise),
    discountPaise: Number(r.discount_paise),
    deliveryPaise: Number(r.delivery_paise),
    totalPaise: Number(r.total_paise),
    status: r.status,
    notes: r.notes,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    items: r.store_order_items?.map(orderItemFromRow),
  };
}

export function orderItemFromRow(r: OrderItemRow): StoreOrderItem {
  return {
    id: r.id,
    orderId: r.order_id,
    productId: r.product_id,
    variantId: r.variant_id,
    productName: r.product_name,
    variantName: r.variant_name,
    sku: r.sku,
    imageUrl: r.image_url,
    unitPricePaise: Number(r.unit_price_paise),
    comparePricePaise: r.compare_price_paise != null ? Number(r.compare_price_paise) : null,
    quantity: r.quantity,
    lineTotalPaise: Number(r.line_total_paise),
    createdAt: r.created_at,
  };
}

// ── Status helpers ────────────────────────────────────────────────────────

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  placed: "Order Placed",
  confirmed: "Confirmed",
  processing: "Processing",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

export const ORDER_STATUS_COLORS: Record<OrderStatus, string> = {
  placed: "text-amber-600 dark:text-amber-300 bg-amber-500/10 border-amber-500/20",
  confirmed: "text-blue-600 dark:text-blue-300 bg-blue-500/10 border-blue-500/20",
  processing: "text-purple-600 dark:text-purple-300 bg-purple-500/10 border-purple-500/20",
  shipped: "text-indigo-600 dark:text-indigo-300 bg-indigo-500/10 border-indigo-500/20",
  delivered: "text-emerald-600 dark:text-emerald-300 bg-emerald-500/10 border-emerald-500/20",
  cancelled: "text-red-600 dark:text-red-300 bg-red-500/10 border-red-500/20",
};

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  razorpay: "Razorpay",
  cod: "Cash on Delivery",
  upi: "UPI",
  card: "Credit / Debit Card",
  netbanking: "Net Banking",
  wallet: "Wallet",
  emi: "EMI",
  other: "Online Payment",
};
