"use client";

// ════════════════════════════════════════════════════════════════════════
// BB Store Admin — Orders Listing  (Realtime: new orders pop in, status
// badges update in-place — no page refresh ever)
// ════════════════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import {
  ShoppingBag, Search, RefreshCw,
  ChevronLeft, ChevronRight, Eye,
} from "lucide-react";
import {
  adminFetchOrders,
  AdminFetchOrdersOptions,
} from "@/lib/storeAdminApi";
import type { StoreOrder, OrderStatus } from "@/lib/orderTypes";
import { orderFromRow, type OrderRow } from "@/lib/orderTypes";
import {
  ORDER_STATUS_LABELS, PAYMENT_METHOD_LABELS,
} from "@/lib/orderTypes";
import { formatPriceINR } from "@/lib/cartContext";
import { useAdminRealtime } from "@/lib/useAdminRealtime";
import { LiveIndicator } from "@/components/admin/LiveIndicator";

const PAGE_SIZE = 25;

const STATUS_FILTERS: Array<{ value: OrderStatus | ""; label: string }> = [
  { value: "", label: "All Orders" },
  { value: "placed", label: "Placed" },
  { value: "confirmed", label: "Confirmed" },
  { value: "processing", label: "Processing" },
  { value: "shipped", label: "Shipped" },
  { value: "delivered", label: "Delivered" },
  { value: "cancelled", label: "Cancelled" },
];

const STATUS_CLASS: Record<OrderStatus, string> = {
  placed: "a-badge-orange", confirmed: "a-badge-blue",
  processing: "a-badge-purple", shipped: "a-badge-indigo",
  delivered: "a-badge-green", cancelled: "a-badge-red",
};

function StatusBadge({ status }: { status: OrderStatus }) {
  return (
    <span className={`a-badge ${STATUS_CLASS[status] ?? "a-badge-neutral"}`}>
      {ORDER_STATUS_LABELS[status]}
    </span>
  );
}

