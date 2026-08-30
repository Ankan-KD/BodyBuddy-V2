import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { StoreOrder, ORDER_STATUS_LABELS, PAYMENT_METHOD_LABELS } from "./orderTypes";
import { formatPriceINR } from "./storeTypes";

// ════════════════════════════════════════════════════════════════════════
// BB Store — Internal Admin Receipt PDF
//
// ADMIN / INTERNAL USE ONLY — NOT FOR CUSTOMERS.
// Includes all operational fields (UUID, userId, internal status, notes,
// full Razorpay identifiers, payment reference/error) that the
// customer-facing receipt deliberately omits. Only prints fields that
// actually exist on the StoreOrder type — no fabricated data.
//
// Safety rules (same as receiptPdf.ts):
//   • Uses the order's stored snapshot data only (no live re-fetches).
//   • Never prints Razorpay API keys/secrets — those aren't on StoreOrder.
//   • Never prints other customers' data.
// ════════════════════════════════════════════════════════════════════════

// ── Page geometry ────────────────────────────────────────────────────────
const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = 44;
const CONTENT_W = PAGE_W - MARGIN * 2;

// ── Palette (more monochrome / operational than customer receipt) ─────────
const C_TEXT        = "#1a1a2e";
const C_MUTED       = "#6b6b8a";
const C_BORDER      = "#d4d0ea";
const C_HEADER_BG   = "#f0eefa";
const C_ROW_ALT     = "#f8f7fd";
const C_ACCENT      = "#f5601f";
const C_WARN_STRIP  = "#7c3aed"; // purple — "internal" marker colour
const C_WARN_BG     = "#f3eeff";
const C_SUCCESS     = "#166534";
const C_SUCCESS_BG  = "#dcfce7";
const C_FAIL        = "#991b1b";
const C_FAIL_BG     = "#fee2e2";

function rgb(hex: string): [number, number, number] {
  const v = hex.replace("#", "");
  return [parseInt(v.slice(0, 2), 16), parseInt(v.slice(2, 4), 16), parseInt(v.slice(4, 6), 16)];
}

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  });
}

