import jsPDF from "jspdf";
import { StoreOrder } from "./orderTypes";
import { StoreSettings } from "./offerTypes";

// ════════════════════════════════════════════════════════════════════════
// BB Store — Admin Shipping Label PDF
//
// Fulfillment document only. Intentionally omits:
//   • Prices, payment amounts, discount info
//   • Razorpay payment IDs or order IDs
//   • Razorpay signatures or webhook payloads
//   • Customer email (not needed for delivery)
// This is a courier label, not a receipt. Warehouse staff should only
// see what they need to pack and ship the order correctly.
// ════════════════════════════════════════════════════════════════════════

// ── Page geometry (4 × 6 inch label at 72pt/in) ──────────────────────────
const PAGE_W = 288; // 4 in
const PAGE_H = 432; // 6 in
const MARGIN = 18;
const INNER_W = PAGE_W - MARGIN * 2;

// ── Palette ───────────────────────────────────────────────────────────────
const C_TEXT   = "#0f0e1a";
const C_MUTED  = "#5a5870";
const C_BG     = "#f9f8fd";
const C_BORDER = "#1a1830";
const C_ACCENT = "#f5601f";

function rgb(hex: string): [number, number, number] {
  const v = hex.replace("#", "");
  return [parseInt(v.slice(0, 2), 16), parseInt(v.slice(2, 4), 16), parseInt(v.slice(4, 6), 16)];
}

/** Draw a simple Code128-inspired barcode pattern for the order number.
 *  Each character maps to a rough column width — decorative only, not
 *  scannable — just provides the visual "this is a label" cue without
 *  a heavy barcode library. */
function drawBarcodeDecoration(doc: jsPDF, text: string, x: number, y: number, w: number, h: number) {
  const chars = Array.from(text);
  const unitW = w / (chars.length * 5 + 8);
  let cx = x;
  // Start quiet zone + guard
  doc.setFillColor(...rgb(C_TEXT));
  doc.rect(cx, y, unitW, h, "F"); cx += unitW * 2;
  doc.rect(cx, y, unitW * 2, h, "F"); cx += unitW * 3;

  // Data bars: map char code to a narrow/wide/gap pattern
  chars.forEach((ch) => {
    const code = ch.charCodeAt(0);
    const patterns = [
      code % 3 === 0 ? unitW * 2 : unitW,
      code % 5 === 0 ? unitW * 3 : unitW,
      code % 7 === 0 ? unitW * 2 : unitW,
    ];
    patterns.forEach((bw, pi) => {
      if (pi % 2 === 0) {
        doc.rect(cx, y, bw, h, "F");
      }
      cx += bw + unitW * 0.5;
    });
  });

  // Stop guard
  doc.rect(cx, y, unitW * 2, h, "F"); cx += unitW * 2;
  doc.rect(cx, y, unitW, h, "F");
}

