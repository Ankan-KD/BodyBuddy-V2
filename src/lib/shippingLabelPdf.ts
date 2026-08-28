import jsPDF from "jspdf";
import { StoreOrder } from "./orderTypes";
import { StoreSettings } from "./offerTypes";

// ════════════════════════════════════════════════════════════════════════
// BB Store — Admin Shipping Label PDF
// Deliberately minimal: recipient + return address + order reference
// only. Never includes prices, payment amounts, Razorpay payment IDs,
// signatures, or (unless truly needed) customer email — this is a
// fulfillment document, not a receipt.
// ════════════════════════════════════════════════════════════════════════

const PAGE_W = 384; // 4in x 6in-ish label at 96dpi-in-points (compact single page)
const PAGE_H = 576;
const MARGIN = 28;
const TEXT = "#191631";
const TEXT_MUTED = "#64608a";
const BORDER = "#191631";

function hexToRgb(hex: string): [number, number, number] {
  const v = hex.replace("#", "");
  return [parseInt(v.slice(0, 2), 16), parseInt(v.slice(2, 4), 16), parseInt(v.slice(4, 6), 16)];
}

export function buildShippingLabelPdf(order: StoreOrder, settings: StoreSettings): jsPDF {
  const doc = new jsPDF({ unit: "pt", format: [PAGE_W, PAGE_H] });
  let y = MARGIN;

  doc.setDrawColor(...hexToRgb(BORDER));
  doc.setLineWidth(1.2);
  doc.rect(MARGIN - 10, MARGIN - 10, PAGE_W - (MARGIN - 10) * 2, PAGE_H - (MARGIN - 10) * 2);

  // ── Return address (compact, top) ─────────────────────────────────
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...hexToRgb(TEXT_MUTED));
  doc.text("FROM", MARGIN, y);
  y += 12;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...hexToRgb(TEXT));
  const fromLines = [
    settings.returnBusinessName || "BB Store",
    settings.returnAddressLine1,
    settings.returnAddressLine2,
    [settings.returnCity, settings.returnState, settings.returnPincode].filter(Boolean).join(", "),
    settings.returnCountry,
    settings.returnPhone ? `Ph: ${settings.returnPhone}` : "",
  ].filter(Boolean);
  fromLines.forEach((line) => {
    doc.text(line, MARGIN, y);
    y += 12;
  });

  y += 10;
  doc.setDrawColor(...hexToRgb(BORDER));
  doc.setLineWidth(0.75);
  doc.line(MARGIN - 10, y, PAGE_W - MARGIN + 10, y);
  y += 24;

  // ── Ship to (large, dominant) ───────────────────────────────────────
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...hexToRgb(TEXT_MUTED));
  doc.text("SHIP TO", MARGIN, y);
  y += 20;

  const addr = order.deliveryAddress;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.setTextColor(...hexToRgb(TEXT));
  doc.text(order.customerName, MARGIN, y);
  y += 22;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  const toLines = [
    addr.line1,
    addr.line2,
    `${addr.city}, ${addr.state} – ${addr.pincode}`,
    addr.country,
  ].filter(Boolean);
  toLines.forEach((line) => {
    doc.text(line, MARGIN, y);
    y += 16;
  });
  y += 4;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(`Ph: ${order.customerPhone}`, MARGIN, y);
  y += 30;

  doc.setDrawColor(...hexToRgb(BORDER));
  doc.setLineWidth(0.75);
  doc.line(MARGIN - 10, y, PAGE_W - MARGIN + 10, y);
  y += 24;

  // ── Order reference (no pricing/payment info) ────────────────────────
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...hexToRgb(TEXT_MUTED));
  doc.text("ORDER REFERENCE", MARGIN, y);
  y += 16;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(...hexToRgb(TEXT));
  doc.text(order.orderNumber, MARGIN, y);
  y += 18;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...hexToRgb(TEXT_MUTED));
  doc.text(
    `${(order.items ?? []).reduce((s, i) => s + i.quantity, 0)} item(s) · Placed ${new Date(order.createdAt).toLocaleDateString("en-IN")}`,
    MARGIN,
    y
  );

  return doc;
}

export function printShippingLabel(order: StoreOrder, settings: StoreSettings) {
  const doc = buildShippingLabelPdf(order, settings);
  doc.autoPrint();
  window.open(doc.output("bloburl"), "_blank");
}

export function downloadShippingLabel(order: StoreOrder, settings: StoreSettings) {
  const doc = buildShippingLabelPdf(order, settings);
  doc.save(`Shipping-Label-${order.orderNumber}.pdf`);
}
