import { sendOrderStatusUpdateEmailViaGmail } from "./resendEmail";
import { formatPriceINR } from "./storeTypes";
import { ORDER_STATUS_LABELS, type OrderStatus, type StoreOrder } from "./orderTypes";

// ════════════════════════════════════════════════════════════════════════
// BB Store — Order Status-Update Email  (Phase 2)
//
// Server-only. Called once, right after the admin's status-update DB
// write succeeds in /api/store/admin/update-order-status/route.ts.
//
// What this module does:
//   • Sends an HTML email via the existing Gmail / Nodemailer transport
//     in resendEmail.ts — never creates its own email service.
//   • Never throws — all failures are caught and logged so a broken
//     mailer cannot affect the already-saved order status change.
//   • Targets only the customer email stored on the specific order row,
//     so another customer's address can never be reached.
//
// PERF/SCOPE: the receipt PDF (via buildReceiptPdf()) is intentionally
// NOT attached here. It's already emailed once, automatically, at the
// moment the order is placed/paid (see orderConfirmationEmail.ts).
// Re-generating and re-attaching that PDF on every single admin status
// change (placed → confirmed → processing → shipped → ...) was pure
// wasted work — it added several seconds to each status update for a
// document the customer already has. Status-update emails are a plain,
// fast, attachment-free notification.
// ════════════════════════════════════════════════════════════════════════

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

// Status-specific copy shown in the email body.
const STATUS_COPY: Record<
  OrderStatus,
  { headline: string; subtext: string; accentColor: string }
> = {
  placed: {
    headline: "We received your order!",
    subtext: "Your order has been placed and is awaiting confirmation.",
    accentColor: "#d97706",
  },
  confirmed: {
    headline: "Your order is confirmed",
    subtext:
      "Great news — we've confirmed your order and will start processing it soon.",
    accentColor: "#2563eb",
  },
  processing: {
    headline: "Your order is being prepared",
    subtext:
      "Our team is currently picking and packing your items. We'll notify you once it ships.",
    accentColor: "#7c3aed",
  },
  shipped: {
    headline: "Your order is on its way!",
    subtext:
      "Your package has been handed to the courier. Delivery is typically within 2–5 business days.",
    accentColor: "#4f46e5",
  },
  delivered: {
    headline: "Your order has been delivered",
    subtext:
      "We hope you love your BodyBuddy purchase! Reach out if anything is missing or damaged.",
    accentColor: "#059669",
  },
  cancelled: {
    headline: "Your order has been cancelled",
    subtext:
      "Your order has been cancelled. If a payment was made, a refund will be processed to your original payment method within 5–7 business days.",
    accentColor: "#dc2626",
  },
};

export async function sendOrderStatusUpdateEmail(
  order: StoreOrder,
  previousStatus: OrderStatus
): Promise<void> {
  // Safety: never send to a missing email.
  if (!order.customerEmail) {
    console.error(
      `[order-status-email] order ${order.orderNumber} has no customer email — skipping.`
    );
    return;
  }

  try {
    const addr = order.deliveryAddress;
    const shippingAddress = [
      addr.line1,
      addr.line2,
      [addr.city, addr.state].filter(Boolean).join(", ") +
        (addr.pincode ? ` – ${addr.pincode}` : ""),
      addr.country,
    ]
      .filter(Boolean)
      .join(", ");

    const items = (order.items ?? []).map((item) => ({
      name:
        item.productName + (item.variantName ? ` (${item.variantName})` : ""),
      qty: item.quantity,
      price: formatPriceINR(item.lineTotalPaise),
    }));

    const copy = STATUS_COPY[order.status] ?? {
      headline: `Order status updated to ${ORDER_STATUS_LABELS[order.status]}`,
      subtext: "",
      accentColor: "#f5601f",
    };

    const { error } = await sendOrderStatusUpdateEmailViaGmail({
      to: order.customerEmail,
      customerName: order.customerName,
      orderId: order.orderNumber,
      orderDate: fmtDate(order.createdAt),
      updatedAt: fmtDate(order.updatedAt),
      previousStatus: ORDER_STATUS_LABELS[previousStatus] ?? previousStatus,
      newStatus: ORDER_STATUS_LABELS[order.status] ?? order.status,
      statusHeadline: copy.headline,
      statusSubtext: copy.subtext,
      statusAccentColor: copy.accentColor,
      items,
      subtotal: formatPriceINR(order.subtotalPaise),
      shipping:
        order.deliveryPaise > 0 ? formatPriceINR(order.deliveryPaise) : "FREE",
      total: formatPriceINR(order.totalPaise),
      shippingAddress,
      paymentStatus:
        order.paymentStatus.charAt(0).toUpperCase() +
        order.paymentStatus.slice(1),
      // No `attachment` — the receipt PDF is only ever emailed once, at
      // order confirmation. See PERF/SCOPE note above.
    });

    if (error) {
      console.error(
        `[order-status-email] send failed for order ${order.orderNumber} (${previousStatus} → ${order.status}):`,
        error
      );
    } else {
      console.log(
        `[order-status-email] sent for order ${order.orderNumber}: ${previousStatus} → ${order.status} → ${order.customerEmail}`
      );
    }
  } catch (err) {
    // Never let a mailer failure propagate — the DB write already succeeded.
    console.error(
      `[order-status-email] threw while building/sending for order ${order.orderNumber}:`,
      err
    );
  }
}
