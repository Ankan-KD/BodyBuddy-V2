import { buildReceiptPdf } from "./receiptPdf";
import { sendReceiptEmail } from "./resendEmail";
import { formatPriceINR } from "./storeTypes";
import { ORDER_STATUS_LABELS, type StoreOrder } from "./orderTypes";

// ════════════════════════════════════════════════════════════════════════
// BB Store — Order Confirmation Email
//
// Server-only. Called once, right after an order is verified as paid
// (from either the verify-payment route or the Razorpay webhook route —
// whichever one actually performs that transition owns this call; see
// the "own the transition" comments at each call site).
//
// CRITICAL: this does NOT build its own PDF. It calls the exact same
// buildReceiptPdf(order) from receiptPdf.ts that the browser's
// "Download Receipt" button uses, so the emailed PDF and the
// browser-downloaded PDF are byte-for-byte identical. Never duplicate
// the receipt layout here.
//
// This function never throws — every failure is caught and logged so a
// broken/misconfigured mailer can never turn a successfully verified
// payment into an error response for the customer.
// ════════════════════════════════════════════════════════════════════════

function fmtOrderDate(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export async function sendOrderConfirmationEmail(order: StoreOrder): Promise<void> {
  if (!order.customerEmail) {
    console.error(`[order-confirmation] order ${order.orderNumber} has no customer email — skipping.`);
    return;
  }

  try {
    // Same generator, same output, as the browser download button.
    const doc = await buildReceiptPdf(order);
    const pdfBuffer = Buffer.from(doc.output("arraybuffer"));

    const addr = order.deliveryAddress;
    const shippingAddress = [
      addr.line1,
      addr.line2,
      [addr.city, addr.state].filter(Boolean).join(", ") + (addr.pincode ? ` – ${addr.pincode}` : ""),
      addr.country,
    ]
      .filter(Boolean)
      .join(", ");

    const items = (order.items ?? []).map((item) => ({
      name: item.productName + (item.variantName ? ` (${item.variantName})` : ""),
      qty: item.quantity,
      price: formatPriceINR(item.lineTotalPaise),
    }));

    const { error } = await sendReceiptEmail({
      to: order.customerEmail,
      customerName: order.customerName,
      orderId: order.orderNumber,
      orderDate: fmtOrderDate(order.createdAt),
      items,
      subtotal: formatPriceINR(order.subtotalPaise),
      shipping: order.deliveryPaise > 0 ? formatPriceINR(order.deliveryPaise) : "FREE",
      total: formatPriceINR(order.totalPaise),
      paymentStatus: order.paymentStatus.charAt(0).toUpperCase() + order.paymentStatus.slice(1),
      orderStatus: ORDER_STATUS_LABELS[order.status] ?? order.status,
      shippingAddress,
      attachment: {
        filename: `Receipt-${order.orderNumber}.pdf`,
        content: pdfBuffer,
        contentType: "application/pdf",
      },
    });

    if (error) {
      console.error(`[order-confirmation] send failed for order ${order.orderNumber}:`, error);
    }
  } catch (err) {
    console.error(`[order-confirmation] threw while building/sending for order ${order.orderNumber}:`, err);
  }
}
