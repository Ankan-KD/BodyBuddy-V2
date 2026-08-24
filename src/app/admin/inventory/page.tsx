"use client";

// ════════════════════════════════════════════════════════════════════════
// BB Store Admin — Phase 8: Inventory Management
// View all product variants with stock levels and restock inline.
// ════════════════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Warehouse,
  Search,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Package,
} from "lucide-react";
import {
  adminFetchInventory,
  adminRestockVariant,
  type InventoryVariantRow,
} from "@/lib/storeAdminApi";

const PAGE_SIZE = 50;

// ── Stock level badge ─────────────────────────────────────────────────────

function StockBadge({ qty, threshold }: { qty: number; threshold: number }) {
  if (qty === 0) return <span className="a-badge a-badge-red">Out of Stock</span>;
  if (qty <= threshold) return <span className="a-badge a-badge-orange">Low Stock</span>;
  return <span className="a-badge a-badge-green">In Stock</span>;
}

// ── Inline restock row ────────────────────────────────────────────────────

function InventoryRow({
  row,
  onRestocked,
}: {
  row: InventoryVariantRow;
  onRestocked: (variantId: string, newQty: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(String(row.stockQuantity));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const isLow = row.stockQuantity <= row.lowStockThreshold && row.stockQuantity > 0;
  const isOut = row.stockQuantity === 0;

  async function handleSave() {
    const qty = parseInt(value, 10);
    if (isNaN(qty) || qty < 0) {
      setError("Enter a valid quantity (0 or more).");
      return;
    }
    setSaving(true);
    setError("");
    const err = await adminRestockVariant(row.variantId, qty);
    if (err) {
      setError(err);
    } else {
      onRestocked(row.variantId, qty);
      setEditing(false);
    }
    setSaving(false);
  }

  function handleCancel() {
    setValue(String(row.stockQuantity));
    setEditing(false);
    setError("");
  }

  return (
    <tr style={{ background: isOut ? "rgba(239,68,68,0.04)" : isLow ? "rgba(245,158,11,0.04)" : undefined }}>
      <td>
        <div style={{ fontWeight: 500, fontSize: 13 }}>{row.productName}</div>
        <Link
          href={`/admin/products/${row.productId}/edit`}
          style={{ fontSize: 11, color: "var(--a-accent)" }}
        >
          Edit product →
        </Link>
      </td>
      <td style={{ fontSize: 12, color: "var(--a-text-muted)" }}>
        {row.variantName || `${row.sizeLabel}${row.flavour ? ` – ${row.flavour}` : ""}`}
      </td>
      <td style={{ fontSize: 11, fontFamily: "monospace", color: "var(--a-text-muted)" }}>{row.sku}</td>
      <td>
        {editing ? (
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <input
              type="number"
              min={0}
              className="a-input"
              style={{ width: 80, padding: "4px 8px", fontSize: 13 }}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") handleCancel(); }}
              autoFocus
            />
            <button
              onClick={handleSave}
              disabled={saving}
              className="a-btn a-btn-primary a-btn-sm"
            >
              {saving ? "…" : "Save"}
            </button>
            <button onClick={handleCancel} className="a-btn a-btn-ghost a-btn-sm">
              Cancel
            </button>
          </div>
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span
              style={{
                fontSize: 14, fontWeight: 700,
                color: isOut ? "var(--a-error)" : isLow ? "var(--a-warning)" : "var(--a-text)",
              }}
            >
              {row.stockQuantity}
            </span>
            <span style={{ fontSize: 11, color: "var(--a-text-muted)" }}>
              (threshold: {row.lowStockThreshold})
            </span>
            {error && (
              <span style={{ fontSize: 11, color: "var(--a-error)" }}>{error}</span>
            )}
          </div>
        )}
      </td>
      <td>
        <StockBadge qty={row.stockQuantity} threshold={row.lowStockThreshold} />
      </td>
      <td>
        <span
          style={{
            fontSize: 11, textTransform: "capitalize",
            color: row.availability === "active" ? "var(--a-success)"
              : row.availability === "out_of_stock" ? "var(--a-error)"
              : "var(--a-text-muted)",
          }}
        >
          {row.availability.replace(/_/g, " ")}
        </span>
      </td>
      <td style={{ textAlign: "right" }}>
        {!editing && (
          <button
            onClick={() => { setValue(String(row.stockQuantity)); setEditing(true); }}
            className="a-btn a-btn-ghost a-btn-sm"
          >
            Restock
          </button>
        )}
      </td>
    </tr>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────

export default function AdminInventoryPage() {
  const [rows, setRows] = useState<InventoryVariantRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [lowStockOnly, setLowStockOnly] = useState(false);

  const [successMsg, setSuccessMsg] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const result = await adminFetchInventory({
      search,
      lowStockOnly,
      limit: PAGE_SIZE,
      offset: page * PAGE_SIZE,
    });
    setRows(result.rows);
    setTotal(result.total);
    setLoading(false);
  }, [search, lowStockOnly, page]);

  useEffect(() => { load(); }, [load]);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setPage(0);
    setSearch(searchInput);
  }

  function handleRestocked(variantId: string, newQty: number) {
    setRows((prev) =>
      prev.map((r) =>
        r.variantId === variantId
          ? {
              ...r,
              stockQuantity: newQty,
              availability:
                r.availability === "out_of_stock" && newQty > 0
                  ? "active"
                  : newQty === 0
                  ? "out_of_stock"
                  : r.availability,
            }
          : r
      )
    );
    setSuccessMsg("Stock updated successfully.");
    setTimeout(() => setSuccessMsg(""), 3000);
  }

  const outOfStock = rows.filter((r) => r.stockQuantity === 0).length;
  const lowStock = rows.filter(
    (r) => r.stockQuantity > 0 && r.stockQuantity <= r.lowStockThreshold
  ).length;

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="a-page">
      {/* ── Header ── */}
      <div className="a-page-header">
        <div className="a-page-title-group">
          <h1 className="a-page-title">Inventory</h1>
          <p className="a-page-subtitle">
            {loading ? "Loading…" : `${total.toLocaleString("en-IN")} variant${total !== 1 ? "s" : ""}`}
          </p>
        </div>
      </div>

      {/* ── Alert messages ── */}
      {successMsg && (
        <div className="a-alert a-alert-success" style={{ marginBottom: 16 }}>
          <CheckCircle2 style={{ width: 14, height: 14 }} />
          {successMsg}
        </div>
      )}

      {/* ── Summary tiles ── */}
      {!loading && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 20 }}>
          <div className="a-stat-card">
            <div className="a-stat-icon" style={{ background: "rgba(59,130,246,0.12)" }}>
              <Warehouse style={{ width: 16, height: 16, color: "var(--a-stat-blue)" }} />
            </div>
            <div>
              <div className="a-stat-value">{total}</div>
              <div className="a-stat-label">Total Variants</div>
            </div>
          </div>
          <div
            className="a-stat-card"
            style={{ cursor: "pointer" }}
            onClick={() => { setLowStockOnly(true); setPage(0); }}
          >
            <div className="a-stat-icon" style={{ background: "rgba(245,158,11,0.12)" }}>
              <AlertTriangle style={{ width: 16, height: 16, color: "var(--a-warning)" }} />
            </div>
            <div>
              <div className="a-stat-value" style={{ color: "var(--a-warning)" }}>{lowStock}</div>
              <div className="a-stat-label">Low Stock</div>
            </div>
          </div>
          <div
            className="a-stat-card"
            style={{ cursor: "pointer" }}
            onClick={() => { setLowStockOnly(true); setPage(0); }}
          >
            <div className="a-stat-icon" style={{ background: "rgba(239,68,68,0.12)" }}>
              <Package style={{ width: 16, height: 16, color: "var(--a-error)" }} />
            </div>
            <div>
              <div className="a-stat-value" style={{ color: "var(--a-error)" }}>{outOfStock}</div>
              <div className="a-stat-label">Out of Stock</div>
            </div>
          </div>
        </div>
      )}

      {/* ── Filters ── */}
      <div className="a-card mb-4">
        <div className="a-card-body" style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <form onSubmit={handleSearch} style={{ display: "flex", gap: 8, flex: 1, minWidth: 240 }}>
            <div className="a-search-wrap" style={{ flex: 1 }}>
              <Search className="a-search-icon" style={{ width: 14, height: 14 }} />
              <input
                className="a-input a-search-input"
                placeholder="Search by SKU or variant name…"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
              />
            </div>
            <button type="submit" className="a-btn a-btn-primary a-btn-sm">Search</button>
          </form>

          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={lowStockOnly}
              onChange={(e) => { setLowStockOnly(e.target.checked); setPage(0); }}
            />
            Low stock only
          </label>

          {(search || lowStockOnly) && (
            <button
              className="a-btn a-btn-ghost a-btn-sm"
              onClick={() => { setSearchInput(""); setSearch(""); setLowStockOnly(false); setPage(0); }}
            >
              Clear
            </button>
          )}

          <button
            className="a-btn a-btn-ghost a-btn-icon a-btn-sm"
            onClick={load}
            title="Refresh"
          >
            <RefreshCw style={{ width: 13, height: 13 }} />
          </button>
        </div>
      </div>

      {/* ── Table ── */}
      <div className="a-card">
        <div className="a-table-wrap">
          <table className="a-table">
            <thead>
              <tr>
                <th>Product</th>
                <th>Variant</th>
                <th>SKU</th>
                <th>Stock Qty</th>
                <th>Status</th>
                <th>Availability</th>
                <th style={{ textAlign: "right" }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={7} style={{ textAlign: "center", padding: "48px 0", color: "var(--a-text-muted)" }}>
                    <RefreshCw style={{ width: 18, height: 18, display: "inline", animation: "spin 1s linear infinite" }} />
                  </td>
                </tr>
              )}

              {!loading && rows.length === 0 && (
                <tr>
                  <td colSpan={7}>
                    <div className="a-empty">
                      <Warehouse className="a-empty-icon" />
                      <p className="a-empty-title">No variants found</p>
                      <p className="a-empty-sub">Add products with variants to manage inventory.</p>
                    </div>
                  </td>
                </tr>
              )}

              {!loading && rows.map((row) => (
                <InventoryRow key={row.variantId} row={row} onRestocked={handleRestocked} />
              ))}
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
