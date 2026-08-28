"use client";

// ════════════════════════════════════════════════════════════════════════
// BB Store Admin — Phase 8: Order Detail Page
// Full order view with status management for admin.
// ════════════════════════════════════════════════════════════════════════

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Package,
  MapPin,
  CreditCard,
  User,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Printer,
  Download,
} from "lucide-react";
import {
  adminFetchOrderById,
  adminUpdateOrderStatus,
  adminFetchSettings,
} from "@/lib/storeAdminApi";
import type { StoreOrder, OrderStatus } from "@/lib/orderTypes";
import {
  ORDER_STATUS_LABELS,
  ORDER_STATUS_COLORS,
  PAYMENT_METHOD_LABELS,
} from "@/lib/orderTypes";
import type { StoreSettings } from "@/lib/offerTypes";
import { formatPriceINR } from "@/lib/cartContext";
import { cn } from "@/lib/utils";
import { downloadReceiptPdf } from "@/lib/receiptPdf";
import { printShippingLabel, downloadShippingLabel } from "@/lib/shippingLabelPdf";

// ── Status lifecycle definition ───────────────────────────────────────────

const STATUS_FLOW: OrderStatus[] = [
  "placed",
  "confirmed",
  "processing",
  "shipped",
  "delivered",
];

// Which transitions are allowed from each status
const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  placed:     ["confirmed", "cancelled"],
  confirmed:  ["processing", "cancelled"],
  processing: ["shipped", "cancelled"],
  shipped:    ["delivered", "cancelled"],
  delivered:  [],
  cancelled:  [],
};

// ── Status badge ──────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: OrderStatus }) {
  const map: Record<OrderStatus, string> = {
    placed:     "a-badge-orange",
    confirmed:  "a-badge-blue",
    processing: "a-badge-purple",
    shipped:    "a-badge-indigo",
    delivered:  "a-badge-green",
    cancelled:  "a-badge-red",
  };
  return (
    <span className={`a-badge ${map[status] ?? "a-badge-neutral"}`}>
      {ORDER_STATUS_LABELS[status]}
    </span>
  );
}

// ── Section card wrapper ──────────────────────────────────────────────────

