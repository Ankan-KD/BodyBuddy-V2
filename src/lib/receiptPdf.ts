import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { StoreOrder, PAYMENT_METHOD_LABELS } from "./orderTypes";
import { formatPriceINR } from "./storeTypes";

// ════════════════════════════════════════════════════════════════════════
// BB Store — Order Receipt / Tax Invoice PDF  (Customer Copy)
//
// Design: professional letterhead with brand identity, clear visual
// hierarchy, and a polished items table. Uses only the order's stored
// snapshot data (customerName, items[], etc.) so historical receipts
// stay accurate even if the product catalogue or user profile later
// changes. Never contains Razorpay secrets — only the IDs stored on the
// order record itself, which are the customer's own payment references.
//
// ISOMORPHIC BY DESIGN: buildReceiptPdf() has no "use client" directive
// and only touches jsPDF/jspdf-autotable (pure JS, no DOM) plus
// loadFontAsBase64() below, which branches on runtime rather than on
// caller. That means this exact function can run:
//   - in the browser, for the "Download Receipt" button, and
//   - on the server (API routes), for the order-confirmation email
// and produce byte-for-byte the same PDF either way. Do not add any
// browser-only API (window, document, Blob, etc.) directly inside
// buildReceiptPdf — keep that isolated to downloadReceiptPdf() below,
// which stays browser-only on purpose.
// ════════════════════════════════════════════════════════════════════════

// ── Page geometry ────────────────────────────────────────────────────────
const PAGE_W = 595.28; // A4 pt
const PAGE_H = 841.89;
const MARGIN = 44;
const CONTENT_W = PAGE_W - MARGIN * 2;

// ── Palette ───────────────────────────────────────────────────────────────
const C_TEXT       = "#191631";
const C_MUTED      = "#64608a";
const C_BORDER     = "#e2ddf5";
const C_ACCENT     = "#f5601f";
const C_ACCENT_BG  = "#fff4ef";
const C_HEADER_BG  = "#f6f4fd";
const C_SUCCESS    = "#1a9f6b";
const C_SUCCESS_BG = "#e6f7f2";
const C_WARN_BG    = "#fff8e6";
const C_WARN       = "#b45309";