export function buildShippingLabelPdf(order: StoreOrder, settings: StoreSettings): jsPDF {
  const doc = new jsPDF({ unit: "pt", format: [PAGE_W, PAGE_H] });
  let y = 0;

  // ── Label boundary (dashed cut-line border) ──────────────────────────
  // Subtle background fill
  doc.setFillColor(...rgb(C_BG));
  doc.rect(0, 0, PAGE_W, PAGE_H, "F");

  // Dashed outer border = cut line
  doc.setDrawColor(...rgb(C_BORDER));
  doc.setLineWidth(0.5);
  doc.setLineDashPattern([4, 3], 0);
  doc.rect(4, 4, PAGE_W - 8, PAGE_H - 8);
  doc.setLineDashPattern([], 0); // reset dash

  // Corner crop marks (solid)
  doc.setLineWidth(0.75);
  const mk = 8; // crop mark length
  // top-left
  doc.line(4, 4, 4 + mk, 4); doc.line(4, 4, 4, 4 + mk);
  // top-right
  doc.line(PAGE_W - 4 - mk, 4, PAGE_W - 4, 4); doc.line(PAGE_W - 4, 4, PAGE_W - 4, 4 + mk);
  // bottom-left
  doc.line(4, PAGE_H - 4, 4 + mk, PAGE_H - 4); doc.line(4, PAGE_H - 4, 4, PAGE_H - 4 - mk);
  // bottom-right
  doc.line(PAGE_W - 4 - mk, PAGE_H - 4, PAGE_W - 4, PAGE_H - 4);
  doc.line(PAGE_W - 4, PAGE_H - 4, PAGE_W - 4, PAGE_H - 4 - mk);

  y = MARGIN;

  // ── Store logo / brand line ───────────────────────────────────────────
  doc.setFillColor(...rgb(C_ACCENT));
  doc.rect(MARGIN, y, INNER_W, 3, "F");
  y += 9;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...rgb(C_TEXT));
  doc.text(settings.storeName || "BB Store", MARGIN, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...rgb(C_MUTED));
  doc.text("SHIPPING LABEL", PAGE_W - MARGIN, y, { align: "right" });
  y += 6;

  // ── FROM (return address, compact) ────────────────────────────────────
  y += 10;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(...rgb(C_MUTED));
  doc.text("FROM", MARGIN, y);
  y += 10;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...rgb(C_TEXT));
  const fromLines = [
    settings.returnBusinessName || settings.storeName || "BB Store",
    settings.returnAddressLine1,
    settings.returnAddressLine2,
    [settings.returnCity, settings.returnState, settings.returnPincode].filter(Boolean).join(", "),
    settings.returnCountry,
    settings.returnPhone ? `Ph: ${settings.returnPhone}` : "",
  ].filter(Boolean) as string[];
  fromLines.forEach((line) => {
    doc.text(line, MARGIN, y);
    y += 10;
  });

  y += 6;

  // ── Divider ───────────────────────────────────────────────────────────
  doc.setDrawColor(...rgb(C_BORDER));
  doc.setLineWidth(1.2);
  doc.line(MARGIN, y, PAGE_W - MARGIN, y);
  y += 14;

  // ── SHIP TO header ────────────────────────────────────────────────────
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...rgb(C_MUTED));
  doc.text("SHIP TO", MARGIN, y);
  y += 14;

  // Recipient name — large and dominant
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(...rgb(C_TEXT));
  doc.text(order.customerName, MARGIN, y);
  y += 24;

  // Address lines
  const addr = order.deliveryAddress;
  const toLines = [
    addr.line1,
    addr.line2,
    `${addr.city}, ${addr.state} – ${addr.pincode}`,
    addr.country,
  ].filter(Boolean) as string[];

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(...rgb(C_TEXT));
  toLines.forEach((line) => {
    doc.text(line, MARGIN, y);
    y += 15;
  });
  y += 4;

  // Phone
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.setTextColor(...rgb(C_TEXT));
  doc.text(`Ph: ${order.customerPhone}`, MARGIN, y);
  y += 18;

  // ── Divider ───────────────────────────────────────────────────────────
  doc.setDrawColor(...rgb(C_BORDER));
  doc.setLineWidth(0.75);
  doc.line(MARGIN, y, PAGE_W - MARGIN, y);
  y += 14;

  // ── Order reference + barcode ─────────────────────────────────────────
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(...rgb(C_MUTED));
  doc.text("ORDER REFERENCE", MARGIN, y);
  y += 12;

  // Bounding box for the order number block
  doc.setDrawColor(...rgb(C_BORDER));
  doc.setLineWidth(0.5);
  doc.rect(MARGIN, y - 4, INNER_W, 30);

  doc.setFont("courier", "bold");
  doc.setFontSize(14);
  doc.setTextColor(...rgb(C_TEXT));
  doc.text(order.orderNumber, MARGIN + 6, y + 14);

  // Barcode decoration (right side of box)
  drawBarcodeDecoration(doc, order.orderNumber, PAGE_W - MARGIN - 64, y - 2, 56, 26);

  y += 38;

  // Item summary
  const totalQty = (order.items ?? []).reduce((s, i) => s + i.quantity, 0);
  const itemCount = (order.items ?? []).length;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...rgb(C_MUTED));
  doc.text(
    `${totalQty} item(s) across ${itemCount} line(s)  ·  Placed ${new Date(order.createdAt).toLocaleDateString("en-IN")}`,
    MARGIN,
    y
  );
  y += 18;

  // ── Operational blanks for warehouse staff ────────────────────────────
  doc.setDrawColor(...rgb(C_BORDER));
  doc.setLineWidth(0.4);
  doc.line(MARGIN, y, PAGE_W - MARGIN, y);
  y += 14;

  const blankFields: [string, string][] = [
    ["Weight:", "________ kg"],
    ["Carrier:", "________________________________"],
    ["Tracking:", "________________________________"],
  ];
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  blankFields.forEach(([label, blank]) => {
    doc.setTextColor(...rgb(C_MUTED));
    doc.text(label, MARGIN, y);
    doc.setTextColor(...rgb(C_TEXT));
    doc.text(blank, MARGIN + 44, y);
    y += 13;
  });

  // ── Bottom accent strip ───────────────────────────────────────────────
  doc.setFillColor(...rgb(C_ACCENT));
  doc.rect(4, PAGE_H - 10, PAGE_W - 8, 4, "F");

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
