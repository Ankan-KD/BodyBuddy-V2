"use client";

// ════════════════════════════════════════════════════════════════════════
// Admin — Store Products
// Operational view: products active/managed in the store.
// Separate from the Product Catalogue. Does NOT auto-import catalogue.
// Classification dropdowns are fetched from product_groups/product_types DB tables.
// ════════════════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Plus, Search, Package, Edit2, Star, StarOff,
  ChevronLeft, ChevronRight, RefreshCw, ExternalLink, X,
} from "lucide-react";
import {
  adminFetchProducts,
  adminToggleFeaturedProduct,
  adminUpdateProduct,
} from "@/lib/storeAdminApi";
import {
  fetchAllProductGroups,
  fetchAllProductTypes,
  type ProductGroup,
  type ProductType,
} from "@/lib/catalogueAdminApi";
import type { StoreProduct, StoreProductVariant } from "@/lib/storeTypes";
import { formatPriceINR } from "@/lib/storeTypes";

const PAGE_SIZE = 20;

const PUBLISHED_OPTIONS = [
  { value: "", label: "All Status" },
  { value: "true", label: "Live" },
  { value: "false", label: "Draft" },
];

// ── Visibility badge (published / draft) ─────────────────────────────────
function VisibilityBadge({ published, onToggle }: { published: boolean; onToggle?: () => void }) {
  return published ? (
    <button
      onClick={onToggle}
      className="a-badge a-badge-green"
      title="Live — click to unpublish"
      style={{ cursor: onToggle ? "pointer" : "default", border: "none", whiteSpace: "nowrap" }}
    >
      Live
    </button>
  ) : (
    <button
      onClick={onToggle}
      className="a-badge a-badge-red"
      title="Click to publish"
      style={{ cursor: onToggle ? "pointer" : "default", border: "none", whiteSpace: "nowrap" }}
    >
      Draft — Click to publish
    </button>
  );
}

// ── Stock badge + quantity ────────────────────────────────────────────────
function StockInfo({ variants }: { variants?: StoreProductVariant[] }) {
  if (!variants || variants.length === 0) {
    return <span style={{ color: "var(--a-text-4)", fontSize: 12 }}>—</span>;
  }

  // Aggregate across all variants
  const totalStock = variants.reduce((sum, v) => sum + (v.stockQuantity ?? 0), 0);
  const allOutOfStock = variants.every((v) => v.stockQuantity <= 0 || v.availability === "out_of_stock");
  const anyLowStock = variants.some(
    (v) => v.stockQuantity > 0 && v.stockQuantity <= v.lowStockThreshold && v.availability !== "out_of_stock"
  );

  let label: string;
  let badgeClass: string;

  if (allOutOfStock || totalStock <= 0) {
    label = "Out of Stock";
    badgeClass = "a-badge-red";
  } else if (anyLowStock) {
    label = "Low Stock";
    badgeClass = "a-badge-orange";
  } else {
    label = "In Stock";
    badgeClass = "a-badge-green";
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <span className={`a-badge ${badgeClass}`} style={{ whiteSpace: "nowrap" }}>{label}</span>
      <span style={{ fontSize: 11, color: "var(--a-text-3)" }}>
        {totalStock} unit{totalStock !== 1 ? "s" : ""}
      </span>
    </div>
  );
}