function fmtDateShort(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** Draw a small "INTERNAL COPY" watermark / stamp ribbon in the top-right corner */
function drawInternalStamp(doc: jsPDF) {
  doc.saveGraphicsState();
  // Ribbon background
  doc.setFillColor(...rgb(C_WARN_STRIP));
  // Diagonal ribbon: draw a rotated rect via a simple parallelogram using lines
  // We fake this with a filled triangle-ish shape at the top-right corner
  const cx = PAGE_W - 12;
  const cy = 12;
  const size = 96;
  doc.triangle(cx - size, cy, cx, cy, cx, cy + size, "F");

  // Rotated text inside ribbon
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(255, 255, 255);
  // jsPDF text rotation is in degrees; positive = counter-clockwise
  doc.text("INTERNAL COPY", cx - size * 0.62, cy + size * 0.46, { angle: -45 });
  doc.restoreGraphicsState();
}

export function buildAdminReceiptPdf(order: StoreOrder): jsPDF {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  let y = 0;

  // ── Page border ───────────────────────────────────────────────────────
  doc.setDrawColor(...rgb(C_BORDER));
  doc.setLineWidth(0.5);
  doc.rect(12, 12, PAGE_W - 24, PAGE_H - 24);

  // Top accent bar (purple for internal)
  doc.setFillColor(...rgb(C_WARN_STRIP));
  doc.rect(12, 12, PAGE_W - 24, 5, "F");

  drawInternalStamp(doc);

  y = 42;

  // ── Header: store name + doc title ───────────────────────────────────
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(...rgb(C_TEXT));
  doc.text("BB Store", MARGIN, y);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...rgb(C_MUTED));
  doc.text("Admin · Internal Copy", MARGIN, y + 14);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(...rgb(C_TEXT));
  doc.text("INTERNAL ORDER RECORD", PAGE_W - MARGIN - 120, y, { align: "right" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...rgb(C_MUTED));
  doc.text(`Order ${order.orderNumber}`, PAGE_W - MARGIN - 120, y + 14, { align: "right" });
  doc.text(fmtDateTime(order.createdAt), PAGE_W - MARGIN - 120, y + 26, { align: "right" });

  y += 50;

  doc.setDrawColor(...rgb(C_BORDER));
  doc.setLineWidth(1);
  doc.line(MARGIN, y, PAGE_W - MARGIN, y);
  y += 16;

  // ── "INTERNAL — NOT FOR CUSTOMER" banner ─────────────────────────────
  doc.setFillColor(...rgb(C_WARN_BG));
  doc.setDrawColor(...rgb(C_WARN_STRIP));
  doc.setLineWidth(0.75);
  doc.roundedRect(MARGIN, y, CONTENT_W, 26, 4, 4, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...rgb(C_WARN_STRIP));
  doc.text(
    "⚠  INTERNAL COPY — NOT FOR CUSTOMER  ·  Contains operational and payment reference data",
    MARGIN + 12,
    y + 17
  );
  y += 40;

  // ── Internal IDs block ────────────────────────────────────────────────
  doc.setFillColor(...rgb(C_HEADER_BG));
  doc.roundedRect(MARGIN, y, CONTENT_W, 14, 2, 2, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...rgb(C_MUTED));
  doc.text("INTERNAL IDENTIFIERS", MARGIN + 8, y + 10);
  y += 20;

  const idPairs: [string, string][] = [
    ["Order UUID",     order.id],
    ["Order Number",   order.orderNumber],
    ["User UUID",      order.userId],
    ["Order Status",   ORDER_STATUS_LABELS[order.status] ?? order.status],
    ["Created",        fmtDateTime(order.createdAt)],
    ["Last Updated",   fmtDateTime(order.updatedAt)],
  ];

  const ID_COL_W = CONTENT_W / 2 - 8;
  idPairs.forEach(([label, value], i) => {
    const colX = MARGIN + (i % 2 === 0 ? 0 : ID_COL_W + 16);
    if (i % 2 === 0 && i > 0) y += 14;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...rgb(C_MUTED));
    doc.text(label, colX, y);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(...rgb(C_TEXT));
    doc.text(value || "—", colX, y + 11, { maxWidth: ID_COL_W });
    if (i % 2 === 1) {
      // nothing — row already advanced above
    }
  });
  y += 28;

  // Notes (internal)
  if (order.notes) {
    doc.setFillColor(...rgb(C_ROW_ALT));
    doc.roundedRect(MARGIN, y, CONTENT_W, 14, 2, 2, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...rgb(C_MUTED));
    doc.text("ORDER NOTES", MARGIN + 8, y + 10);
    y += 20;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...rgb(C_TEXT));
    const noteLines = doc.splitTextToSize(order.notes, CONTENT_W - 16);
    doc.text(noteLines, MARGIN + 8, y);
    y += noteLines.length * 12 + 12;
  }

  doc.setDrawColor(...rgb(C_BORDER));
  doc.setLineWidth(0.75);
  doc.line(MARGIN, y, PAGE_W - MARGIN, y);
  y += 18;

  // ── Customer + Delivery (two columns) ────────────────────────────────
  const COL_W = (CONTENT_W - 16) / 2;
  const COL2_X = MARGIN + COL_W + 16;

  doc.setFillColor(...rgb(C_HEADER_BG));
  doc.roundedRect(MARGIN, y, COL_W, 14, 2, 2, "F");
  doc.roundedRect(COL2_X, y, COL_W, 14, 2, 2, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...rgb(C_MUTED));
  doc.text("CUSTOMER", MARGIN + 8, y + 10);
  doc.text("DELIVERY ADDRESS", COL2_X + 8, y + 10);
  y += 20;

  const addr = order.deliveryAddress;
  const custLines = [
    order.customerName,
    order.customerEmail,
    order.customerPhone,
  ].filter(Boolean) as string[];
  const addrLines = [
    addr.line1 + (addr.line2 ? `, ${addr.line2}` : ""),
    `${addr.city}, ${addr.state} – ${addr.pincode}`,
    addr.country,
  ].filter(Boolean) as string[];

  const baseY = y;
  const lineH = 13;
  custLines.forEach((line, i) => {
    doc.setFont("helvetica", i === 0 ? "bold" : "normal");
    doc.setFontSize(9);
    doc.setTextColor(...rgb(i === 0 ? C_TEXT : C_MUTED));
    doc.text(line, MARGIN + 8, baseY + i * lineH);
  });
  addrLines.forEach((line, i) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...rgb(i === 0 ? C_TEXT : C_MUTED));
    doc.text(line, COL2_X + 8, baseY + i * lineH);
  });

  y = baseY + Math.max(custLines.length, addrLines.length) * lineH + 20;
  doc.setDrawColor(...rgb(C_BORDER));
  doc.line(MARGIN, y, PAGE_W - MARGIN, y);
  y += 18;

  // ── Items table ──────────────────────────────────────────────────────
  const rows = (order.items ?? []).map((item) => [
    item.productName + (item.variantName ? `\n${item.variantName}` : ""),
    item.sku || "—",
    String(item.quantity),
    formatPriceINR(item.unitPricePaise),
    formatPriceINR(item.lineTotalPaise),
  ]);

  autoTable(doc, {
    startY: y,
    margin: { left: MARGIN, right: MARGIN },
    head: [["Product", "SKU", "Qty", "Unit Price", "Line Total"]],
    body: rows,
    styles: {
      font: "helvetica",
      fontSize: 8.5,
      textColor: rgb(C_TEXT),
      cellPadding: { top: 6, right: 8, bottom: 6, left: 8 },
    },
    headStyles: {
      fillColor: rgb(C_WARN_STRIP),
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 8,
    },
    alternateRowStyles: { fillColor: rgb(C_ROW_ALT) },
    columnStyles: {
      1: { fontSize: 7.5, textColor: rgb(C_MUTED) },
      2: { halign: "center", cellWidth: 32 },
      3: { halign: "right", cellWidth: 68 },
      4: { halign: "right", cellWidth: 72, fontStyle: "bold" },
    },
    theme: "grid",
    tableLineColor: rgb(C_BORDER),
    tableLineWidth: 0.5,
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  y = (doc as any).lastAutoTable.finalY + 20;

  // ── Totals block ──────────────────────────────────────────────────────
  const savingsPaise = order.subtotalPaise - order.totalPaise + order.deliveryPaise;
  const TOTALS_X = PAGE_W - MARGIN - 210;

  doc.setFillColor(...rgb(C_HEADER_BG));
  const numTotals = 2 + (savingsPaise > 0 ? 1 : 0) + 2;
  doc.roundedRect(TOTALS_X, y - 6, 210, numTotals * 15 + 24, 4, 4, "F");

  function totRow(label: string, value: string, opts: { bold?: boolean; accent?: boolean } = {}) {
    const { bold = false, accent = false } = opts;
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(bold ? 10.5 : 9);
    doc.setTextColor(...rgb(accent ? C_ACCENT : bold ? C_TEXT : C_MUTED));
    doc.text(label, TOTALS_X + 10, y);
    doc.text(value, PAGE_W - MARGIN - 4, y, { align: "right" });
    y += bold ? 18 : 15;
  }

  totRow("Subtotal", formatPriceINR(order.subtotalPaise));
  if (savingsPaise > 0) totRow("Discount", `− ${formatPriceINR(savingsPaise)}`);
  totRow("Delivery", order.deliveryPaise > 0 ? formatPriceINR(order.deliveryPaise) : "FREE");
  doc.setDrawColor(...rgb(C_BORDER));
  doc.line(TOTALS_X + 4, y - 4, PAGE_W - MARGIN - 4, y - 4);
  y += 4;
  totRow("Order Total", formatPriceINR(order.totalPaise), { bold: true, accent: true });

  y += 18;
  doc.setDrawColor(...rgb(C_BORDER));
  doc.line(MARGIN, y, PAGE_W - MARGIN, y);
  y += 20;

  // ── Payment & Razorpay details ────────────────────────────────────────
  doc.setFillColor(...rgb(C_HEADER_BG));
  doc.roundedRect(MARGIN, y, CONTENT_W, 14, 2, 2, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...rgb(C_MUTED));
  doc.text("PAYMENT & RAZORPAY DETAILS", MARGIN + 8, y + 10);
  y += 22;

  const paymentStatus = order.paymentStatus;
  const statusBg  = paymentStatus === "paid" ? C_SUCCESS_BG : paymentStatus === "failed" ? C_FAIL_BG : C_HEADER_BG;
  const statusTxt = paymentStatus === "paid" ? C_SUCCESS : paymentStatus === "failed" ? C_FAIL : C_MUTED;
  doc.setFillColor(...rgb(statusBg));
  doc.roundedRect(MARGIN, y - 4, 110, 18, 3, 3, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...rgb(statusTxt));
  doc.text(paymentStatus.toUpperCase(), MARGIN + 8, y + 9);
  y += 24;

  const payPairs: [string, string][] = [
    ["Method",          PAYMENT_METHOD_LABELS[order.paymentMethod] ?? order.paymentMethod],
    ["Currency",        "INR"],
    ["Amount",          formatPriceINR(order.totalPaise)],
  ];
  if (order.razorpayOrderId)   payPairs.push(["Razorpay Order ID",   order.razorpayOrderId]);
  if (order.razorpayPaymentId) payPairs.push(["Razorpay Payment ID", order.razorpayPaymentId]);
  if (order.paymentReference)  payPairs.push(["Payment Reference",   order.paymentReference]);

  // paymentError is in the DB column but not yet on StoreOrder type —
  // if it gets added later, uncomment:
  // if ((order as any).paymentError) payPairs.push(["Payment Error", (order as any).paymentError]);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  payPairs.forEach(([label, value]) => {
    doc.setTextColor(...rgb(C_MUTED));
    doc.text(label, MARGIN, y);
    doc.setTextColor(...rgb(C_TEXT));
    doc.text(value || "—", MARGIN + 165, y);
    y += 13;
  });

  // ── Footer ────────────────────────────────────────────────────────────
  const footerY = PAGE_H - 36;
  doc.setFillColor(...rgb(C_WARN_STRIP));
  doc.rect(12, PAGE_H - 20, PAGE_W - 24, 5, "F");

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...rgb(C_MUTED));
  doc.text(
    "INTERNAL USE ONLY  ·  BB Store Admin  ·  Do not share this document with customers or external parties.",
    MARGIN,
    footerY
  );
  doc.text(`Generated ${fmtDateShort(new Date().toISOString())}`, PAGE_W - MARGIN, footerY, { align: "right" });

  return doc;
}

export function downloadAdminReceiptPdf(order: StoreOrder) {
  const doc = buildAdminReceiptPdf(order);
  doc.save(`Internal-${order.orderNumber}.pdf`);
}
