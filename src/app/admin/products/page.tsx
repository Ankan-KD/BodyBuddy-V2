"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Plus,
  Search,
  Package,
  Edit2,
  Trash2,
  Star,
  StarOff,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
} from "lucide-react";
import { adminFetchProducts, adminDeleteProduct, adminFetchAllCategories, adminToggleFeaturedProduct } from "@/lib/storeAdminApi";
import type { StoreProduct, StoreCategory } from "@/lib/storeTypes";
import { formatPriceINR } from "@/lib/storeTypes";

const PAGE_SIZE = 20;

const AVAILABILITY_OPTIONS = [
  { value: "", label: "All Availability" },
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
  { value: "out_of_stock", label: "Out of Stock" },
  { value: "discontinued", label: "Discontinued" },
];

const PUBLISHED_OPTIONS = [
  { value: "", label: "All Status" },
  { value: "true", label: "Published" },
  { value: "false", label: "Draft" },
];

/**
 * Published = visible to customers on the storefront.
 * Draft     = hidden from customers, admin-only.
 */
function PublishBadge({ published }: { published: boolean }) {
  return published ? (
    <span className="a-badge a-badge-green" title="Visible to customers">Published</span>
  ) : (
    <span className="a-badge a-badge-neutral" title="Hidden from customers">Draft</span>
  );
}

/**
 * Availability controls whether the product can be purchased:
 *   Active       = in stock, can be added to cart
 *   Inactive     = listed but not purchasable (e.g. temporarily unavailable)
 *   Out of Stock = no stock; shown but cart blocked
 *   Discontinued = permanently retired; not shown to customers
 */
function AvailabilityBadge({ availability }: { availability: string }) {
  const map: Record<string, string> = {
    active:       "a-badge-blue",
    inactive:     "a-badge-neutral",
    out_of_stock: "a-badge-orange",
    discontinued: "a-badge-red",
  };
  const labels: Record<string, string> = {
    active:       "Active",
    inactive:     "Inactive",
    out_of_stock: "Out of Stock",
    discontinued: "Discontinued",
  };
  const titles: Record<string, string> = {
    active:       "In stock and purchasable",
    inactive:     "Listed but not purchasable",
    out_of_stock: "No stock — cart is blocked",
    discontinued: "Permanently retired",
  };
  return (
    <span
      className={`a-badge ${map[availability] ?? "a-badge-neutral"}`}
      title={titles[availability] ?? availability}
    >
      {labels[availability] ?? availability}
    </span>
  );
}

