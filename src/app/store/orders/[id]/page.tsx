"use client";

// ════════════════════════════════════════════════════════════════════════
// BB Store — Phase 7: Order Detail Page
// Shows full order details after placing or when viewing from order history.
// ════════════════════════════════════════════════════════════════════════

import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Package,
  MapPin,
  CreditCard,
  CheckCircle2,
  ChevronRight,
  Truck,
  Copy,
  Check,
  Download,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { fetchOrderById } from "@/lib/orderApi";
import {
  StoreOrder,
  ORDER_STATUS_LABELS,
  ORDER_STATUS_COLORS,
  PAYMENT_METHOD_LABELS,
} from "@/lib/orderTypes";
import { formatPriceINR } from "@/lib/cartContext";
import { cn } from "@/lib/utils";
import { downloadReceiptPdf } from "@/lib/receiptPdf";

// ── Status progress tracker ───────────────────────────────────────────────

const STATUS_STEPS = [
  "placed",
  "confirmed",
  "processing",
  "shipped",
  "delivered",
] as const;

function StatusTracker({ status }: { status: StoreOrder["status"] }) {
  if (status === "cancelled") {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/20">
        <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
        <span className="text-sm font-medium text-red-600 dark:text-red-300">
          This order has been cancelled
        </span>
      </div>
    );
  }

  const currentIdx = STATUS_STEPS.indexOf(status as (typeof STATUS_STEPS)[number]);

  return (
    <div className="space-y-2">
      {STATUS_STEPS.map((s, i) => {
        const done = i <= currentIdx;
        const active = i === currentIdx;
        return (
          <div key={s} className="flex items-center gap-3">
            <div
              className={cn(
                "w-5 h-5 rounded-full flex items-center justify-center shrink-0 transition-colors",
                done
                  ? active
                    ? "bg-amber-500"
                    : "bg-emerald-500"
                  : "bg-[var(--border)]"
              )}
            >
              {done && !active && <Check className="w-3 h-3 text-white" />}
              {active && <span className="w-2 h-2 rounded-full bg-white" />}
            </div>
            <span
              className={cn(
                "text-xs font-medium",
                active
                  ? "text-amber-500"
                  : done
                  ? "text-[var(--text-primary)]"
                  : "text-[var(--text-muted)]"
              )}
            >
              {ORDER_STATUS_LABELS[s]}
            </span>
            {i < STATUS_STEPS.length - 1 && (
              <div className="flex-1" />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Copy button ───────────────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  function handleCopy() {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }
  return (
    <button
      onClick={handleCopy}
      className="p-1 rounded-lg text-[var(--text-muted)] hover:text-amber-500 transition-colors"
    >
      {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

// ── Main component ────────────────────────────────────────────────────────

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const justPlaced = searchParams.get("placed") === "1";
  const { user } = useAuth();

  const [order, setOrder] = useState<StoreOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!user || !id) return;
    fetchOrderById(id, user.id).then((o) => {
      if (!o) setNotFound(true);
      else setOrder(o);
      setLoading(false);
    });
  }, [user, id]);

  if (loading) {
    return (
      <div className="px-4 pt-4 space-y-3 animate-pulse">
        <div className="h-8 rounded-2xl bg-[var(--border)] w-1/2" />
        {[1, 2, 3].map((n) => (
          <div key={n} className="h-24 rounded-2xl bg-[var(--border)]" />
        ))}
      </div>
    );
  }

  if (notFound || !order) {
    return (
      <div className="px-4 pt-4 flex flex-col items-center text-center py-16">
        <Package className="w-10 h-10 text-[var(--text-muted)] mb-3" />
        <p className="font-semibold mb-1">Order not found</p>
        <p className="text-sm text-[var(--text-muted)] mb-4">
          We couldn&apos;t find this order.
        </p>
        <Link
          href="/store/orders"
          className="text-sm text-amber-500 font-medium"
        >
          ← My Orders
        </Link>
      </div>
    );
  }

  const statusColor = ORDER_STATUS_COLORS[order.status];
  const savingsPaise = order.subtotalPaise - order.totalPaise + order.deliveryPaise;

  return (
    <div className="px-4 pt-4 pb-8 space-y-4">
      {/* ── Placed confirmation banner ── */}
      {justPlaced && (
        <div className="flex items-start gap-3 p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
          <CheckCircle2 className="w-6 h-6 text-emerald-500 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-sm text-emerald-600 dark:text-emerald-300">
              Payment successful — order placed!
            </p>
            <p className="text-xs text-emerald-600/80 dark:text-emerald-300/80 mt-0.5">
              Thank you for shopping with BodyBuddy Store. We&apos;ll confirm
              your order shortly.
            </p>
          </div>
        </div>
      )}

      {/* ── Order header ── */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-display text-lg font-semibold">
            Order {order.orderNumber}
          </h1>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">
            Placed {new Date(order.createdAt).toLocaleDateString("en-IN", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </p>
        </div>
        <span
          className={cn(
            "text-[11px] font-semibold px-2.5 py-1 rounded-full border",
            statusColor
          )}
        >
          {ORDER_STATUS_LABELS[order.status]}
        </span>
      </div>

      {/* ── Status tracker ── */}
      <div className="glass-panel border border-[var(--border)] rounded-2xl p-4">
        <h2 className="font-semibold text-sm mb-3 flex items-center gap-1.5">
          <Truck className="w-4 h-4 text-amber-500" /> Order Status
        </h2>
        <StatusTracker status={order.status} />
      </div>

      {/* ── Order items ── */}
      <div className="glass-panel border border-[var(--border)] rounded-2xl p-4">
        <h2 className="font-semibold text-sm mb-3 flex items-center gap-1.5">
          <Package className="w-4 h-4 text-amber-500" /> Items Ordered
        </h2>
        <div className="space-y-3">
          {(order.items ?? []).map((item) => (
            <div key={item.id} className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500/10 to-nova-500/10 flex items-center justify-center overflow-hidden shrink-0">
                {item.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.imageUrl}
                    alt={item.productName}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <Package className="w-5 h-5 text-amber-500/30" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium leading-tight line-clamp-1">
                  {item.productName}
                </p>
                {item.variantName && (
                  <p className="text-[11px] text-[var(--text-muted)]">
                    {item.variantName}
                  </p>
                )}
                <p className="text-[11px] text-[var(--text-muted)]">
                  Qty: {item.quantity} ×{" "}
                  {formatPriceINR(item.unitPricePaise)}
                </p>
              </div>
              <span className="text-sm font-semibold shrink-0">
                {formatPriceINR(item.lineTotalPaise)}
              </span>
            </div>
          ))}
        </div>

        {/* Price breakdown */}
        <div className="border-t border-[var(--border)] pt-3 mt-3 space-y-1.5 text-sm">
          <div className="flex justify-between text-[var(--text-muted)]">
            <span>Subtotal</span>
            <span>{formatPriceINR(order.subtotalPaise)}</span>
          </div>
          {savingsPaise > 0 && (
            <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
              <span>Savings</span>
              <span className="font-semibold">−{formatPriceINR(savingsPaise)}</span>
            </div>
          )}
          <div className="flex justify-between text-[var(--text-muted)]">
            <span>Delivery</span>
            <span className="font-semibold text-emerald-600 dark:text-emerald-400">
              Free
            </span>
          </div>
          <div className="flex justify-between font-bold text-base pt-1 border-t border-[var(--border)]">
            <span>Total Paid</span>
            <span className="text-amber-500">
              {formatPriceINR(order.totalPaise)}
            </span>
          </div>
        </div>
      </div>

      {/* ── Delivery address ── */}
      <div className="glass-panel border border-[var(--border)] rounded-2xl p-4">
        <h2 className="font-semibold text-sm mb-3 flex items-center gap-1.5">
          <MapPin className="w-4 h-4 text-amber-500" /> Delivery Address
        </h2>
        <p className="text-sm font-medium">{order.customerName}</p>
        <p className="text-sm text-[var(--text-muted)] mt-1 leading-relaxed">
          {order.deliveryAddress.line1}
          {order.deliveryAddress.line2 ? `, ${order.deliveryAddress.line2}` : ""}
          <br />
          {order.deliveryAddress.city}, {order.deliveryAddress.state} –{" "}
          {order.deliveryAddress.pincode}
          <br />
          {order.deliveryAddress.country}
        </p>
        <p className="text-xs text-[var(--text-muted)] mt-2">
          {order.customerPhone}
        </p>
      </div>

      {/* ── Payment ── */}
      <div className="glass-panel border border-[var(--border)] rounded-2xl p-4">
        <h2 className="font-semibold text-sm mb-3 flex items-center gap-1.5">
          <CreditCard className="w-4 h-4 text-amber-500" /> Payment
        </h2>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm">
              {PAYMENT_METHOD_LABELS[order.paymentMethod]}
            </p>
            <p className="text-xs text-[var(--text-muted)] capitalize mt-0.5">
              Status: {order.paymentStatus}
            </p>
          </div>
          <span className="text-sm font-bold">
            {formatPriceINR(order.totalPaise)}
          </span>
        </div>
        {order.razorpayPaymentId && (
          <div className="mt-2 flex items-center gap-1 text-xs text-[var(--text-muted)]">
            <span>Payment ID: {order.razorpayPaymentId}</span>
            <CopyButton text={order.razorpayPaymentId} />
          </div>
        )}
        {order.paymentReference && !order.razorpayPaymentId && (
          <div className="mt-2 flex items-center gap-1 text-xs text-[var(--text-muted)]">
            <span>Ref: {order.paymentReference}</span>
            <CopyButton text={order.paymentReference} />
          </div>
        )}
      </div>

      {/* ── Receipt ── */}
      <button
        onClick={() => downloadReceiptPdf(order)}
        className="w-full flex items-center justify-center gap-2 text-sm font-semibold px-5 py-3.5 rounded-2xl border border-[var(--border)] glass-panel active:scale-95 transition-transform"
      >
        <Download className="w-4 h-4 text-amber-500" /> Download Receipt
      </button>

      {/* ── Order number ── */}
      <div className="flex items-center justify-center gap-2 text-xs text-[var(--text-muted)]">
        <span>Order #</span>
        <span className="font-mono font-semibold">{order.orderNumber}</span>
        <CopyButton text={order.orderNumber} />
      </div>

      {/* ── Actions ── */}
      <div className="flex flex-col gap-3 pt-2">
        <Link
          href="/store/orders"
          className="text-center text-sm font-medium text-[var(--text-muted)]"
        >
          ← Back to My Orders
        </Link>
        <Link
          href="/store"
          className="w-full flex items-center justify-center gap-1.5 text-sm font-semibold px-5 py-3.5 rounded-2xl bg-amber-500 text-white shadow-soft active:scale-95 transition-transform"
        >
          Continue Shopping <ChevronRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );
}