function Section({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
}) {
  return (
    <div className="a-card">
      <div className="a-card-header">
        <h2 className="a-card-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Icon style={{ width: 15, height: 15, color: "var(--a-accent)" }} />
          {title}
        </h2>
      </div>
      <div className="a-card-body">{children}</div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────

export default function AdminOrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [order, setOrder] = useState<StoreOrder | null>(null);
  const [settings, setSettings] = useState<StoreSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (!id) return;
    Promise.all([adminFetchOrderById(id), adminFetchSettings()]).then(([o, s]) => {
      setOrder(o);
      setSettings(s);
      setLoading(false);
    });
  }, [id]);

  async function handleStatusChange(newStatus: OrderStatus) {
    if (!order) return;
    setUpdating(true);
    setSuccessMsg("");
    setErrorMsg("");

    const err = await adminUpdateOrderStatus(order.id, newStatus);
    if (err) {
      setErrorMsg(`Failed to update status: ${err}`);
    } else {
      setOrder({ ...order, status: newStatus, updatedAt: new Date().toISOString() });
      setSuccessMsg(`Order status updated to "${ORDER_STATUS_LABELS[newStatus]}".`);
      setTimeout(() => setSuccessMsg(""), 3000);
    }
    setUpdating(false);
  }

  // ── Loading ──────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="a-page">
        <div style={{ display: "flex", justifyContent: "center", padding: "80px 0" }}>
          <RefreshCw style={{ width: 24, height: 24, animation: "spin 1s linear infinite", color: "var(--a-text-muted)" }} />
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="a-page">
        <div className="a-empty" style={{ marginTop: 80 }}>
          <Package className="a-empty-icon" />
          <p className="a-empty-title">Order not found</p>
          <p className="a-empty-sub">This order may have been deleted.</p>
          <Link href="/admin/orders" className="a-btn a-btn-primary a-btn-sm" style={{ marginTop: 16 }}>
            ← Back to Orders
          </Link>
        </div>
      </div>
    );
  }

  const allowedNext = ALLOWED_TRANSITIONS[order.status];
  const savingsPaise = order.subtotalPaise - order.totalPaise + order.deliveryPaise;

  return (
    <div className="a-page">
      {/* ── Header ── */}
      <div className="a-page-header">
        <div className="a-page-title-group">
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
            <Link href="/admin/orders" className="a-btn a-btn-ghost a-btn-icon a-btn-sm">
              <ArrowLeft style={{ width: 14, height: 14 }} />
            </Link>
            <h1 className="a-page-title" style={{ margin: 0 }}>
              Order {order.orderNumber}
            </h1>
            <StatusBadge status={order.status} />
          </div>
          <p className="a-page-subtitle">
            Placed {new Date(order.createdAt).toLocaleDateString("en-IN", {
              day: "numeric", month: "long", year: "numeric",
            })}
            {" · "}
            Updated {new Date(order.updatedAt).toLocaleDateString("en-IN", {
              day: "numeric", month: "short",
            })}
          </p>
        </div>
      </div>

      {/* ── Feedback messages ── */}
      {successMsg && (
        <div className="a-alert a-alert-success" style={{ marginBottom: 16 }}>
          <CheckCircle2 style={{ width: 14, height: 14 }} />
          {successMsg}
        </div>
      )}
      {errorMsg && (
        <div className="a-alert a-alert-error" style={{ marginBottom: 16 }}>
          <AlertTriangle style={{ width: 14, height: 14 }} />
          {errorMsg}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 20, alignItems: "start" }}>
        {/* ── Left column ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Order Items */}
          <Section title="Order Items" icon={Package}>
            <table className="a-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Variant</th>
                  <th>SKU</th>
                  <th>Qty</th>
                  <th>Unit Price</th>
                  <th style={{ textAlign: "right" }}>Line Total</th>
                </tr>
              </thead>
              <tbody>
                {(order.items ?? []).map((item) => (
                  <tr key={item.id}>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div
                          style={{
                            width: 40, height: 40, borderRadius: 8, overflow: "hidden",
                            background: "var(--a-surface-2)", display: "flex",
                            alignItems: "center", justifyContent: "center", flexShrink: 0,
                          }}
                        >
                          {item.imageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={item.imageUrl} alt={item.productName} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                          ) : (
                            <Package style={{ width: 16, height: 16, color: "var(--a-text-muted)" }} />
                          )}
                        </div>
                        <span style={{ fontWeight: 500, fontSize: 13 }}>{item.productName}</span>
                      </div>
                    </td>
                    <td style={{ fontSize: 12, color: "var(--a-text-muted)" }}>{item.variantName || "—"}</td>
                    <td style={{ fontSize: 11, fontFamily: "monospace", color: "var(--a-text-muted)" }}>{item.sku}</td>
                    <td style={{ fontSize: 13 }}>{item.quantity}</td>
                    <td style={{ fontSize: 13 }}>{formatPriceINR(item.unitPricePaise)}</td>
                    <td style={{ textAlign: "right", fontWeight: 600, fontSize: 13 }}>
                      {formatPriceINR(item.lineTotalPaise)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Price breakdown */}
            <div style={{ borderTop: "1px solid var(--a-border)", paddingTop: 16, marginTop: 8 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, maxWidth: 300, marginLeft: "auto" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "var(--a-text-muted)" }}>
                  <span>Subtotal</span>
                  <span>{formatPriceINR(order.subtotalPaise)}</span>
                </div>
                {savingsPaise > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "var(--a-success)" }}>
                    <span>Discount</span>
                    <span>−{formatPriceINR(savingsPaise)}</span>
                  </div>
                )}
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "var(--a-text-muted)" }}>
                  <span>Delivery</span>
                  <span style={{ color: "var(--a-success)" }}>Free</span>
                </div>
                <div style={{
                  display: "flex", justifyContent: "space-between", fontSize: 15,
                  fontWeight: 700, borderTop: "1px solid var(--a-border)", paddingTop: 10, marginTop: 4,
                }}>
                  <span>Total</span>
                  <span style={{ color: "var(--a-accent)" }}>{formatPriceINR(order.totalPaise)}</span>
                </div>
              </div>
            </div>
          </Section>

          {/* Customer Info */}
          <Section title="Customer" icon={User}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div>
                <p style={{ fontSize: 11, color: "var(--a-text-muted)", marginBottom: 4 }}>Name</p>
                <p style={{ fontSize: 13, fontWeight: 500 }}>{order.customerName}</p>
              </div>
              <div>
                <p style={{ fontSize: 11, color: "var(--a-text-muted)", marginBottom: 4 }}>Email</p>
                <p style={{ fontSize: 13 }}>{order.customerEmail}</p>
              </div>
              <div>
                <p style={{ fontSize: 11, color: "var(--a-text-muted)", marginBottom: 4 }}>Phone</p>
                <p style={{ fontSize: 13 }}>{order.customerPhone || "—"}</p>
              </div>
              {order.notes && (
                <div style={{ gridColumn: "1 / -1" }}>
                  <p style={{ fontSize: 11, color: "var(--a-text-muted)", marginBottom: 4 }}>Customer Notes</p>
                  <p style={{ fontSize: 13 }}>{order.notes}</p>
                </div>
              )}
            </div>
          </Section>

          {/* Delivery Address */}
          <Section title="Delivery Address" icon={MapPin}>
            <address style={{ fontStyle: "normal", fontSize: 13, lineHeight: 1.7 }}>
              <strong>{order.customerName}</strong><br />
              {order.deliveryAddress.line1}
              {order.deliveryAddress.line2 && (<>, {order.deliveryAddress.line2}<br /></>)}
              <br />
              {order.deliveryAddress.city}, {order.deliveryAddress.state} – {order.deliveryAddress.pincode}<br />
              {order.deliveryAddress.country}
            </address>
          </Section>
        </div>

        {/* ── Right column ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Status Management */}
          <div className="a-card">
            <div className="a-card-header">
              <h2 className="a-card-title">Order Status</h2>
            </div>
            <div className="a-card-body" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {/* Progress steps */}
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {STATUS_FLOW.map((s, i) => {
                  const currentIdx = order.status === "cancelled" ? -1 : STATUS_FLOW.indexOf(order.status);
                  const done = i <= currentIdx;
                  const active = i === currentIdx;
                  return (
                    <div key={s} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{
                        width: 20, height: 20, borderRadius: "50%", flexShrink: 0,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        background: done
                          ? active ? "var(--a-accent)" : "var(--a-success)"
                          : "var(--a-border)",
                        fontSize: 10, fontWeight: 700, color: done ? "white" : "var(--a-text-muted)",
                      }}>
                        {done && !active ? "✓" : i + 1}
                      </div>
                      <span style={{
                        fontSize: 13, fontWeight: active ? 600 : 400,
                        color: active ? "var(--a-accent)" : done ? "var(--a-text)" : "var(--a-text-muted)",
                      }}>
                        {ORDER_STATUS_LABELS[s]}
                      </span>
                    </div>
                  );
                })}
                {order.status === "cancelled" && (
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{
                      width: 20, height: 20, borderRadius: "50%", flexShrink: 0,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      background: "var(--a-error)", fontSize: 10, fontWeight: 700, color: "white",
                    }}>✕</div>
                    <span style={{ fontSize: 13, fontWeight: 600, color: "var(--a-error)" }}>Cancelled</span>
                  </div>
                )}
              </div>

              {/* Action buttons */}
              {allowedNext.length > 0 && (
                <div style={{ borderTop: "1px solid var(--a-border)", paddingTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                  <p style={{ fontSize: 11, color: "var(--a-text-muted)", marginBottom: 4 }}>Update Status</p>
                  {allowedNext.map((ns) => (
                    <button
                      key={ns}
                      onClick={() => handleStatusChange(ns)}
                      disabled={updating}
                      className={`a-btn a-btn-sm ${ns === "cancelled" ? "a-btn-danger" : "a-btn-primary"}`}
                      style={{ width: "100%" }}
                    >
                      {updating ? "Updating…" : `Mark as ${ORDER_STATUS_LABELS[ns]}`}
                    </button>
                  ))}
                </div>
              )}

              {allowedNext.length === 0 && (
                <p style={{ fontSize: 12, color: "var(--a-text-muted)", textAlign: "center" }}>
                  {order.status === "delivered" ? "Order complete." : "No further actions available."}
                </p>
              )}
            </div>
          </div>

          {/* Payment Info */}
          <Section title="Payment" icon={CreditCard}>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: 12, color: "var(--a-text-muted)" }}>Method</span>
                <span style={{ fontSize: 13, fontWeight: 500 }}>{PAYMENT_METHOD_LABELS[order.paymentMethod]}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: 12, color: "var(--a-text-muted)" }}>Payment Status</span>
                <span className={`a-badge ${order.paymentStatus === "paid" ? "a-badge-green" : order.paymentStatus === "failed" ? "a-badge-red" : "a-badge-orange"}`}>
                  {order.paymentStatus.charAt(0).toUpperCase() + order.paymentStatus.slice(1)}
                </span>
              </div>
              {order.razorpayOrderId && (
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 12, color: "var(--a-text-muted)" }}>Razorpay Order ID</span>
                  <span style={{ fontSize: 11, fontFamily: "monospace" }}>{order.razorpayOrderId}</span>
                </div>
              )}
              {order.razorpayPaymentId && (
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 12, color: "var(--a-text-muted)" }}>Razorpay Payment ID</span>
                  <span style={{ fontSize: 11, fontFamily: "monospace" }}>{order.razorpayPaymentId}</span>
                </div>
              )}
              {order.paymentReference && (
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 12, color: "var(--a-text-muted)" }}>Reference</span>
                  <span style={{ fontSize: 11, fontFamily: "monospace" }}>{order.paymentReference}</span>
                </div>
              )}
              <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid var(--a-border)", paddingTop: 10, marginTop: 4 }}>
                <span style={{ fontSize: 13, fontWeight: 600 }}>Amount</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: "var(--a-accent)" }}>
                  {formatPriceINR(order.totalPaise)}
                </span>
              </div>
            </div>
          </Section>

          {/* Documents */}
          <div className="a-card">
            <div className="a-card-header">
              <h2 className="a-card-title">Documents</h2>
            </div>
            <div className="a-card-body" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <button
                onClick={() => downloadReceiptPdf(order)}
                className="a-btn a-btn-ghost a-btn-sm"
                style={{ width: "100%", justifyContent: "center" }}
              >
                <Download style={{ width: 14, height: 14 }} /> Download Receipt
              </button>
              <button
                onClick={() => settings && printShippingLabel(order, settings)}
                disabled={!settings}
                className="a-btn a-btn-primary a-btn-sm"
                style={{ width: "100%", justifyContent: "center" }}
              >
                <Printer style={{ width: 14, height: 14 }} /> Print Label
              </button>
              <button
                onClick={() => settings && downloadShippingLabel(order, settings)}
                disabled={!settings}
                className="a-btn a-btn-ghost a-btn-sm"
                style={{ width: "100%", justifyContent: "center" }}
              >
                <Download style={{ width: 14, height: 14 }} /> Download Label
              </button>
              <p style={{ fontSize: 11, color: "var(--a-text-muted)", marginTop: 2 }}>
                The shipping label contains delivery details only — no
                pricing or payment information.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
