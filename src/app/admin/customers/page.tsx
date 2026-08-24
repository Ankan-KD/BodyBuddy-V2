"use client";

// ════════════════════════════════════════════════════════════════════════
// BB Store Admin — Phase 11: Customer Management
// Lists customers who have purchased through BB Store with order history.
// ════════════════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Users, Search, RefreshCw,
  ChevronLeft, ChevronRight,
  ShoppingBag, TrendingUp, Mail, Phone,
} from "lucide-react";
import {
  adminFetchCustomers,
  adminFetchOrders,
  AdminCustomer,
} from "@/lib/storeAdminApi";
import { formatPriceINR } from "@/lib/cartContext";
import type { StoreOrder } from "@/lib/orderTypes";

const PAGE_SIZE = 25;

// ── Customer detail drawer ─────────────────────────────────────────────

function CustomerDrawer({
  customer,
  onClose,
}: {
  customer: AdminCustomer;
  onClose: () => void;
}) {
  const [orders, setOrders] = useState<StoreOrder[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(true);

  useEffect(() => {
    async function load() {
      setLoadingOrders(true);
      // Fetch recent orders and filter by this customer's email
      const result = await adminFetchOrders({
        search: customer.customerEmail,
        limit: 50,
      });
      setOrders(result.orders.filter((o) => o.customerEmail === customer.customerEmail));
      setLoadingOrders(false);
    }
    load();
  }, [customer.customerEmail]);

  const STATUS_BADGE: Record<string, string> = {
    placed:     "a-badge-orange",
    confirmed:  "a-badge-blue",
    processing: "a-badge-purple",
    shipped:    "a-badge-indigo",
    delivered:  "a-badge-green",
    cancelled:  "a-badge-red",
  };
  const STATUS_LABEL: Record<string, string> = {
    placed: "Placed", confirmed: "Confirmed", processing: "Processing",
    shipped: "Shipped", delivered: "Delivered", cancelled: "Cancelled",
  };

  return (
    <>
      {/* Overlay */}
      <div
        onClick={onClose}
        style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)",
          zIndex: 999, backdropFilter: "blur(2px)",
        }}
      />
      {/* Drawer */}
      <div style={{
        position: "fixed", top: 0, right: 0, bottom: 0,
        width: "min(540px, 100vw)",
        background: "var(--a-surface)",
        boxShadow: "var(--a-shadow-md)",
        zIndex: 1000, display: "flex", flexDirection: "column",
        overflowY: "auto",
      }}>
        {/* Header */}
        <div style={{
          padding: "20px 24px 16px", borderBottom: "1px solid var(--a-border)",
          display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{
              width: 40, height: 40, borderRadius: "50%",
              background: "var(--a-primary-muted)", color: "var(--a-primary)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontWeight: 700, fontSize: 16,
            }}>
              {customer.customerName.charAt(0).toUpperCase()}
            </div>
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--a-text)", margin: 0 }}>
                {customer.customerName}
              </h2>
              <p style={{ fontSize: 12, color: "var(--a-text-muted)", margin: 0 }}>Customer profile</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="a-btn a-btn-ghost a-btn-sm"
            style={{ fontSize: 18, lineHeight: 1, padding: "4px 10px" }}
          >
            ×
          </button>
        </div>

        {/* Contact info */}
        <div style={{ padding: "16px 24px", borderBottom: "1px solid var(--a-border)" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--a-text-2)" }}>
              <Mail style={{ width: 14, height: 14, color: "var(--a-text-muted)" }} />
              {customer.customerEmail}
            </div>
            {customer.customerPhone && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--a-text-2)" }}>
                <Phone style={{ width: 14, height: 14, color: "var(--a-text-muted)" }} />
                {customer.customerPhone}
              </div>
            )}
          </div>
        </div>

        {/* Stats */}
        <div style={{
          padding: "16px 24px", borderBottom: "1px solid var(--a-border)",
          display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12,
        }}>
          <div style={{
            background: "var(--a-surface-2)", borderRadius: 8,
            padding: "12px 14px", textAlign: "center",
          }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: "var(--a-primary)" }}>
              {customer.orderCount}
            </div>
            <div style={{ fontSize: 11, color: "var(--a-text-muted)", marginTop: 2 }}>Total Orders</div>
          </div>
          <div style={{
            background: "var(--a-surface-2)", borderRadius: 8,
            padding: "12px 14px", textAlign: "center",
          }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: "var(--a-success)" }}>
              {formatPriceINR(customer.totalSpentPaise)}
            </div>
            <div style={{ fontSize: 11, color: "var(--a-text-muted)", marginTop: 2 }}>Total Spent</div>
          </div>
        </div>

        {/* Orders list */}
        <div style={{ padding: "16px 24px", flex: 1 }}>
          <h3 style={{ fontSize: 13, fontWeight: 700, color: "var(--a-text)", marginBottom: 12 }}>
            Order History
          </h3>
          {loadingOrders ? (
            <p style={{ fontSize: 13, color: "var(--a-text-muted)", textAlign: "center", padding: "24px 0" }}>
              Loading orders…
            </p>
          ) : orders.length === 0 ? (
            <p style={{ fontSize: 13, color: "var(--a-text-muted)", textAlign: "center", padding: "24px 0" }}>
              No orders found.
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {orders.map((o) => (
                <div key={o.id} style={{
                  border: "1px solid var(--a-border)",
                  borderRadius: 8, padding: "12px 14px",
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                      <span style={{ fontFamily: "monospace", fontSize: 12, fontWeight: 600 }}>
                        {o.orderNumber}
                      </span>
                      <span className={`a-badge ${STATUS_BADGE[o.status] ?? "a-badge-neutral"}`}>
                        {STATUS_LABEL[o.status] ?? o.status}
                      </span>
                    </div>
                    <div style={{ fontSize: 11, color: "var(--a-text-muted)" }}>
                      {new Date(o.createdAt).toLocaleDateString("en-IN", {
                        day: "numeric", month: "short", year: "numeric",
                      })}
                      {" · "}
                      {o.items?.length ?? 0} item{(o.items?.length ?? 0) !== 1 ? "s" : ""}
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 14, fontWeight: 700 }}>{formatPriceINR(o.totalPaise)}</span>
                    <Link href={`/admin/orders/${o.id}`} className="a-btn a-btn-ghost a-btn-sm">
                      View
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────

export default function AdminCustomersPage() {
  const [customers, setCustomers] = useState<AdminCustomer[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<AdminCustomer | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const result = await adminFetchCustomers({
      search: search || undefined,
      limit: PAGE_SIZE,
      offset: page * PAGE_SIZE,
    });
    setCustomers(result.customers);
    setTotal(result.total);
    setLoading(false);
  }, [page, search]);

  useEffect(() => { load(); }, [load]);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setPage(0);
    setSearch(searchInput);
  }

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="a-page">
      {selected && (
        <CustomerDrawer customer={selected} onClose={() => setSelected(null)} />
      )}

      {/* ── Header ── */}
      <div className="a-page-header">
        <div className="a-page-title-group">
          <h1 className="a-page-title">Customers</h1>
          <p className="a-page-subtitle">
            {loading ? "Loading…" : `${total.toLocaleString("en-IN")} customer${total !== 1 ? "s" : ""} who have purchased`}
          </p>
        </div>
        <button
          onClick={load}
          className="a-btn a-btn-ghost a-btn-sm"
          title="Refresh"
        >
          <RefreshCw style={{ width: 14, height: 14 }} />
        </button>
      </div>

      {/* ── Summary cards ── */}
      {!loading && total > 0 && (
        <div className="a-stats-grid mb-4">
          <div className="a-stat-card">
            <div className="a-stat-icon a-stat-icon-blue">
              <Users style={{ width: 16, height: 16 }} />
            </div>
            <div>
              <div className="a-stat-value">{total.toLocaleString("en-IN")}</div>
              <div className="a-stat-label">Total Customers</div>
              <div className="a-stat-sub">who have ordered</div>
            </div>
          </div>
          <div className="a-stat-card">
            <div className="a-stat-icon a-stat-icon-green">
              <TrendingUp style={{ width: 16, height: 16 }} />
            </div>
            <div>
              <div className="a-stat-value">
                {formatPriceINR(customers.reduce((s, c) => s + c.totalSpentPaise, 0))}
              </div>
              <div className="a-stat-label">Combined Spend</div>
              <div className="a-stat-sub">this page</div>
            </div>
          </div>
          <div className="a-stat-card">
            <div className="a-stat-icon a-stat-icon-amber">
              <ShoppingBag style={{ width: 16, height: 16 }} />
            </div>
            <div>
              <div className="a-stat-value">
                {customers.length > 0
                  ? (customers.reduce((s, c) => s + c.orderCount, 0) / customers.length).toFixed(1)
                  : "0"}
              </div>
              <div className="a-stat-label">Avg Orders / Customer</div>
              <div className="a-stat-sub">this page</div>
            </div>
          </div>
        </div>
      )}

      {/* ── Search ── */}
      <div className="a-card mb-4">
        <div className="a-card-body">
          <form onSubmit={handleSearch} style={{ display: "flex", gap: 8 }}>
            <div className="a-search-wrap" style={{ flex: 1 }}>
              <Search className="a-search-icon" style={{ width: 14, height: 14 }} />
              <input
                className="a-input a-search-input"
                placeholder="Search by name or email…"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
              />
            </div>
            <button type="submit" className="a-btn a-btn-primary a-btn-sm">Search</button>
            {search && (
              <button
                type="button"
                className="a-btn a-btn-ghost a-btn-sm"
                onClick={() => { setSearch(""); setSearchInput(""); setPage(0); }}
              >
                Clear
              </button>
            )}
          </form>
        </div>
      </div>

      {/* ── Table ── */}
      <div className="a-card">
        <div className="a-table-wrap">
          <table className="a-table">
            <thead>
              <tr>
                <th>Customer</th>
                <th>Contact</th>
                <th>Orders</th>
                <th>Total Spent</th>
                <th>Last Order</th>
                <th style={{ textAlign: "right" }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={6} style={{ textAlign: "center", padding: "48px 0", color: "var(--a-text-muted)", fontSize: 13 }}>
                    Loading customers…
                  </td>
                </tr>
              )}
              {!loading && customers.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ textAlign: "center", padding: "48px 0" }}>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                      <Users style={{ width: 32, height: 32, color: "var(--a-text-muted)", opacity: 0.4 }} />
                      <p style={{ fontSize: 14, color: "var(--a-text-muted)", margin: 0 }}>
                        {search ? "No customers match your search." : "No customers yet. Customers appear once they place their first order."}
                      </p>
                    </div>
                  </td>
                </tr>
              )}
              {!loading && customers.map((c) => (
                <tr key={c.userId} style={{ cursor: "pointer" }} onClick={() => setSelected(c)}>
                  {/* Avatar + Name */}
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{
                        width: 32, height: 32, borderRadius: "50%",
                        background: "var(--a-primary-muted)", color: "var(--a-primary)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontWeight: 700, fontSize: 13, flexShrink: 0,
                      }}>
                        {c.customerName.charAt(0).toUpperCase()}
                      </div>
                      <span style={{ fontSize: 13, fontWeight: 600 }}>{c.customerName}</span>
                    </div>
                  </td>
                  {/* Contact */}
                  <td>
                    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                      <span style={{ fontSize: 12, color: "var(--a-text-2)" }}>{c.customerEmail}</span>
                      {c.customerPhone && (
                        <span style={{ fontSize: 11, color: "var(--a-text-muted)" }}>{c.customerPhone}</span>
                      )}
                    </div>
                  </td>
                  {/* Orders */}
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <ShoppingBag style={{ width: 13, height: 13, color: "var(--a-text-muted)" }} />
                      <span style={{ fontSize: 13, fontWeight: 600 }}>{c.orderCount}</span>
                    </div>
                  </td>
                  {/* Spent */}
                  <td>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "var(--a-success)" }}>
                      {formatPriceINR(c.totalSpentPaise)}
                    </span>
                  </td>
                  {/* Last order */}
                  <td>
                    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                      <span style={{ fontSize: 12, color: "var(--a-text-muted)" }}>
                        {new Date(c.lastOrderAt).toLocaleDateString("en-IN", {
                          day: "numeric", month: "short", year: "numeric",
                        })}
                      </span>
                    </div>
                  </td>
                  {/* Action */}
                  <td style={{ textAlign: "right" }} onClick={(e) => e.stopPropagation()}>
                    <button
                      className="a-btn a-btn-ghost a-btn-sm"
                      onClick={() => setSelected(c)}
                    >
                      View orders
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="a-table-footer">
            <span style={{ fontSize: 12, color: "var(--a-text-muted)" }}>
              Page {page + 1} of {totalPages} · {total} customers
            </span>
            <div style={{ display: "flex", gap: 4 }}>
              <button
                className="a-btn a-btn-ghost a-btn-sm"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
              >
                <ChevronLeft style={{ width: 14, height: 14 }} /> Prev
              </button>
              <button
                className="a-btn a-btn-ghost a-btn-sm"
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
              >
                Next <ChevronRight style={{ width: 14, height: 14 }} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