// ── slide-in animation injected once ─────────────────────────────────────
const RT_STYLES = `
@keyframes rt-slide-in {
  from { opacity: 0; transform: translateY(-10px); background: rgba(16,185,129,.18); }
  to   { opacity: 1; transform: translateY(0);     background: transparent; }
}
.rt-new-row { animation: rt-slide-in 0.55s ease both; }
@keyframes rt-flash {
  0%,100% { background: transparent; }
  30%     { background: rgba(59,130,246,.18); }
}
.rt-updated-row { animation: rt-flash 0.9s ease; }
`;

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<StoreOrder[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [status, setStatus] = useState<OrderStatus | "">("");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  // tracks which row ids got an animation class
  const [newIds, setNewIds] = useState<Set<string>>(new Set());
  const [updatedIds, setUpdatedIds] = useState<Set<string>>(new Set());

  const isPage0NoFilter = page === 0 && !search && !status;

  const load = useCallback(async () => {
    setLoading(true);
    const opts: AdminFetchOrdersOptions = {
      limit: PAGE_SIZE, offset: page * PAGE_SIZE,
    };
    if (status) opts.status = status;
    if (search)  opts.search  = search;
    const result = await adminFetchOrders(opts);
    setOrders(result.orders);
    setTotal(result.total);
    setLoading(false);
  }, [page, status, search]);

  useEffect(() => { load(); }, [load]);

  // ── Realtime — patch state in-place, no reload ────────────────────────
  const { connected } = useAdminRealtime<OrderRow>({
    table: "store_orders",

    onInsert: (row) => {
      // Only prepend if we're on page 0 with no active filter
      if (!isPage0NoFilter) {
        setTotal((t) => t + 1);
        return;
      }
      const order = orderFromRow(row);
      setOrders((prev) => [order, ...prev.slice(0, PAGE_SIZE - 1)]);
      setTotal((t) => t + 1);
      setNewIds((ids) => new Set([...ids, order.id]));
      // remove animation class after it finishes
      setTimeout(() => {
        setNewIds((ids) => { const s = new Set(ids); s.delete(order.id); return s; });
      }, 1200);
    },

    onUpdate: (row) => {
      const updated = orderFromRow(row);
      setOrders((prev) =>
        prev.map((o) => (o.id === updated.id ? { ...o, ...updated } : o))
      );
      setUpdatedIds((ids) => new Set([...ids, updated.id]));
      setTimeout(() => {
        setUpdatedIds((ids) => { const s = new Set(ids); s.delete(updated.id); return s; });
      }, 1200);
    },

    onDelete: (row) => {
      setOrders((prev) => prev.filter((o) => o.id !== (row as any).id));
      setTotal((t) => Math.max(0, t - 1));
    },
  });

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setPage(0);
    setSearch(searchInput);
  }

  function handleStatusChange(v: OrderStatus | "") {
    setStatus(v);
    setPage(0);
  }

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="a-page">
      <style>{RT_STYLES}</style>

      {/* ── Header ── */}
      <div className="a-page-header">
        <div className="a-page-title-group">
          <h1 className="a-page-title">Orders</h1>
          <p className="a-page-subtitle">
            {loading ? "Loading…" : `${total.toLocaleString("en-IN")} order${total !== 1 ? "s" : ""}`}
          </p>
        </div>
        <LiveIndicator connected={connected} />
      </div>

      {/* ── Filters ── */}
      <div className="a-card mb-4">
        <div className="a-card-body" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <form onSubmit={handleSearch} style={{ display: "flex", gap: 8 }}>
            <div className="a-search-wrap" style={{ flex: 1 }}>
              <Search className="a-search-icon" style={{ width: 14, height: 14 }} />
              <input
                className="a-input a-search-input"
                placeholder="Search order number, customer name or email…"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
              />
            </div>
            <button type="submit" className="a-btn a-btn-primary a-btn-sm">Search</button>
            {(search || status) && (
              <button
                type="button" className="a-btn a-btn-ghost a-btn-sm"
                onClick={() => { setSearchInput(""); setSearch(""); setStatus(""); setPage(0); }}
              >
                Clear
              </button>
            )}
          </form>

          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {STATUS_FILTERS.map(({ value, label }) => (
              <button
                key={value}
                onClick={() => handleStatusChange(value as OrderStatus | "")}
                className={`a-btn a-btn-sm ${status === value ? "a-btn-primary" : "a-btn-ghost"}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Table ── */}
      <div className="a-card">
        <div className="a-table-wrap hidden md:block">
          <table className="a-table">
            <thead>
              <tr>
                <th>Order #</th><th>Customer</th><th>Date</th>
                <th>Items</th><th>Payment</th><th>Total</th>
                <th>Status</th><th style={{ textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={8} style={{ textAlign: "center", padding: "48px 0", color: "var(--a-text-muted)" }}>
                    <RefreshCw style={{ width: 18, height: 18, display: "inline", animation: "spin 1s linear infinite" }} />
                  </td>
                </tr>
              )}
              {!loading && orders.length === 0 && (
                <tr>
                  <td colSpan={8}>
                    <div className="a-empty">
                      <ShoppingBag className="a-empty-icon" />
                      <p className="a-empty-title">No orders found</p>
                      <p className="a-empty-sub">Try adjusting the filters.</p>
                    </div>
                  </td>
                </tr>
              )}
              {!loading && orders.map((order) => {
                const itemCount = order.items?.reduce((s, i) => s + i.quantity, 0) ?? 0;
                const rowClass = newIds.has(order.id)
                  ? "rt-new-row"
                  : updatedIds.has(order.id)
                  ? "rt-updated-row"
                  : "";
                return (
                  <tr key={order.id} className={rowClass}>
                    <td>
                      <span style={{ fontFamily: "monospace", fontSize: 12, fontWeight: 600 }}>
                        {order.orderNumber}
                      </span>
                    </td>
                    <td>
                      <div style={{ fontWeight: 500, fontSize: 13 }}>{order.customerName}</div>
                      <div style={{ fontSize: 11, color: "var(--a-text-muted)" }}>{order.customerEmail}</div>
                    </td>
                    <td style={{ fontSize: 12, color: "var(--a-text-muted)", whiteSpace: "nowrap" }}>
                      {new Date(order.createdAt).toLocaleDateString("en-IN", {
                        day: "numeric", month: "short", year: "numeric",
                      })}
                    </td>
                    <td style={{ fontSize: 12 }}>{itemCount} item{itemCount !== 1 ? "s" : ""}</td>
                    <td style={{ fontSize: 12 }}>{PAYMENT_METHOD_LABELS[order.paymentMethod]}</td>
                    <td style={{ fontWeight: 600, fontSize: 13 }}>{formatPriceINR(order.totalPaise)}</td>
                    <td><StatusBadge status={order.status} /></td>
                    <td style={{ textAlign: "right" }}>
                      <Link
                        href={`/admin/orders/${order.id}`}
                        className="a-btn a-btn-ghost a-btn-icon a-btn-sm"
                        title="View order"
                      >
                        <Eye style={{ width: 14, height: 14 }} />
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Mobile cards */}
        <div className="md:hidden">
          {loading && (
            <div className="a-loading">
              <RefreshCw style={{ width: 16, height: 16 }} className="animate-spin" /> Loading…
            </div>
          )}
          {!loading && orders.length === 0 && (
            <div className="a-empty">
              <ShoppingBag className="a-empty-icon" />
              <p className="a-empty-title">No orders found</p>
              <p className="a-empty-sub">Try adjusting the filters.</p>
            </div>
          )}
          {!loading && orders.map((order) => {
            const itemCount = order.items?.reduce((s, i) => s + i.quantity, 0) ?? 0;
            const rowClass = newIds.has(order.id) ? "rt-new-row" : updatedIds.has(order.id) ? "rt-updated-row" : "";
            return (
              <Link
                key={order.id}
                href={`/admin/orders/${order.id}`}
                className={rowClass}
                style={{
                  display: "block", padding: "12px 16px",
                  borderBottom: "1px solid var(--a-border)",
                  textDecoration: "none", color: "inherit",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 4 }}>
                  <span style={{ fontFamily: "monospace", fontSize: 12, fontWeight: 600 }}>{order.orderNumber}</span>
                  <StatusBadge status={order.status} />
                </div>
                <div style={{ fontWeight: 500, fontSize: 13 }}>{order.customerName}</div>
                <div style={{ fontSize: 11, color: "var(--a-text-muted)", marginBottom: 6 }}>{order.customerEmail}</div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, fontSize: 12, color: "var(--a-text-muted)" }}>
                  <span>
                    {new Date(order.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                    {" · "}{itemCount} item{itemCount !== 1 ? "s" : ""}
                  </span>
                  <span style={{ fontWeight: 600, fontSize: 13, color: "var(--a-text)" }}>{formatPriceINR(order.totalPaise)}</span>
                </div>
              </Link>
            );
          })}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="a-table-footer">
            <span style={{ fontSize: 12, color: "var(--a-text-muted)" }}>
              Page {page + 1} of {totalPages}
            </span>
            <div style={{ display: "flex", gap: 6 }}>
              <button className="a-btn a-btn-ghost a-btn-icon a-btn-sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
                <ChevronLeft style={{ width: 14, height: 14 }} />
              </button>
              <button className="a-btn a-btn-ghost a-btn-icon a-btn-sm" disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)}>
                <ChevronRight style={{ width: 14, height: 14 }} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