export default function AdminProductsPage() {
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);

  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [published, setPublished] = useState("");
  const [availability, setAvailability] = useState("");

  const [categories, setCategories] = useState<StoreCategory[]>([]);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  useEffect(() => { adminFetchAllCategories().then(setCategories); }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const opts: Record<string, unknown> = { limit: PAGE_SIZE, offset: page * PAGE_SIZE };
    if (search) opts.search = search;
    if (categoryId) opts.categoryId = categoryId;
    if (published !== "") opts.published = published === "true";
    if (availability) opts.availability = availability;
    const result = await adminFetchProducts(opts);
    setProducts(result.products);
    setTotal(result.total);
    setLoading(false);
  }, [search, categoryId, published, availability, page]);

  useEffect(() => { load(); }, [load]);

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPage(0);
    setSearch(searchInput);
  }

  async function handleDelete(id: string) {
    if (deleteConfirmId !== id) { setDeleteConfirmId(id); return; }
    setDeletingId(id);
    setDeleteConfirmId(null);
    await adminDeleteProduct(id);
    setDeletingId(null);
    load();
  }

  async function handleToggleFeatured(id: string, current: boolean) {
    await adminToggleFeaturedProduct(id, !current);
    load();
  }

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const topCategories = categories.filter(c => !c.parentId);
  const hasFilters = !!(search || categoryId || published || availability);

  return (
    <div style={{ maxWidth: 1100 }}>
      {/* Page header */}
      <div className="a-page-header">
        <div>
          <h2 className="a-page-title">Products</h2>
          <p className="a-page-subtitle">{total} product{total !== 1 ? "s" : ""} in your store</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={load}
            className="a-btn a-btn-secondary a-btn-icon"
            title="Refresh"
            aria-label="Refresh products"
          >
            <RefreshCw style={{ width: 14, height: 14 }} className={loading ? "animate-spin" : ""} />
          </button>
          <Link href="/admin/products/new" className="a-btn a-btn-primary">
            <Plus style={{ width: 14, height: 14 }} />
            Add Product
          </Link>
        </div>
      </div>

      {/* Filter bar */}
      <div className="a-filter-bar">
        <form onSubmit={handleSearchSubmit} style={{ display: "flex", gap: 6, flex: 1, minWidth: 200 }}>
          <div className="a-search-wrap">
            <Search />
            <input
              type="text"
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              placeholder="Search products…"
              className="a-search-input"
            />
          </div>
          <button type="submit" className="a-btn a-btn-secondary" style={{ height: 32 }}>
            Search
          </button>
        </form>

        <select
          value={categoryId}
          onChange={e => { setCategoryId(e.target.value); setPage(0); }}
          className="a-filter-select"
        >
          <option value="">All Categories</option>
          {topCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>

        <select
          value={published}
          onChange={e => { setPublished(e.target.value); setPage(0); }}
          className="a-filter-select"
        >
          {PUBLISHED_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>

        <select
          value={availability}
          onChange={e => { setAvailability(e.target.value); setPage(0); }}
          className="a-filter-select"
        >
          {AVAILABILITY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>

        {hasFilters && (
          <button
            onClick={() => { setSearch(""); setSearchInput(""); setCategoryId(""); setPublished(""); setAvailability(""); setPage(0); }}
            className="a-btn a-btn-ghost"
            style={{ height: 32, fontSize: 12, color: "var(--a-danger)" }}
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Table */}
      <div className="a-card" style={{ overflow: "hidden" }}>
        {loading ? (
          <div className="a-loading">
            <RefreshCw style={{ width: 16, height: 16 }} className="animate-spin" />
            Loading products…
          </div>
        ) : products.length === 0 ? (
          <div className="a-empty">
            <div className="a-empty-icon"><Package style={{ width: 18, height: 18 }} /></div>
            <div className="a-empty-title">No products found</div>
            <div className="a-empty-sub">
              {hasFilters ? "Try adjusting your filters." : "Add your first product to get started."}
            </div>
            {!hasFilters && (
              <Link href="/admin/products/new" className="a-btn a-btn-primary">
                <Plus style={{ width: 14, height: 14 }} /> Add Product
              </Link>
            )}
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="a-table-wrap hidden md:block">
              <table className="a-table">
                <thead>
                  <tr>
                    <th style={{ width: 36 }}>#</th>
                    <th>Product</th>
                    <th>Category</th>
                    <th>Variants</th>
                    <th title="Published = visible to customers. Draft = hidden. Availability = whether it can be purchased.">Status</th>
                    <th style={{ textAlign: "right" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((product, i) => {
                    const img = product.images[0];
                    return (
                      <tr key={product.id}>
                        <td style={{ color: "var(--a-text-3)", fontSize: 12 }}>
                          {page * PAGE_SIZE + i + 1}
                        </td>
                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <div className="a-product-thumb">
                              {img
                                ? <img src={img} alt={product.name} />
                                : <Package style={{ width: 14, height: 14, color: "var(--a-text-3)" }} />
                              }
                            </div>
                            <div>
                              <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                                <Link
                                  href={`/admin/products/${product.id}/edit`}
                                  style={{ fontWeight: 500, color: "var(--a-text)", textDecoration: "none", fontSize: 13 }}
                                  className="hover:underline"
                                >
                                  {product.name}
                                </Link>
                                {product.isFeatured && (
                                  <Star style={{ width: 11, height: 11, color: "#d97706", fill: "#d97706" }} />
                                )}
                              </div>
                              <div style={{ fontSize: 11, color: "var(--a-text-3)", marginTop: 2 }}>
                                {product.brand?.name ?? "No brand"} · {product.slug}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td style={{ color: "var(--a-text-2)", fontSize: 12 }}>
                          {product.category?.name ?? "—"}
                        </td>
                        <td style={{ color: "var(--a-text-2)", fontSize: 12 }}>
                          {product.variants && product.variants.length > 0 ? (
                            <div>
                              <span style={{ fontWeight: 500 }}>{product.variants.length} variant{product.variants.length !== 1 ? "s" : ""}</span>
                              {(() => {
                                const prices = product.variants.map(v => v.pricePaise).filter(Boolean);
                                if (!prices.length) return null;
                                const min = Math.min(...prices);
                                const max = Math.max(...prices);
                                return (
                                  <div style={{ fontSize: 11, color: "var(--a-text-3)", marginTop: 1 }}>
                                    {min === max ? formatPriceINR(min) : `${formatPriceINR(min)} – ${formatPriceINR(max)}`}
                                  </div>
                                );
                              })()}
                            </div>
                          ) : (
                            <span style={{ color: "var(--a-text-4)" }}>No variants</span>
                          )}
                        </td>
                        <td>
                          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                            <PublishBadge published={product.published} />
                            <AvailabilityBadge availability={product.availability} />
                          </div>
                        </td>
                        <td>
                          <div className="a-table-actions">
                            <Link
                              href={`/admin/products/${product.id}/edit`}
                              className="a-btn a-btn-ghost a-btn-icon a-btn-sm"
                              title="Edit"
                            >
                              <Edit2 style={{ width: 13, height: 13 }} />
                            </Link>
                            <button
                              onClick={() => handleToggleFeatured(product.id, product.isFeatured)}
                              className="a-btn a-btn-ghost a-btn-icon a-btn-sm"
                              title={product.isFeatured ? "Remove from featured" : "Mark as featured"}
                            >
                              {product.isFeatured
                                ? <StarOff style={{ width: 13, height: 13, color: "#d97706" }} />
                                : <Star style={{ width: 13, height: 13 }} />}
                            </button>
                            <button
                              onClick={() => handleDelete(product.id)}
                              disabled={deletingId === product.id}
                              className={`a-btn a-btn-sm a-btn-icon ${deleteConfirmId === product.id ? "a-btn-danger-solid" : "a-btn-ghost"}`}
                              title={deleteConfirmId === product.id ? "Confirm delete?" : "Delete"}
                              style={{ color: deleteConfirmId === product.id ? undefined : "var(--a-danger)" }}
                            >
                              <Trash2 style={{ width: 13, height: 13 }} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile card list */}
            <div className="md:hidden" style={{ borderTop: "1px solid var(--a-border)" }}>
              {products.map((product) => (
                <div key={product.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderBottom: "1px solid var(--a-border)" }}>
                  <div className="a-product-thumb" style={{ width: 40, height: 40 }}>
                    {product.images[0]
                      ? <img src={product.images[0]} alt={product.name} />
                      : <Package style={{ width: 16, height: 16, color: "var(--a-text-3)" }} />
                    }
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 500, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{product.name}</div>
                    <div style={{ fontSize: 11, color: "var(--a-text-3)", marginTop: 2 }}>{product.brand?.name ?? "No brand"}</div>
                    <div style={{ display: "flex", gap: 4, marginTop: 5 }}>
                      <PublishBadge published={product.published} />
                      <AvailabilityBadge availability={product.availability} />
                    </div>
                  </div>
                  <Link href={`/admin/products/${product.id}/edit`} className="a-btn a-btn-secondary a-btn-icon">
                    <Edit2 style={{ width: 14, height: 14 }} />
                  </Link>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="a-pagination">
            <span>
              {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} of {total}
            </span>
            <div className="a-pagination-btns">
              <button
                onClick={() => setPage(p => p - 1)}
                disabled={page === 0}
                className="a-page-btn"
                aria-label="Previous page"
              >
                <ChevronLeft style={{ width: 14, height: 14 }} />
              </button>
              {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => (
                <button
                  key={i}
                  onClick={() => setPage(i)}
                  className={`a-page-btn ${i === page ? "active" : ""}`}
                >
                  {i + 1}
                </button>
              ))}
              <button
                onClick={() => setPage(p => p + 1)}
                disabled={page >= totalPages - 1}
                className="a-page-btn"
                aria-label="Next page"
              >
                <ChevronRight style={{ width: 14, height: 14 }} />
              </button>
            </div>
          </div>
        )}
      </div>

      {deleteConfirmId && (
        <div className="fixed inset-0 z-10" onClick={() => setDeleteConfirmId(null)} />
      )}
    </div>
  );
}
