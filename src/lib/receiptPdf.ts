import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { StoreOrder } from "./orderTypes";
import { formatPriceINR } from "./storeTypes";

// ════════════════════════════════════════════════════════════════════════
// BB Store — Order Receipt / Invoice PDF
// Intentionally basic layout (per spec) — an application-generated
// receipt, never a dump of the raw Razorpay response, and never
// containing Razorpay secrets. Uses the order's own stored snapshot data
// so historical receipts stay accurate even if the product/profile later
// changes.
// ════════════════════════════════════════════════════════════════════════

const PAGE_W = 595.28; // A4 pt
const MARGIN = 40;
const CONTENT_W = PAGE_W - MARGIN * 2;
const TEXT = "#191631";
const TEXT_MUTED = "#64608a";
const BORDER = "#e2ddf5";
const ACCENT = "#f5601f";

function hexToRgb(hex: string): [number, number, number] {
  const v = hex.replace("#", "");
  return [parseInt(v.slice(0, 2), 16), parseInt(v.slice(2, 4), 16), parseInt(v.slice(4, 6), 16)];
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function buildReceiptPdf(order: StoreOrder): jsPDF {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  let y = MARGIN;

  // ── Header ──────────────────────────────────────────────────────────
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(...hexToRgb(TEXT));
  doc.text("BB Store", MARGIN, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...hexToRgb(TEXT_MUTED));
  doc.text("Order Receipt", MARGIN, y + 16);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...hexToRgb(TEXT));
  doc.text(`Order ${order.orderNumber}`, PAGE_W - MARGIN, y, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...hexToRgb(TEXT_MUTED));
  doc.text(formatDate(order.createdAt), PAGE_W - MARGIN, y + 14, { align: "right" });

  y += 34;
  doc.setDrawColor(...hexToRgb(BORDER));
  doc.setLineWidth(1);
  doc.line(MARGIN, y, PAGE_W - MARGIN, y);
  y += 20;

  // ── Payment success banner ─────────────────────────────────────────
  doc.setFillColor(...hexToRgb("#e8f8f0"));
  doc.roundedRect(MARGIN, y, CONTENT_W, 30, 4, 4, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...hexToRgb("#1a9f6b"));
  doc.text(
    order.paymentStatus === "paid" ? "Payment successful — order placed" : `Payment status: ${order.paymentStatus}`,
    MARGIN + 12,
    y + 19
  );
  y += 46;

  // ── Customer / Delivery two-column block ───────────────────────────
  const colW = (CONTENT_W - 20) / 2;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...hexToRgb(TEXT));
  doc.text("Customer", MARGIN, y);
  doc.text("Delivery Address", MARGIN + colW + 20, y);
  y += 14;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(...hexToRgb(TEXT_MUTED));
  const custLines = [order.customerName, order.customerEmail, order.customerPhone];
  const addr = order.deliveryAddress;
  const addrLines = [
    addr.line1 + (addr.line2 ? `, ${addr.line2}` : ""),
    `${addr.city}, ${addr.state} – ${addr.pincode}`,
    addr.country,
  ];
  const startY = y;
  custLines.forEach((line, i) => doc.text(line || "—", MARGIN, startY + i * 13));
  addrLines.forEach((line, i) => doc.text(line || "—", MARGIN + colW + 20, startY + i * 13));
  y = startY + Math.max(custLines.length, addrLines.length) * 13 + 20;

  doc.setDrawColor(...hexToRgb(BORDER));
  doc.line(MARGIN, y, PAGE_W - MARGIN, y);
  y += 18;

  // ── Items table ─────────────────────────────────────────────────────
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
    head: [["Product", "SKU", "Qty", "Unit Price", "Amount"]],
    body: rows,
    styles: { font: "helvetica", fontSize: 9, textColor: hexToRgb(TEXT), cellPadding: 6 },
    headStyles: { fillColor: hexToRgb("#f6f4fd"), textColor: hexToRgb(TEXT), fontStyle: "bold" },
    columnStyles: {
      2: { halign: "center" },
      3: { halign: "right" },
      4: { halign: "right" },
    },
    theme: "grid",
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  y = (doc as any).lastAutoTable.finalY + 20;

  // ── Totals ──────────────────────────────────────────────────────────
  const savingsPaise = order.subtotalPaise - order.totalPaise + order.deliveryPaise;
  const totalsX = PAGE_W - MARGIN - 200;
  function totalLine(label: string, value: string, bold = false) {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(bold ? 11 : 9.5);
    doc.setTextColor(...hexToRgb(bold ? TEXT : TEXT_MUTED));
    doc.text(label, totalsX, y);
    doc.text(value, PAGE_W - MARGIN, y, { align: "right" });
    y += bold ? 18 : 14;
  }
  totalLine("Subtotal", formatPriceINR(order.subtotalPaise));
  if (savingsPaise > 0) totalLine("Discount", `−${formatPriceINR(savingsPaise)}`);
  totalLine("Delivery", order.deliveryPaise > 0 ? formatPriceINR(order.deliveryPaise) : "Free");
  doc.setDrawColor(...hexToRgb(BORDER));
  doc.line(totalsX, y - 4, PAGE_W - MARGIN, y - 4);
  y += 6;
  totalLine("Total Paid", formatPriceINR(order.totalPaise), true);

  y += 12;
  doc.setDrawColor(...hexToRgb(BORDER));
  doc.line(MARGIN, y, PAGE_W - MARGIN, y);
  y += 20;

  // ── Payment details ─────────────────────────────────────────────────
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...hexToRgb(TEXT));
  doc.text("Payment Details", MARGIN, y);
  y += 16;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(...hexToRgb(TEXT_MUTED));
  const paymentRows: [string, string][] = [
    ["Payment method", order.paymentMethod.toUpperCase()],
    ["Payment status", order.paymentStatus.toUpperCase()],
    ["Currency", "INR"],
    ["Amount paid", formatPriceINR(order.totalPaise)],
  ];
  if (order.razorpayPaymentId) paymentRows.push(["Razorpay payment ID", order.razorpayPaymentId]);
  if (order.razorpayOrderId) paymentRows.push(["Razorpay order ID", order.razorpayOrderId]);
  paymentRows.forEach(([label, value]) => {
    doc.text(label, MARGIN, y);
    doc.text(value, MARGIN + 180, y);
    y += 13;
  });

  // ── Footer ──────────────────────────────────────────────────────────
  const pageH = doc.internal.pageSize.getHeight();
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...hexToRgb(TEXT_MUTED));
  doc.text("BB Store — this receipt was generated automatically.", MARGIN, pageH - 30);
  doc.text(`Generated ${new Date().toLocaleDateString("en-IN")}`, PAGE_W - MARGIN, pageH - 30, { align: "right" });

  return doc;
}

export function downloadReceiptPdf(order: StoreOrder) {
  const doc = buildReceiptPdf(order);
  doc.save(`Receipt-${order.orderNumber}.pdf`);
}
