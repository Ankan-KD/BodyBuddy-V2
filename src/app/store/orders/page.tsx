"use client";

// ════════════════════════════════════════════════════════════════════════
// BB Store — Phase 7: My Orders Page
// Lists all orders for the logged-in user with status filtering.
// ════════════════════════════════════════════════════════════════════════

import { useEffect, useState } from "react";
import Link from "next/link";
import { Package, ChevronRight, ShoppingBag } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { fetchMyOrders } from "@/lib/orderApi";
import {
  StoreOrder,
  OrderStatus,
  ORDER_STATUS_LABELS,
  ORDER_STATUS_COLORS,
} from "@/lib/orderTypes";
import { formatPriceINR } from "@/lib/cartContext";
import { cn } from "@/lib/utils";

// ── Filter tabs ───────────────────────────────────────────────────────────

type FilterTab = "All" | OrderStatus;

const TABS: FilterTab[] = [
  "All",
  "placed",
  "confirmed",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
];

const TAB_LABELS: Record<FilterTab, string> = {
  All: "All",
  placed: "Placed",
  confirmed: "Confirmed",
  processing: "Processing",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

// ── Order card ────────────────────────────────────────────────────────────

function OrderCard({ order }: { order: StoreOrder }) {
  const statusColor = ORDER_STATUS_COLORS[order.status];
  const itemCount = order.items?.reduce((s, i) => s + i.quantity, 0) ?? 0;
  const moreCount = (order.items?.length ?? 0) - 1;

  return (
    <Link href={`/store/orders/${order.id}`}>
      <div className="glass-panel border border-[var(--border)] rounded-2xl p-4 active:scale-[0.98] transition-transform">
        {/* Header row */}
        <div className="flex items-start justify-between mb-3">
          <div>
            <p className="text-sm font-semibold font-mono">
              {order.orderNumber}
            </p>
            <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
              {new Date(order.createdAt).toLocaleDateString("en-IN", {
                day: "numeric",
                month: "short",
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

        {/* Items preview */}
        <div className="flex items-center gap-2 mb-3">
          {/* Product image thumbnails */}
          <div className="flex items-center">
            {(order.items ?? []).slice(0, 3).map((item, i) => (
              <div
                key={item.id}
                className="w-10 h-10 rounded-lg bg-gradient-to-br from-amber-500/10 to-nova-500/10 border border-[var(--border)] flex items-center justify-center overflow-hidden shrink-0"
                style={{ marginLeft: i > 0 ? "-6px" : 0, zIndex: 3 - i }}
              >
                {item.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.imageUrl}
                    alt={item.productName}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <Package className="w-4 h-4 text-amber-500/30" />
                )}
              </div>
            ))}
            {moreCount > 0 && (
              <div className="w-10 h-10 rounded-lg bg-[var(--border)] border border-[var(--border)] flex items-center justify-center shrink-0 -ml-1.5 text-[10px] font-semibold text-[var(--text-muted)]">
                +{moreCount}
              </div>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium line-clamp-1">
              {order.items?.[0]?.productName ?? "Products"}
              {(order.items?.length ?? 0) > 1
                ? ` + ${(order.items?.length ?? 1) - 1} more`
                : ""}
            </p>
            <p className="text-[11px] text-[var(--text-muted)]">
              {itemCount} item{itemCount !== 1 ? "s" : ""}
            </p>
          </div>
        </div>

        {/* Total + arrow */}
        <div className="flex items-center justify-between pt-2 border-t border-[var(--border)]">
          <div>
            <p className="text-[11px] text-[var(--text-muted)]">Order Total</p>
            <p className="text-sm font-bold">
              {formatPriceINR(order.totalPaise)}
            </p>
          </div>
          <ChevronRight className="w-4 h-4 text-[var(--text-muted)]" />
        </div>
      </div>
    </Link>
  );
}

// ── Main component ────────────────────────────────────────────────────────

export default function OrdersPage() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<StoreOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<FilterTab>("All");

  useEffect(() => {
    if (!user) return;
    fetchMyOrders(user.id).then((o) => {
      setOrders(o);
      setLoading(false);
    });
  }, [user]);

  const filtered =
    activeTab === "All"
      ? orders
      : orders.filter((o) => o.status === activeTab);

  return (
    <div className="px-4 pt-4">
      <h1 className="font-display text-xl font-semibold mb-4">My Orders</h1>

      {/* Filter tabs */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar mb-5 pb-1">
        {TABS.map((tab) => {
          const count =
            tab === "All"
              ? orders.length
              : orders.filter((o) => o.status === tab).length;
          if (tab !== "All" && count === 0) return null;
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "shrink-0 text-xs font-medium px-3.5 py-1.5 rounded-full border transition-colors",
                activeTab === tab
                  ? "bg-amber-500/15 border-amber-500/30 text-amber-600 dark:text-amber-300"
                  : "glass-panel border-[var(--border)] text-[var(--text-muted)]"
              )}
            >
              {TAB_LABELS[tab]}
              {count > 0 && (
                <span className="ml-1 opacity-70">({count})</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Loading */}
      {loading && (
        <div className="space-y-3 animate-pulse">
          {[1, 2, 3].map((n) => (
            <div key={n} className="h-32 rounded-2xl bg-[var(--border)]" />
          ))}
        </div>
      )}

      {/* Orders list */}
      {!loading && filtered.length > 0 && (
        <div className="space-y-3">
          {filtered.map((order) => (
            <OrderCard key={order.id} order={order} />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center text-center py-16">
          <div className="w-20 h-20 rounded-full bg-amber-500/10 flex items-center justify-center mb-4">
            <ShoppingBag className="w-9 h-9 text-amber-500/60" />
          </div>
          <h2 className="font-display text-lg font-semibold mb-1">
            {activeTab === "All" ? "No orders yet" : `No ${TAB_LABELS[activeTab].toLowerCase()} orders`}
          </h2>
          <p className="text-sm text-[var(--text-muted)] mb-6 max-w-[220px]">
            {activeTab === "All"
              ? "Your order history will appear here once you make a purchase."
              : "Try a different filter to see your other orders."}
          </p>
          {activeTab === "All" ? (
            <Link
              href="/store"
              className="inline-flex items-center gap-1.5 text-sm font-semibold px-5 py-2.5 rounded-xl bg-amber-500 text-white shadow-soft active:scale-95 transition-transform"
            >
              Start Shopping <ChevronRight className="w-4 h-4" />
            </Link>
          ) : (
            <button
              onClick={() => setActiveTab("All")}
              className="text-sm font-medium text-amber-500"
            >
              Show all orders
            </button>
          )}
        </div>
      )}
    </div>
  );
}