function rgb(hex: string): [number, number, number] {
  const v = hex.replace("#", "");
  return [parseInt(v.slice(0, 2), 16), parseInt(v.slice(2, 4), 16), parseInt(v.slice(4, 6), 16)];
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function fmtDateShort(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// Loads a font file (from /public/fonts) as base64, the same way regardless
// of caller: browser code fetches it over HTTP; server code (no `window`,
// e.g. an API route building the email attachment) reads the identical
// file straight off disk instead of making a loopback HTTP request. Either
// path yields the exact same font bytes, so the rendered PDF is identical.
//
// PERF: font bytes never change at runtime, but this used to be re-read
// from disk (or re-fetched over HTTP in the browser) on every single PDF
// build — including once per admin order-status update. Cache the
// resulting base64 string per URL, and cache the in-flight promise too so
// concurrent buildReceiptPdf() calls racing on a cold cache share one
// read instead of issuing duplicate disk reads / fetches.
const fontBase64Cache = new Map<string, Promise<string>>();

async function loadFontAsBase64(url: string): Promise<string> {
  const cached = fontBase64Cache.get(url);
  if (cached) return cached;

  const promise = (async () => {
    let bytes: Uint8Array;

    if (typeof window === "undefined") {
      // Server-side (Node): "url" is a public-relative path like
      // "/fonts/NotoSans-Regular.ttf" — resolve it against the Next.js
      // project's /public directory, which is what that path serves in
      // the browser too.
      const { readFile } = await import("fs/promises");
      const path = await import("path");
      const filePath = path.join(process.cwd(), "public", url);
      bytes = new Uint8Array(await readFile(filePath));
    } else {
      const response = await fetch(url);
      const buffer = await response.arrayBuffer();
      bytes = new Uint8Array(buffer);
    }

    let binary = "";

    for (let i = 0; i < bytes.length; i += 0x8000) {
      binary += String.fromCharCode(
        ...bytes.subarray(i, Math.min(i + 0x8000, bytes.length))
      );
    }

    return btoa(binary);
  })();

  // If the read/fetch fails, don't poison the cache with a rejected
  // promise — let the next call retry from scratch.
  promise.catch(() => fontBase64Cache.delete(url));

  fontBase64Cache.set(url, promise);
  return promise;
}
export async function buildReceiptPdf(order: StoreOrder): Promise<jsPDF> {
const doc = new jsPDF({ unit: "pt", format: "a4" });

const regularFont = await loadFontAsBase64("/fonts/NotoSans-Regular.ttf");
const boldFont = await loadFontAsBase64("/fonts/NotoSans-Bold.ttf");

doc.addFileToVFS("NotoSans-Regular.ttf", regularFont);
doc.addFont("NotoSans-Regular.ttf", "NotoSans", "normal");

doc.addFileToVFS("NotoSans-Bold.ttf", boldFont);
doc.addFont("NotoSans-Bold.ttf", "NotoSans", "bold");

let y = 0;

  // ── Subtle page border / background rule ─────────────────────────────
  doc.setDrawColor(...rgb(C_BORDER));
  doc.setLineWidth(0.5);
  doc.rect(12, 12, PAGE_W - 24, PAGE_H - 24);

  // ── Brand header strip ───────────────────────────────────────────────
  // Orange accent bar top
  doc.setFillColor(...rgb(C_ACCENT));
  doc.rect(12, 12, PAGE_W - 24, 5, "F");

  y = 42;

  // Store name (left)
  doc.setFont("NotoSans", "bold");
  doc.setFontSize(22);
  doc.setTextColor(...rgb(C_TEXT));
  doc.text("BB Store", MARGIN, y);

  // Tagline under store name
  doc.setFont("NotoSans", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...rgb(C_MUTED));
  doc.text("Fuel Your Goals", MARGIN, y + 14);

  // Document title (right, top-aligned)
  doc.setFont("NotoSans", "bold");
  doc.setFontSize(14);
  doc.setTextColor(...rgb(C_TEXT));
  doc.text("TAX INVOICE", PAGE_W - MARGIN, y, { align: "right" });

  // Order number + date (right, below title)
  doc.setFont("NotoSans", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...rgb(C_MUTED));
  doc.text(`Order ${order.orderNumber}`, PAGE_W - MARGIN, y + 16, { align: "right" });
  doc.text(fmtDate(order.createdAt), PAGE_W - MARGIN, y + 28, { align: "right" });

  y += 48;

  // Rule beneath header
  doc.setDrawColor(...rgb(C_BORDER));
  doc.setLineWidth(1);
  doc.line(MARGIN, y, PAGE_W - MARGIN, y);
  y += 20;

  // ── Payment status chip ──────────────────────────────────────────────
  const isPaid = order.paymentStatus === "paid";
  const chipBg  = isPaid ? C_SUCCESS_BG : C_WARN_BG;
  const chipTxt = isPaid ? C_SUCCESS : C_WARN;
  const chipBdr = isPaid ? C_SUCCESS : C_WARN;
  const chipLabel = isPaid
    ? "✓  Payment Successful — Order Confirmed"
    : `Payment Status: ${order.paymentStatus.toUpperCase()}`;

  doc.setFillColor(...rgb(chipBg));
  doc.setDrawColor(...rgb(chipBdr));
  doc.setLineWidth(0.75);
  doc.roundedRect(MARGIN, y, CONTENT_W, 28, 5, 5, "FD");
  doc.setFont("NotoSans", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...rgb(chipTxt));
  doc.text(chipLabel, MARGIN + 14, y + 18);

  y += 44;

  // ── Customer / Delivery two-column block ─────────────────────────────
  const COL_W = (CONTENT_W - 16) / 2;
  const COL2_X = MARGIN + COL_W + 16;

  // Section backgrounds
  doc.setFillColor(...rgb(C_HEADER_BG));
  doc.roundedRect(MARGIN, y, COL_W, 14, 2, 2, "F");
  doc.roundedRect(COL2_X, y, COL_W, 14, 2, 2, "F");

  doc.setFont("NotoSans", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(...rgb(C_MUTED));
  doc.text("BILLED TO", MARGIN + 8, y + 10);
  doc.text("SHIP TO", COL2_X + 8, y + 10);
  y += 22;

  const addr = order.deliveryAddress;
  const custLines = [
    order.customerName,
    order.customerEmail,
    order.customerPhone,
  ].filter(Boolean) as string[];
  const addrLines = [
    order.customerName,
    addr.line1 + (addr.line2 ? `, ${addr.line2}` : ""),
    `${addr.city}, ${addr.state} – ${addr.pincode}`,
    addr.country,
  ].filter(Boolean) as string[];

  doc.setFont("NotoSans", "normal");
  doc.setFontSize(9.5);
  const lineH = 13;
  const baseY = y;
  custLines.forEach((line, i) => {
    const isBold = i === 0;
    doc.setFont("NotoSans", isBold ? "bold" : "normal");
    doc.setTextColor(...rgb(isBold ? C_TEXT : C_MUTED));
    doc.text(line, MARGIN + 8, baseY + i * lineH);
  });
  addrLines.forEach((line, i) => {
    const isBold = i === 0;
    doc.setFont("NotoSans", isBold ? "bold" : "normal");
    doc.setTextColor(...rgb(isBold ? C_TEXT : C_MUTED));
    doc.text(line, COL2_X + 8, baseY + i * lineH);
  });

  y = baseY + Math.max(custLines.length, addrLines.length) * lineH + 22;

  doc.setDrawColor(...rgb(C_BORDER));
  doc.setLineWidth(0.75);
  doc.line(MARGIN, y, PAGE_W - MARGIN, y);
  y += 20;

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
    head: [["Product", "SKU", "Qty", "Unit Price", "Amount"]],
    body: rows,
    styles: {
      font: "NotoSans",
      fontSize: 9,
      textColor: rgb(C_TEXT),
      cellPadding: { top: 7, right: 8, bottom: 7, left: 8 },
    },
    headStyles: {
      fillColor: rgb(C_TEXT),
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 8.5,
    },
    alternateRowStyles: { fillColor: rgb(C_HEADER_BG) },
    columnStyles: {
      0: { cellWidth: "auto" },
      1: { cellWidth: 72, fontSize: 8, textColor: rgb(C_MUTED) },
      2: { cellWidth: 32, halign: "center" },
      3: { cellWidth: 68, halign: "right" },
      4: { cellWidth: 68, halign: "right", fontStyle: "bold" },
    },
    theme: "grid",
    tableLineColor: rgb(C_BORDER),
    tableLineWidth: 0.5,
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  y = (doc as any).lastAutoTable.finalY + 24;

  // ── Totals block ─────────────────────────────────────────────────────
  const savingsPaise = order.subtotalPaise - order.totalPaise + order.deliveryPaise;
  const TOTALS_X = PAGE_W - MARGIN - 220;
  const TOTALS_W = 220;

  // Totals background
  doc.setFillColor(...rgb(C_HEADER_BG));
  const totalRows = 2 + (savingsPaise > 0 ? 1 : 0) + 1; // sub + optional discount + delivery + total
  const totalsH = totalRows * 16 + 32;
  doc.roundedRect(TOTALS_X, y - 8, TOTALS_W, totalsH, 4, 4, "F");

  function totalRow(label: string, value: string, opts: { bold?: boolean; accent?: boolean; green?: boolean } = {}) {
    const { bold = false, accent = false, green = false } = opts;
    doc.setFont("NotoSans", bold ? "bold" : "normal");
    doc.setFontSize(bold ? 11 : 9.5);
    const txtColor = accent ? C_ACCENT : green ? C_SUCCESS : bold ? C_TEXT : C_MUTED;
    doc.setTextColor(...rgb(txtColor));
    doc.text(label, TOTALS_X + 12, y);
    doc.text(value, PAGE_W - MARGIN - 4, y, { align: "right" });
    y += bold ? 20 : 16;
  }

  totalRow("Subtotal", formatPriceINR(order.subtotalPaise));
  if (savingsPaise > 0) totalRow("Discount", `− ${formatPriceINR(savingsPaise)}`, { green: true });
  totalRow("Delivery", order.deliveryPaise > 0 ? formatPriceINR(order.deliveryPaise) : "FREE", {
    green: order.deliveryPaise === 0,
  });

  // Divider before grand total
  doc.setDrawColor(...rgb(C_BORDER));
  doc.setLineWidth(0.75);
  doc.line(TOTALS_X + 4, y - 4, PAGE_W - MARGIN - 4, y - 4);
  y += 6;
  totalRow("Total Paid", formatPriceINR(order.totalPaise), { bold: true, accent: true });

  y += 18;

  // ── Section divider ──────────────────────────────────────────────────
  doc.setDrawColor(...rgb(C_BORDER));
  doc.setLineWidth(0.75);
  doc.line(MARGIN, y, PAGE_W - MARGIN, y);
  y += 22;

  // ── Payment details ───────────────────────────────────────────────────
  doc.setFont("NotoSans", "bold");
  doc.setFontSize(9.5);
  doc.setTextColor(...rgb(C_TEXT));
  doc.text("Payment Details", MARGIN, y);
  y += 16;

  const payRows: [string, string][] = [
    ["Method", PAYMENT_METHOD_LABELS[order.paymentMethod] ?? order.paymentMethod],
    ["Status", order.paymentStatus.charAt(0).toUpperCase() + order.paymentStatus.slice(1)],
    ["Currency", "INR"],
    ["Amount paid", formatPriceINR(order.totalPaise)],
  ];
  if (order.razorpayPaymentId) payRows.push(["Razorpay payment ID", order.razorpayPaymentId]);
  if (order.razorpayOrderId)   payRows.push(["Razorpay order ID",   order.razorpayOrderId]);
  if (order.paymentReference)  payRows.push(["Payment reference",   order.paymentReference]);

  doc.setFont("NotoSans", "normal");
  doc.setFontSize(9);
  payRows.forEach(([label, value]) => {
    doc.setTextColor(...rgb(C_MUTED));
    doc.text(label, MARGIN, y);
    doc.setTextColor(...rgb(C_TEXT));
    doc.text(value, MARGIN + 170, y);
    y += 13;
  });

  // ── Footer ───────────────────────────────────────────────────────────
  const footerY = PAGE_H - 36;
  doc.setFillColor(...rgb(C_ACCENT));
  doc.rect(12, PAGE_H - 20, PAGE_W - 24, 5, "F");

  doc.setFont("NotoSans", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...rgb(C_MUTED));
  doc.text("BB Store  ·  support@bbstore.example  ·  This is a computer-generated receipt and does not require a signature.", MARGIN, footerY);
  doc.text(`Generated ${fmtDateShort(new Date().toISOString())}`, PAGE_W - MARGIN, footerY, { align: "right" });

  return doc;
}

export async function downloadReceiptPdf(order: StoreOrder) {
  const doc = await buildReceiptPdf(order);
  doc.save(`Receipt-${order.orderNumber}.pdf`);
}
