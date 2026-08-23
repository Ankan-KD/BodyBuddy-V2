"use client";

// ════════════════════════════════════════════════════════════════════════
// Admin — Product Catalog
// READ-ONLY reference catalog. Admin selects → ProductForm prefills.
// ════════════════════════════════════════════════════════════════════════

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Search, BookOpen, Package, Plus, Info, X, Layers, RefreshCw,
  Dumbbell, Flame, Heart, Scale, ChevronRight,
} from "lucide-react";
import type { CatalogProduct } from "@/lib/catalogTypes";

// ── Goal tag helpers ──────────────────────────────────────────────────────

const GOAL_META: Record<string, { label: string; Icon: React.ElementType; cls: string }> = {
  "weight-gain":     { label: "Weight Gain",     Icon: Scale,    cls: "a-badge-blue"    },
  "weight-loss":     { label: "Weight Loss",     Icon: Flame,    cls: "a-badge-orange"  },
  "muscle-building": { label: "Muscle Building", Icon: Dumbbell, cls: "a-badge-yellow"  },
  "general-fitness": { label: "General Fitness", Icon: Heart,    cls: "a-badge-green"   },
};

function GoalTag({ tag }: { tag: string }) {
  const meta = GOAL_META[tag];
  if (!meta) return <span className="a-badge a-badge-neutral">{tag}</span>;
  const { label, Icon, cls } = meta;
  return (
    <span className={`a-badge ${cls}`}>
      <Icon style={{ width: 9, height: 9 }} />
      {label}
    </span>
  );
}

// ── Detail modal ──────────────────────────────────────────────────────────