export default function AdminProductsPage() {
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);

  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [groupFilter, setGroupFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [published, setPublished] = useState("");

  // Classification from DB (not hardcoded)
  const [groups, setGroups] = useState<ProductGroup[]>([]);
  const [types, setTypes] = useState<ProductType[]>([]);

  useEffect(() => {
    fetchAllProductGroups().then(setGroups);
    fetchAllProductTypes().then(setTypes);
  }, []);

  const filteredTypes = types.filter((t) => !groupFilter || t.productGroupId === groupFilter);

  const load = useCallback(async () => {
    setLoading(true);
    const opts: Record<string, unknown> = { limit: PAGE_SIZE, offset: page * PAGE_SIZE };
    if (search) opts.search = search;
    if (groupFilter) opts.productGroupId = groupFilter;
    if (typeFilter) opts.productType = typeFilter;
    if (published !== "") opts.published = published === "true";
    const result = await adminFetchProducts(opts);
    setProducts(result.products);
    setTotal(result.total);
    setLoading(false);
  }, [search, groupFilter, typeFilter, published, page]);

  useEffect(() => { load(); }, [load]);

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPage(0);
    setSearch(searchInput);
  }

  async function handleToggleFeatured(id: string, current: boolean) {
    await adminToggleFeaturedProduct(id, !current);
    load();
  }

  async function handleTogglePublished(id: string, current: boolean) {
    await adminUpdateProduct(id, { published: !current });
    load();
  }

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const hasFilters = !!(search || groupFilter || typeFilter || published);

  return (
    <div style={{ maxWidth: 1100 }}>
      {/* Header */}
      <div className="a-page-header">
        <div>
          <h2 className="a-page-title">Store Products</h2>
          <p className="a-page-subtitle">
            {total} product{total !== 1 ? "s" : ""} currently managed in your store · Use{" "}
            <Link href="/admin/catalog" style={{ color: "var(--a-primary)", textDecoration: "none" }}>
              Product Catalogue
            </Link>{" "}
            to add more
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={load} className="a-btn a-btn-secondary a-btn-icon" title="Refresh">
            <RefreshCw style={{ width: 14, height: 14 }} className={loading ? "animate-spin" : ""} />
          </button>
          <Link href="/admin/products/new" className="a-btn a-btn-primary">
            <Plus style={{ width: 14, height: 14 }} /> Add Product
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
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search products…"
              className="a-search-input"
            />
          </div>
          <button type="submit" className="a-btn a-btn-secondary" style={{ height: 32 }}>Search</button>
        </form>

        {/* Product Group */}
        <select
          value={groupFilter}
          onChange={(e) => { setGroupFilter(e.target.value); setTypeFilter(""); setPage(0); }}
          className="a-filter-select"
        >
          <option value="">All Product Groups</option>
          {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>

        {/* Product Type — scoped to selected group */}
        <select
          value={typeFilter}
          onChange={(e) => { setTypeFilter(e.target.value); setPage(0); }}
          className="a-filter-select"
        >
          <option value="">All Product Types</option>
          {filteredTypes.map((t) => <option key={t.id} value={t.name}>{t.name}</option>)}
        </select>

        <select
          value={published}
          onChange={(e) => { setPublished(e.target.value); setPage(0); }}
          className="a-filter-select"
        >
          {PUBLISHED_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>

        {hasFilters && (
          <button
            onClick={() => { setSearch(""); setSearchInput(""); setGroupFilter(""); setTypeFilter(""); setPublished(""); setPage(0); }}
            className="a-btn a-btn-ghost"
            style={{ height: 32, fontSize: 12, color: "var(--a-danger)" }}
          >
            <X style={{ width: 12, height: 12 }} /> Clear
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
              {hasFilters ? "Try adjusting your filters." : "Add products from the Product Catalogue."}
            </div>
            {!hasFilters && (
              <Link href="/admin/catalog" className="a-btn a-btn-primary">
                <Plus style={{ width: 14, height: 14 }} /> Browse Catalogue
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
                    <th>Product Group</th>
                    <th>Product Type</th>
                    <th>Variants</th>
                    <th>Visibility</th>
                    <th>Stock</th>
                    <th style={{ textAlign: "right" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((product, i) => {
                    const img = product.images[0];
                    const prices = (product.variants ?? []).map((v) => v.pricePaise).filter(Boolean);
                    const minPrice = prices.length ? Math.min(...prices) : null;
                    const maxPrice = prices.length ? Math.max(...prices) : null;

                    return (
                      <tr key={product.id}>
                        <td style={{ color: "var(--a-text-3)", fontSize: 12 }}>{page * PAGE_SIZE + i + 1}</td>

                        {/* Product name + brand */}
                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <div className="a-product-thumb">
                              {img
                                ? <img src={img} alt={product.name} />
                                : <Package style={{ width: 14, height: 14, color: "var(--a-text-3)" }} />}
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
                              {product.brand?.name && (
                                <div style={{ fontSize: 11, color: "var(--a-text-3)", marginTop: 2 }}>
                                  {product.brand.name}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Product Group */}
                        <td style={{ color: "var(--a-text-2)", fontSize: 12 }}>
                          {product.productGroup?.name
                            ? product.productGroup.name
                            : <span style={{ color: "var(--a-text-4)" }}>—</span>}
                        </td>

                        {/* Product Type */}
                        <td style={{ color: "var(--a-text-2)", fontSize: 12 }}>
                          {product.productType
                            ? product.productType
                            : <span style={{ color: "var(--a-text-4)" }}>—</span>}
                        </td>

                        {/* Variants + price range */}
                        <td style={{ color: "var(--a-text-2)", fontSize: 12 }}>
                          {product.variants && product.variants.length > 0 ? (
                            <div>
                              <span style={{ fontWeight: 500 }}>
                                {product.variants.length} variant{product.variants.length !== 1 ? "s" : ""}
                              </span>
                              {minPrice !== null && (
                                <div style={{ fontSize: 11, color: "var(--a-text-3)", marginTop: 1 }}>
                                  {minPrice === maxPrice
                                    ? formatPriceINR(minPrice)
                                    : `${formatPriceINR(minPrice)} – ${formatPriceINR(maxPrice!)}`}
                                </div>
                              )}
                            </div>
                          ) : (
                            <span style={{ color: "var(--a-text-4)" }}>No variants</span>
                          )}
                        </td>

                        {/* Visibility — published/draft only */}
                        <td>
                          <VisibilityBadge
                            published={product.published}
                            onToggle={() => handleTogglePublished(product.id, product.published)}
                          />
                        </td>

                        {/* Stock — quantity + status */}
                        <td>
                          <StockInfo variants={product.variants} />
                        </td>

                        {/* Actions */}
                        <td>
                          <div className="a-table-actions">
                            <Link
                              href={`/admin/products/${product.id}/edit`}
                              className="a-btn a-btn-ghost a-btn-icon a-btn-sm"
                              title="Edit"
                            >
                              <Edit2 style={{ width: 13, height: 13 }} />
                            </Link>
                            {product.published && (
                              <Link
                                href={`/store/products/${product.slug}`}
                                target="_blank"
                                className="a-btn a-btn-ghost a-btn-icon a-btn-sm"
                                title="View in store"
                              >
                                <ExternalLink style={{ width: 13, height: 13, color: "var(--a-accent)" }} />
                              </Link>
                            )}
                            <button
                              onClick={() => handleToggleFeatured(product.id, product.isFeatured)}
                              className="a-btn a-btn-ghost a-btn-icon a-btn-sm"
                              title={product.isFeatured ? "Remove from featured" : "Mark as featured"}
                            >
                              {product.isFeatured
                                ? <StarOff style={{ width: 13, height: 13, color: "#d97706" }} />
                                : <Star style={{ width: 13, height: 13 }} />}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden" style={{ borderTop: "1px solid var(--a-border)" }}>
              {products.map((product) => (
                <div
                  key={product.id}
                  style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderBottom: "1px solid var(--a-border)" }}
                >
                  <div className="a-product-thumb" style={{ width: 40, height: 40 }}>
                    {product.images[0]
                      ? <img src={product.images[0]} alt={product.name} />
                      : <Package style={{ width: 16, height: 16, color: "var(--a-text-3)" }} />}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 500, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {product.name}
                    </div>
                    {product.brand?.name && (
                      <div style={{ fontSize: 11, color: "var(--a-text-3)", marginTop: 1 }}>
                        {product.brand.name}
                      </div>
                    )}
                    <div style={{ fontSize: 11, color: "var(--a-text-3)", marginTop: 2 }}>
                      {product.productGroup?.name ?? "—"}{product.productType ? ` · ${product.productType}` : ""}
                    </div>
                    <div style={{ display: "flex", gap: 4, marginTop: 5, flexWrap: "wrap" }}>
                      <VisibilityBadge
                        published={product.published}
                        onToggle={() => handleTogglePublished(product.id, product.published)}
                      />
                      <StockInfo variants={product.variants} />
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
            <span>{page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} of {total}</span>
            <div className="a-pagination-btns">
              <button onClick={() => setPage((p) => p - 1)} disabled={page === 0} className="a-page-btn">
                <ChevronLeft style={{ width: 14, height: 14 }} />
              </button>
              {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => (
                <button key={i} onClick={() => setPage(i)} className={`a-page-btn ${i === page ? "active" : ""}`}>
                  {i + 1}
                </button>
              ))}
              <button onClick={() => setPage((p) => p + 1)} disabled={page >= totalPages - 1} className="a-page-btn">
                <ChevronRight style={{ width: 14, height: 14 }} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}