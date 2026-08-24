"use client";

// ════════════════════════════════════════════════════════════════════════
// BB Store Admin — Phase 8: Orders Listing
// Full order management with status filtering and search.
// ════════════════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  ShoppingBag,
  Search,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Eye,
} from "lucide-react";
import {
  adminFetchOrders,
  AdminFetchOrdersOptions,
} from "@/lib/storeAdminApi";
import type { StoreOrder, OrderStatus } from "@/lib/orderTypes";
import {
  ORDER_STATUS_LABELS,
  ORDER_STATUS_COLORS,
  PAYMENT_METHOD_LABELS,
} from "@/lib/orderTypes";
import { formatPriceINR } from "@/lib/cartContext";
import { cn } from "@/lib/utils";

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

// ── Status badge using admin CSS vars ────────────────────────────────────

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

// ── Main page ─────────────────────────────────────────────────────────────

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<StoreOrder[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);

  const [status, setStatus] = useState<OrderStatus | "">("");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const opts: AdminFetchOrdersOptions = {
      limit: PAGE_SIZE,
      offset: page * PAGE_SIZE,
    };
    if (status) opts.status = status;
    if (search) opts.search = search;

    const result = await adminFetchOrders(opts);
    setOrders(result.orders);
    setTotal(result.total);
    setLoading(false);
  }, [page, status, search]);

  useEffect(() => { load(); }, [load]);

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
      {/* ── Header ── */}
      <div className="a-page-header">
        <div className="a-page-title-group">
          <h1 className="a-page-title">Orders</h1>
          <p className="a-page-subtitle">
            {loading ? "Loading…" : `${total.toLocaleString("en-IN")} order${total !== 1 ? "s" : ""}`}
          </p>
        </div>
      </div>

      {/* ── Filters ── */}
      <div className="a-card mb-4">
        <div className="a-card-body" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {/* Search */}
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
            <button type="submit" className="a-btn a-btn-primary a-btn-sm">
              Search
            </button>
            {(search || status) && (
              <button
                type="button"
                className="a-btn a-btn-ghost a-btn-sm"
                onClick={() => {
                  setSearchInput("");
                  setSearch("");
                  setStatus("");
                  setPage(0);
                }}
              >
                Clear
              </button>
            )}
          </form>

          {/* Status filter tabs */}
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
        <div className="a-table-wrap">
          <table className="a-table">
            <thead>
              <tr>
                <th>Order #</th>
                <th>Customer</th>
                <th>Date</th>
                <th>Items</th>
                <th>Payment</th>
                <th>Total</th>
                <th>Status</th>
                <th style={{ textAlign: "right" }}>Actions</th>
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
                return (
                  <tr key={order.id}>
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
                    <td style={{ fontSize: 12 }}>
                      {itemCount} item{itemCount !== 1 ? "s" : ""}
                    </td>
                    <td style={{ fontSize: 12 }}>
                      {PAYMENT_METHOD_LABELS[order.paymentMethod]}
                    </td>
                    <td style={{ fontWeight: 600, fontSize: 13 }}>
                      {formatPriceINR(order.totalPaise)}
                    </td>
                    <td>
                      <StatusBadge status={order.status} />
                    </td>
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

        {/* ── Pagination ── */}
        {totalPages > 1 && (
          <div className="a-table-footer">
            <span style={{ fontSize: 12, color: "var(--a-text-muted)" }}>
              Page {page + 1} of {totalPages}
            </span>
            <div style={{ display: "flex", gap: 6 }}>
              <button
                className="a-btn a-btn-ghost a-btn-icon a-btn-sm"
                disabled={page === 0}
                onClick={() => setPage((p) => p - 1)}
              >
                <ChevronLeft style={{ width: 14, height: 14 }} />
              </button>
              <button
                className="a-btn a-btn-ghost a-btn-icon a-btn-sm"
                disabled={page >= totalPages - 1}
                onClick={() => setPage((p) => p + 1)}
              >
                <ChevronRight style={{ width: 14, height: 14 }} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