function CatalogDetailModal({
  product,
  onClose,
  onAddToStore,
}: {
  product: CatalogProduct;
  onClose: () => void;
  onAddToStore: (p: CatalogProduct) => void;
}) {
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.45)" }} onClick={onClose} />
      <div style={{
        position: "relative", width: "100%", maxWidth: 520, maxHeight: "88vh",
        display: "flex", flexDirection: "column",
        background: "var(--a-surface)", border: "1px solid var(--a-border)",
        borderRadius: "var(--a-radius-lg)", boxShadow: "0 8px 32px rgba(0,0,0,0.14)",
        overflow: "hidden",
      }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "14px 16px", borderBottom: "1px solid var(--a-border)", flexShrink: 0 }}>
          <div style={{ width: 52, height: 52, borderRadius: "var(--a-radius)", background: "var(--a-surface-2)", border: "1px solid var(--a-border)", overflow: "hidden", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
            {product.primaryImageUrl
              ? <img src={product.primaryImageUrl} alt={product.productName} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              : <Package style={{ width: 20, height: 20, color: "var(--a-text-3)" }} />
            }
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontWeight: 700, fontSize: 14, lineHeight: 1.3, color: "var(--a-text)" }}>{product.productName}</p>
            <p style={{ fontSize: 12, color: "var(--a-text-3)", marginTop: 2 }}>{product.brand} · {product.category}</p>
            <p style={{ fontSize: 10, color: "var(--a-text-3)", fontFamily: "monospace", marginTop: 2 }}>{product.productId}</p>
          </div>
          <button onClick={onClose} className="a-btn a-btn-ghost a-btn-icon a-btn-sm" aria-label="Close">
            <X style={{ width: 14, height: 14 }} />
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Catalog badge */}
          <div className="a-alert a-alert-info" style={{ padding: "8px 12px" }}>
            <BookOpen style={{ width: 13, height: 13, flexShrink: 0 }} />
            <span style={{ fontSize: 12 }}>This is a <strong>catalog template</strong> — not a live store product. Your edits live only in the database once saved.</span>
          </div>

          {/* Goal tags */}
          {product.goalTags.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
              {product.goalTags.map(t => <GoalTag key={t} tag={t} />)}
            </div>
          )}

          {/* Description */}
          {product.shortDescription && (
            <p style={{ fontSize: 13, color: "var(--a-text-2)", lineHeight: 1.5 }}>{product.shortDescription}</p>
          )}

          {/* Nutrition */}
          {(product.calories !== null || product.proteinG !== null) && (
            <div>
              <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--a-text-3)", marginBottom: 8 }}>
                Nutrition per serving{product.servingSizeLabel ? ` (${product.servingSizeLabel})` : ""}
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6 }}>
                {[
                  { label: "Calories", val: product.calories, unit: "kcal" },
                  { label: "Protein",  val: product.proteinG, unit: "g"    },
                  { label: "Carbs",    val: product.carbohydratesG, unit: "g" },
                  { label: "Fat",      val: product.fatG, unit: "g"        },
                ].map(({ label, val, unit }) => val !== null && (
                  <div key={label} style={{ background: "var(--a-surface-2)", border: "1px solid var(--a-border)", borderRadius: "var(--a-radius)", padding: "8px 6px", textAlign: "center" }}>
                    <p style={{ fontSize: 13, fontWeight: 700, color: "var(--a-text)" }}>{val}{unit}</p>
                    <p style={{ fontSize: 10, color: "var(--a-text-3)" }}>{label}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Variants */}
          {product.variants.length > 0 && (
            <div>
              <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--a-text-3)", marginBottom: 8 }}>
                {product.variants.length} Variant{product.variants.length !== 1 ? "s" : ""}
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {product.variants.map(v => (
                  <div key={v.variantId} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "var(--a-surface-2)", border: "1px solid var(--a-border)", borderRadius: "var(--a-radius)", padding: "8px 12px" }}>
                    <div>
                      <p style={{ fontSize: 12, fontWeight: 500, color: "var(--a-text)" }}>{v.variantName || `${v.sizeWeight}${v.flavour ? ` – ${v.flavour}` : ""}`}</p>
                      <p style={{ fontSize: 10, color: "var(--a-text-3)", fontFamily: "monospace" }}>{v.sku}</p>
                    </div>
                    {v.suggestedPriceINR !== null && (
                      <span style={{ fontSize: 12, fontWeight: 600, color: "var(--a-primary)" }}>₹{v.suggestedPriceINR}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Ingredients */}
          {product.ingredients && (
            <div>
              <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--a-text-3)", marginBottom: 4 }}>Ingredients</p>
              <p style={{ fontSize: 12, color: "var(--a-text-2)", lineHeight: 1.6 }}>{product.ingredients}</p>
            </div>
          )}

          {/* Warnings */}
          {product.warningsAllergens && (
            <div className="a-alert a-alert-warning">
              <Info style={{ width: 13, height: 13, flexShrink: 0 }} />
              <div>
                <p style={{ fontWeight: 600, fontSize: 12, marginBottom: 2 }}>Warnings / Allergens</p>
                <p style={{ fontSize: 12 }}>{product.warningsAllergens}</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: "12px 16px", borderTop: "1px solid var(--a-border)", flexShrink: 0 }}>
          <button
            onClick={() => onAddToStore(product)}
            className="a-btn a-btn-primary a-btn-lg"
            style={{ width: "100%" }}
          >
            <Plus style={{ width: 14, height: 14 }} />
            Add to Store
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Catalog row (table row) ───────────────────────────────────────────────

function CatalogRow({
  product,
  onSelect,
  onAddToStore,
}: {
  product: CatalogProduct;
  onSelect: (p: CatalogProduct) => void;
  onAddToStore: (p: CatalogProduct) => void;
}) {
  return (
    <tr>
      <td>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div className="a-product-thumb">
            {product.primaryImageUrl
              ? <img src={product.primaryImageUrl} alt={product.productName} />
              : <Package style={{ width: 14, height: 14, color: "var(--a-text-3)" }} />
            }
          </div>
          <div>
            <div style={{ fontWeight: 500, fontSize: 13, color: "var(--a-text)" }}>{product.productName}</div>
            <div style={{ fontSize: 10, fontFamily: "monospace", color: "var(--a-text-3)", marginTop: 1 }}>{product.productId}</div>
          </div>
        </div>
      </td>
      <td style={{ fontSize: 12, color: "var(--a-text-2)" }}>{product.brand}</td>
      <td style={{ fontSize: 12, color: "var(--a-text-2)" }}>{product.category}</td>
      <td>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
          {product.goalTags.slice(0, 2).map(t => <GoalTag key={t} tag={t} />)}
          {product.goalTags.length > 2 && <span style={{ fontSize: 10, color: "var(--a-text-3)" }}>+{product.goalTags.length - 2}</span>}
        </div>
      </td>
      <td style={{ fontSize: 12, color: "var(--a-text-2)" }}>
        {product.proteinG !== null ? `${product.proteinG}g protein` : "—"}
      </td>
      <td style={{ fontSize: 12, color: "var(--a-text-2)" }}>
        {product.variants.length} variant{product.variants.length !== 1 ? "s" : ""}
      </td>
      <td>
        <div className="a-table-actions">
          <button onClick={() => onSelect(product)} className="a-btn a-btn-ghost a-btn-sm" style={{ fontSize: 11 }}>
            <ChevronRight style={{ width: 12, height: 12 }} />
            Details
          </button>
          <button
            onClick={() => onAddToStore(product)}
            className="a-btn a-btn-primary a-btn-sm"
          >
            <Plus style={{ width: 12, height: 12 }} />
            Add to Store
          </button>
        </div>
      </td>
    </tr>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────

export default function AdminCatalogPage() {
  const router = useRouter();
  const [catalog, setCatalog] = useState<CatalogProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [goalFilter, setGoalFilter] = useState("");
  const [selected, setSelected] = useState<CatalogProduct | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { getProductCatalog } = await import("@/lib/productCatalog");
        const data = await getProductCatalog();
        if (!cancelled) { setCatalog(data); setLoading(false); }
      } catch (err) {
        console.error("[AdminCatalog] Failed to load catalog:", err);
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const categories = useMemo(() => {
    const s = new Set(catalog.map(p => p.category).filter(Boolean));
    return Array.from(s).sort();
  }, [catalog]);

  const filtered = useMemo(() => catalog.filter(p => {
    if (search.trim() &&
      !p.productName.toLowerCase().includes(search.toLowerCase()) &&
      !p.brand.toLowerCase().includes(search.toLowerCase()) &&
      !p.searchTags.some(t => t.toLowerCase().includes(search.toLowerCase()))
    ) return false;
    if (categoryFilter && p.category !== categoryFilter) return false;
    if (goalFilter && !p.goalTags.includes(goalFilter)) return false;
    return true;
  }), [catalog, search, categoryFilter, goalFilter]);

  function handleAddToStore(product: CatalogProduct) {
    const params = new URLSearchParams({
      from_catalog: "1",
      catalog_id: product.productId,
      name: product.productName,
      brand: product.brand,
      category: product.category,
      slug: product.slug,
      short_description: product.shortDescription,
      full_description: product.fullDescription,
      usage_info: product.usageInformation,
      ingredients: product.ingredients,
      warnings: product.warningsAllergens,
      images: JSON.stringify(product.imageUrls),
      goal_tags: JSON.stringify(product.goalTags),
      search_tags: JSON.stringify(product.searchTags),
      serving_size_label: product.servingSizeLabel,
      serving_size_g: product.servingSizeG?.toString() ?? "",
      calories: product.calories?.toString() ?? "",
      protein_g: product.proteinG?.toString() ?? "",
      carbohydrates_g: product.carbohydratesG?.toString() ?? "",
      fat_g: product.fatG?.toString() ?? "",
      fibre_g: product.fibreG?.toString() ?? "",
      sugar_g: product.sugarG?.toString() ?? "",
      sodium_mg: product.sodiumMg?.toString() ?? "",
      variants: JSON.stringify(product.variants),
    });
    router.push(`/admin/products/new?${params.toString()}`);
  }

  const hasFilters = !!(search || categoryFilter || goalFilter);

  return (
    <div style={{ maxWidth: 1100 }}>
      {/* Page header */}
      <div className="a-page-header">
        <div>
          <h2 className="a-page-title">Product Catalog</h2>
          <p className="a-page-subtitle">
            Read-only template library — select a product to prefill the store form.
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span className="a-badge a-badge-neutral">
            <Layers style={{ width: 10, height: 10 }} />
            {loading ? "…" : `${catalog.length} products`}
          </span>
        </div>
      </div>

      {/* Info banner */}
      <div className="a-alert a-alert-info" style={{ marginBottom: 16 }}>
        <Info style={{ width: 14, height: 14, flexShrink: 0, marginTop: 1 }} />
        <div style={{ fontSize: 12 }}>
          <strong>How this works:</strong>{" "}
          Browse catalog → click <strong>Add to Store</strong> → the product form prefills → you edit price/stock/publishing → save. The catalog is never modified.
        </div>
      </div>

      {/* Filter bar */}
      <div className="a-filter-bar">
        <div className="a-search-wrap" style={{ flex: 1, minWidth: 200 }}>
          <Search />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, brand, or tag…"
            className="a-search-input"
          />
        </div>

        <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} className="a-filter-select">
          <option value="">All Categories</option>
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>

        <select value={goalFilter} onChange={e => setGoalFilter(e.target.value)} className="a-filter-select">
          <option value="">All Goals</option>
          <option value="weight-gain">Weight Gain</option>
          <option value="weight-loss">Weight Loss</option>
          <option value="muscle-building">Muscle Building</option>
          <option value="general-fitness">General Fitness</option>
        </select>

        {hasFilters && (
          <button
            onClick={() => { setSearch(""); setCategoryFilter(""); setGoalFilter(""); }}
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
            Loading catalog…
          </div>
        ) : catalog.length === 0 ? (
          <div className="a-empty">
            <div className="a-empty-icon"><BookOpen style={{ width: 18, height: 18 }} /></div>
            <div className="a-empty-title">Catalog is empty</div>
            <p className="a-empty-sub">
              Add products to <code style={{ fontSize: 11, background: "var(--a-surface-2)", padding: "1px 5px", borderRadius: 3, border: "1px solid var(--a-border)" }}>src/data/product_catalog.csv</code> to populate.
            </p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="a-empty">
            <div className="a-empty-icon"><Package style={{ width: 18, height: 18 }} /></div>
            <div className="a-empty-title">No products match</div>
            <div className="a-empty-sub">Try adjusting your search or filters.</div>
            <button onClick={() => { setSearch(""); setCategoryFilter(""); setGoalFilter(""); }} className="a-btn a-btn-secondary">Clear filters</button>
          </div>
        ) : (
          <>
            <div className="a-table-wrap">
              <table className="a-table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Brand</th>
                    <th>Category</th>
                    <th>Goals</th>
                    <th>Nutrition</th>
                    <th>Variants</th>
                    <th style={{ textAlign: "right" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(product => (
                    <CatalogRow
                      key={product.productId}
                      product={product}
                      onSelect={setSelected}
                      onAddToStore={p => { setSelected(null); handleAddToStore(p); }}
                    />
                  ))}
                </tbody>
              </table>
            </div>
            <div className="a-pagination">
              <span>Showing {filtered.length} of {catalog.length} catalog product{catalog.length !== 1 ? "s" : ""}</span>
            </div>
          </>
        )}
      </div>

      {/* Detail modal */}
      {selected && (
        <CatalogDetailModal
          product={selected}
          onClose={() => setSelected(null)}
          onAddToStore={p => { setSelected(null); handleAddToStore(p); }}
        />
      )}
    </div>
  );
}
