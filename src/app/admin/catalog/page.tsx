"use client";

// ════════════════════════════════════════════════════════════════════════
// Admin — Product Catalogue
// The DB is the source of truth. CSV is only for initial/bulk import.
// From here admins can view & edit all catalogue product info.
// ════════════════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Search, BookOpen, Package, Plus, X, RefreshCw, Upload,
  Edit2, ChevronLeft, ChevronRight, Info, Dumbbell, Flame, Heart, Scale,
  Check, AlertTriangle, ExternalLink, Eye, Tag, Hash, ShieldAlert, Layers,
  Box, IndianRupee, Target,
} from "lucide-react";
import {
  fetchCatalogue,
  fetchCatalogueProductById,
  fetchAllProductGroups,
  fetchAllProductTypes,
  updateCatalogueProduct,
  importCatalogueFromRows,
  type CatalogueProduct,
  type CatalogueVariant,
  type ProductGroup,
  type ProductType,
  type CatalogueImportRow,
} from "@/lib/catalogueAdminApi";
import { adminFetchImportedCatalogIds } from "@/lib/storeAdminApi";
import { useRouter } from "next/navigation";

const PAGE_SIZE = 25;

// ── Goal badge ────────────────────────────────────────────────────────────

const GOAL_META: Record<string, { label: string; Icon: React.ElementType; cls: string }> = {
  "weight-gain":     { label: "Weight Gain",     Icon: Scale,    cls: "a-badge-blue"   },
  "weight-loss":     { label: "Weight Loss",     Icon: Flame,    cls: "a-badge-orange" },
  "muscle-building": { label: "Muscle Building", Icon: Dumbbell, cls: "a-badge-yellow" },
  "general-fitness": { label: "General Fitness", Icon: Heart,    cls: "a-badge-green"  },
};

function GoalBadge({ tag }: { tag: string }) {
  const meta = GOAL_META[tag.toLowerCase().replace(/\s+/g, "-")];
  if (!meta) return <span className="a-badge a-badge-blue">{tag}</span>;
  const { label, Icon, cls } = meta;
  return <span className={`a-badge ${cls}`}><Icon style={{ width: 9, height: 9 }} />{label}</span>;
}

// ── Inline editable cell ──────────────────────────────────────────────────

function EditableCell({
  value,
  onSave,
  multiline = false,
}: {
  value: string;
  onSave: (v: string) => Promise<void>;
  multiline?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);

  async function save() {
    if (draft === value) { setEditing(false); return; }
    setSaving(true);
    await onSave(draft);
    setSaving(false);
    setEditing(false);
  }

  if (!editing) {
    return (
      <div
        style={{ display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }}
        onClick={() => { setDraft(value); setEditing(true); }}
        title="Click to edit"
      >
        <span style={{ fontSize: 12 }}>{value || <span style={{ color: "var(--a-text-4)" }}>—</span>}</span>
        <Edit2 style={{ width: 10, height: 10, color: "var(--a-text-4)", flexShrink: 0 }} />
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {multiline ? (
        <textarea
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={3}
          style={{ fontSize: 12, resize: "vertical", width: "100%", padding: "4px 6px", borderRadius: "var(--a-radius)", border: "1px solid var(--a-primary)", outline: "none" }}
        />
      ) : (
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") setEditing(false); }}
          style={{ fontSize: 12, padding: "3px 6px", borderRadius: "var(--a-radius)", border: "1px solid var(--a-primary)", outline: "none", width: "100%" }}
        />
      )}
      <div style={{ display: "flex", gap: 4 }}>
        <button onClick={save} disabled={saving} className="a-btn a-btn-primary a-btn-sm" style={{ fontSize: 11, padding: "2px 8px" }}>
          {saving ? <RefreshCw style={{ width: 10, height: 10 }} className="animate-spin" /> : <Check style={{ width: 10, height: 10 }} />} Save
        </button>
        <button onClick={() => setEditing(false)} className="a-btn a-btn-ghost a-btn-sm" style={{ fontSize: 11 }}>
          <X style={{ width: 10, height: 10 }} />
        </button>
      </div>
    </div>
  );
}

// ── Select editable cell (for product group / type) ───────────────────────

function SelectCell({
  value,
  options,
  onSave,
}: {
  value: string;
  options: { id: string; name: string }[];
  onSave: (id: string, name: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  async function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const id = e.target.value;
    const opt = options.find((o) => o.id === id);
    if (!opt) return;
    setSaving(true);
    await onSave(opt.id, opt.name);
    setSaving(false);
    setEditing(false);
  }

  if (!editing) {
    return (
      <div
        style={{ display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }}
        onClick={() => setEditing(true)}
        title="Click to change"
      >
        <span style={{ fontSize: 12 }}>{value || <span style={{ color: "var(--a-text-4)" }}>—</span>}</span>
        <Edit2 style={{ width: 10, height: 10, color: "var(--a-text-4)", flexShrink: 0 }} />
      </div>
    );
  }

  return (
    <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
      {saving ? (
        <RefreshCw style={{ width: 12, height: 12 }} className="animate-spin" />
      ) : (
        <select autoFocus onChange={handleChange} defaultValue="" className="a-filter-select" style={{ height: 26, fontSize: 11 }}>
          <option value="" disabled>Select…</option>
          {options.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
        </select>
      )}
      <button onClick={() => setEditing(false)} className="a-btn a-btn-ghost a-btn-icon a-btn-sm">
        <X style={{ width: 10, height: 10 }} />
      </button>
    </div>
  );
}

// ── Variant helpers ────────────────────────────────────────────────────────

function variantLabel(v: CatalogueVariant): string {
  if (v.variantName) return v.variantName;
  const parts = [v.sizeWeight, v.flavour].filter(Boolean);
  return parts.length > 0 ? parts.join(" – ") : v.sku || "Variant";
}

// ── Product Detail view (read-only, restored product-detail view) ────────
//
// Shows full catalog-template info for a product, with a variant selector
// that updates price / SKU / size / nutrition / stock for the chosen
// variant. This is distinct from the Edit panel below — the existing
// Edit button keeps opening that panel unchanged; this view is reached via
// the new "View" action and links out to Edit via its footer button.

function ProductDetailView({
  product,
  onClose,
  onEdit,
}: {
  product: CatalogueProduct;
  onClose: () => void;
  onEdit: () => void;
}) {
  const defaultVariant = product.variants.find((v) => v.isDefaultVariant) ?? product.variants[0] ?? null;
  const [selectedVariantId, setSelectedVariantId] = useState<string>(defaultVariant?.id ?? "");

  const variant = product.variants.find((v) => v.id === selectedVariantId) ?? defaultVariant;

  // Variant-level nutrition falls back to product-level when blank, per catalogTypes.ts
  const nutrition = variant
    ? {
        calories: variant.calories ?? product.calories,
        proteinG: variant.proteinG ?? product.proteinG,
        carbohydratesG: variant.carbohydratesG ?? product.carbohydratesG,
        fatG: variant.fatG ?? product.fatG,
        fibreG: variant.fibreG ?? product.fibreG,
        sugarG: variant.sugarG ?? product.sugarG,
        sodiumMg: variant.sodiumMg ?? product.sodiumMg,
        servingSizeLabel: variant.servingSizeLabel || product.servingSizeLabel,
      }
    : {
        calories: product.calories, proteinG: product.proteinG, carbohydratesG: product.carbohydratesG,
        fatG: product.fatG, fibreG: product.fibreG, sugarG: product.sugarG, sodiumMg: product.sodiumMg,
        servingSizeLabel: product.servingSizeLabel,
      };

  const lowStock = variant ? variant.stockQuantity <= variant.lowStockThreshold : false;
  const outOfStock = variant ? variant.stockQuantity <= 0 : false;

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex" }}>
      <div style={{ flex: 1, background: "rgba(0,0,0,0.4)" }} onClick={onClose} />
      <div style={{
        width: "min(560px, 95vw)", background: "var(--a-surface)", borderLeft: "1px solid var(--a-border)",
        display: "flex", flexDirection: "column", height: "100%", overflowY: "auto",
      }}>
        {/* Header */}
        <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--a-border)", display: "flex", alignItems: "center", gap: 10, background: "var(--a-surface-2)" }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 14 }}>{product.productName}</div>
            <div style={{ fontSize: 11, color: "var(--a-text-3)", marginTop: 2, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
              <span style={{ fontFamily: "monospace" }}>{product.productId}</span>
              <span>·</span>
              <span>{product.brand || "—"}</span>
              <span>·</span>
              <span>{product.productGroupName || "Unclassified"}</span>
            </div>
          </div>
          <button onClick={onClose} className="a-btn a-btn-ghost a-btn-icon a-btn-sm"><X style={{ width: 14, height: 14 }} /></button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, padding: 16, display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Catalog status */}
          <div className="a-alert a-alert-info">
            <BookOpen style={{ width: 13, height: 13, flexShrink: 0 }} />
            <span style={{ fontSize: 12 }}>
              <strong>This is a catalog template</strong> — reference data used to prefill new store listings, not a live product for sale.
            </span>
          </div>

          {/* Product Information */}
          <div className="a-card" style={{ padding: "12px 14px" }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "var(--a-text-3)", marginBottom: 10, letterSpacing: "0.05em" }}>Product Information</div>
            <div className="a-grid-2" style={{ gap: 10 }}>
              <div>
                <div style={{ fontSize: 10, color: "var(--a-text-3)", fontWeight: 600, marginBottom: 3 }}>Product Name</div>
                <div style={{ fontSize: 12 }}>{product.productName}</div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: "var(--a-text-3)", fontWeight: 600, marginBottom: 3 }}>Brand</div>
                <div style={{ fontSize: 12 }}>{product.brand || "—"}</div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: "var(--a-text-3)", fontWeight: 600, marginBottom: 3 }}>Product Group</div>
                <div style={{ fontSize: 12 }}>{product.productGroupName || "—"}</div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: "var(--a-text-3)", fontWeight: 600, marginBottom: 3 }}>Product ID</div>
                <div style={{ fontSize: 12, fontFamily: "monospace" }}>{product.productId}</div>
              </div>
            </div>
          </div>

          {/* Variant selector */}
          {product.variants.length > 0 && variant && (
            <div className="a-card" style={{ padding: "12px 14px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "var(--a-text-3)", letterSpacing: "0.05em" }}>Variant</div>
                {variant.isDefaultVariant && <span className="a-badge a-badge-blue" style={{ fontSize: 9 }}>Default</span>}
              </div>
              <select
                value={selectedVariantId}
                onChange={(e) => setSelectedVariantId(e.target.value)}
                className="a-filter-select"
                style={{ width: "100%", marginBottom: 12 }}
              >
                {product.variants.map((v) => (
                  <option key={v.id} value={v.id}>{variantLabel(v)}{v.isDefaultVariant ? " (Default)" : ""}</option>
                ))}
              </select>

              <div className="a-grid-2" style={{ gap: 8 }}>
                <div style={{ background: "var(--a-surface-2)", border: "1px solid var(--a-border)", borderRadius: "var(--a-radius)", padding: "8px 10px" }}>
                  <div style={{ fontSize: 10, color: "var(--a-text-3)", fontWeight: 600, marginBottom: 3, display: "flex", alignItems: "center", gap: 4 }}>
                    <IndianRupee style={{ width: 10, height: 10 }} /> Price
                  </div>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: "var(--a-primary)" }}>
                      {variant.suggestedPriceINR !== null ? `₹${variant.suggestedPriceINR.toLocaleString("en-IN")}` : "—"}
                    </span>
                    {variant.compareAtPriceINR !== null && variant.compareAtPriceINR !== variant.suggestedPriceINR && (
                      <span style={{ fontSize: 11, color: "var(--a-text-3)", textDecoration: "line-through" }}>
                        ₹{variant.compareAtPriceINR.toLocaleString("en-IN")}
                      </span>
                    )}
                  </div>
                </div>

                <div style={{ background: "var(--a-surface-2)", border: "1px solid var(--a-border)", borderRadius: "var(--a-radius)", padding: "8px 10px" }}>
                  <div style={{ fontSize: 10, color: "var(--a-text-3)", fontWeight: 600, marginBottom: 3, display: "flex", alignItems: "center", gap: 4 }}>
                    <Hash style={{ width: 10, height: 10 }} /> SKU
                  </div>
                  <div style={{ fontSize: 12, fontFamily: "monospace" }}>{variant.sku || "—"}</div>
                </div>

                <div style={{ background: "var(--a-surface-2)", border: "1px solid var(--a-border)", borderRadius: "var(--a-radius)", padding: "8px 10px" }}>
                  <div style={{ fontSize: 10, color: "var(--a-text-3)", fontWeight: 600, marginBottom: 3, display: "flex", alignItems: "center", gap: 4 }}>
                    <Layers style={{ width: 10, height: 10 }} /> Size
                  </div>
                  <div style={{ fontSize: 12 }}>
                    {[variant.sizeWeight, variant.flavour, variant.colour].filter(Boolean).join(" · ") || "—"}
                  </div>
                </div>

                <div style={{ background: "var(--a-surface-2)", border: "1px solid var(--a-border)", borderRadius: "var(--a-radius)", padding: "8px 10px" }}>
                  <div style={{ fontSize: 10, color: "var(--a-text-3)", fontWeight: 600, marginBottom: 3, display: "flex", alignItems: "center", gap: 4 }}>
                    <Box style={{ width: 10, height: 10 }} /> Stock
                  </div>
                  <div style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 6 }}>
                    {variant.stockQuantity} units
                    {outOfStock ? (
                      <span className="a-badge a-badge-red" style={{ fontSize: 9 }}>Out of stock</span>
                    ) : lowStock ? (
                      <span className="a-badge a-badge-yellow" style={{ fontSize: 9 }}>Low stock</span>
                    ) : null}
                  </div>
                </div>
              </div>

              {/* Variant nutrition */}
              {(nutrition.calories !== null || nutrition.proteinG !== null || nutrition.carbohydratesG !== null || nutrition.fatG !== null) && (
                <div style={{ marginTop: 12 }}>
                  <div style={{ fontSize: 10, color: "var(--a-text-3)", fontWeight: 600, marginBottom: 6 }}>
                    Nutrition {nutrition.servingSizeLabel ? `(per ${nutrition.servingSizeLabel})` : ""}
                  </div>
                  <div className="a-grid-4" style={{ gap: 6 }}>
                    {[
                      { label: "Calories", val: nutrition.calories, unit: "kcal" },
                      { label: "Protein",  val: nutrition.proteinG, unit: "g" },
                      { label: "Carbs",    val: nutrition.carbohydratesG, unit: "g" },
                      { label: "Fat",      val: nutrition.fatG, unit: "g" },
                    ].map(({ label, val, unit }) => val !== null && (
                      <div key={label} style={{ background: "var(--a-surface-2)", border: "1px solid var(--a-border)", borderRadius: "var(--a-radius)", padding: "8px 6px", textAlign: "center" }}>
                        <p style={{ fontSize: 13, fontWeight: 700, color: "var(--a-text)" }}>{val}{unit}</p>
                        <p style={{ fontSize: 10, color: "var(--a-text-3)" }}>{label}</p>
                      </div>
                    ))}
                  </div>
                  {(nutrition.fibreG !== null || nutrition.sugarG !== null || nutrition.sodiumMg !== null) && (
                    <div style={{ display: "flex", gap: 10, marginTop: 6, fontSize: 11, color: "var(--a-text-3)" }}>
                      {nutrition.fibreG !== null && <span>Fibre: {nutrition.fibreG}g</span>}
                      {nutrition.sugarG !== null && <span>Sugar: {nutrition.sugarG}g</span>}
                      {nutrition.sodiumMg !== null && <span>Sodium: {nutrition.sodiumMg}mg</span>}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Goals & Aim */}
          {(product.goalTags.length > 0 || product.aimTags.length > 0) && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "var(--a-text-3)", marginBottom: 8, letterSpacing: "0.05em", display: "flex", alignItems: "center", gap: 5 }}>
                <Target style={{ width: 11, height: 11 }} /> Goals &amp; Aim
              </div>
              {product.goalTags.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: product.aimTags.length > 0 ? 8 : 0 }}>
                  {product.goalTags.map((t) => <GoalBadge key={t} tag={t} />)}
                </div>
              )}
              {product.aimTags.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                  {product.aimTags.map((t) => <span key={t} className="a-tag">{t}</span>)}
                </div>
              )}
            </div>
          )}

          {/* Search tags */}
          {product.searchTags.length > 0 && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "var(--a-text-3)", marginBottom: 8, letterSpacing: "0.05em", display: "flex", alignItems: "center", gap: 5 }}>
                <Tag style={{ width: 11, height: 11 }} /> Search Tags
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                {product.searchTags.map((t) => <span key={t} className="a-tag">{t}</span>)}
              </div>
            </div>
          )}

          {/* Description */}
          {(product.shortDescription || product.fullDescription) && (
            <div className="a-card" style={{ padding: "12px 14px" }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "var(--a-text-3)", marginBottom: 10, letterSpacing: "0.05em" }}>Product Description</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {product.shortDescription && (
                  <div>
                    <div style={{ fontSize: 10, color: "var(--a-text-3)", marginBottom: 4, fontWeight: 600 }}>Short Description</div>
                    <div style={{ fontSize: 12, color: "var(--a-text-2)", whiteSpace: "pre-wrap" }}>{product.shortDescription}</div>
                  </div>
                )}
                {product.fullDescription && (
                  <div>
                    <div style={{ fontSize: 10, color: "var(--a-text-3)", marginBottom: 4, fontWeight: 600 }}>Full Description</div>
                    <div style={{ fontSize: 12, color: "var(--a-text-2)", whiteSpace: "pre-wrap" }}>{product.fullDescription}</div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Warnings / Allergens */}
          {product.warningsAllergens && (
            <div className="a-alert a-alert-warning" style={{ alignItems: "flex-start" }}>
              <ShieldAlert style={{ width: 13, height: 13, flexShrink: 0, marginTop: 1 }} />
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 2 }}>Warnings &amp; Allergens</div>
                <div style={{ fontSize: 12, whiteSpace: "pre-wrap" }}>{product.warningsAllergens}</div>
              </div>
            </div>
          )}

          {/* Images */}
          {product.imageUrls.length > 0 && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "var(--a-text-3)", marginBottom: 8, letterSpacing: "0.05em" }}>Images</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {product.imageUrls.map((url, i) => (
                  <div key={i} style={{ width: 64, height: 64, border: "1px solid var(--a-border)", borderRadius: "var(--a-radius)", overflow: "hidden", background: "var(--a-surface-2)" }}>
                    <img src={url} alt={`Image ${i + 1}`} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer — Edit Product stays accessible from the view, same as the table's Edit button */}
        <div style={{ padding: "12px 16px", borderTop: "1px solid var(--a-border)", background: "var(--a-surface-2)" }}>
          <button onClick={onEdit} className="a-btn a-btn-primary" style={{ width: "100%" }}>
            <Edit2 style={{ width: 14, height: 14 }} /> Edit Product
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Detail panel (slide-in side panel) ───────────────────────────────────

function DetailPanel({
  product,
  groups,
  types,
  onClose,
  onRefresh,
  onAddToStore,
  isInStore,
}: {
  product: CatalogueProduct;
  groups: ProductGroup[];
  types: ProductType[];
  onClose: () => void;
  onRefresh: () => void;
  onAddToStore: (p: CatalogueProduct) => void;
  isInStore: boolean;
}) {
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const filteredTypes = types.filter(
    (t) => !product.productGroupId || t.productGroupId === product.productGroupId
  );

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }

  async function save(field: string, value: unknown) {
    setSaving(true);
    const { error } = await updateCatalogueProduct(product.id, { [field]: value } as never);
    setSaving(false);
    if (error) { showToast("Save failed: " + error); return; }
    showToast("Saved");
    onRefresh();
  }

  async function saveGroupId(id: string) {
    await save("product_group_id", id);
  }

  async function saveTypeId(id: string) {
    await save("product_type_id", id);
  }

  const defaultVariant = product.variants.find((v) => v.isDefaultVariant) ?? product.variants[0];

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex" }}>
      <div style={{ flex: 1, background: "rgba(0,0,0,0.4)" }} onClick={onClose} />
      <div style={{
        width: "min(560px, 95vw)", background: "var(--a-surface)", borderLeft: "1px solid var(--a-border)",
        display: "flex", flexDirection: "column", height: "100%", overflowY: "auto",
      }}>
        {/* Header */}
        <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--a-border)", display: "flex", alignItems: "center", gap: 10, background: "var(--a-surface-2)" }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 14 }}>{product.productName}</div>
            <div style={{ fontSize: 11, color: "var(--a-text-3)", marginTop: 2 }}>
              {product.productId} · {product.brand}
            </div>
          </div>
          {saving && <RefreshCw style={{ width: 13, height: 13 }} className="animate-spin" />}
          {toast && <span style={{ fontSize: 11, color: "var(--a-success)", fontWeight: 500 }}>{toast}</span>}
          <button onClick={onClose} className="a-btn a-btn-ghost a-btn-icon a-btn-sm"><X style={{ width: 14, height: 14 }} /></button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, padding: 16, display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Classification */}
          <div className="a-card" style={{ padding: "12px 14px" }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "var(--a-text-3)", marginBottom: 10, letterSpacing: "0.05em" }}>Classification</div>
            <div className="a-grid-2" style={{ gap: 12 }}>
              <div>
                <div style={{ fontSize: 10, color: "var(--a-text-3)", marginBottom: 4, fontWeight: 600 }}>Product Group</div>
                <SelectCell
                  value={product.productGroupName}
                  options={groups}
                  onSave={async (id) => { await saveGroupId(id); }}
                />
              </div>
              <div>
                <div style={{ fontSize: 10, color: "var(--a-text-3)", marginBottom: 4, fontWeight: 600 }}>Product Type</div>
                <SelectCell
                  value={product.productTypeName}
                  options={filteredTypes}
                  onSave={async (id) => { await saveTypeId(id); }}
                />
              </div>
            </div>
          </div>

          {/* Descriptions */}
          <div className="a-card" style={{ padding: "12px 14px" }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "var(--a-text-3)", marginBottom: 10, letterSpacing: "0.05em" }}>Descriptions</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div>
                <div style={{ fontSize: 10, color: "var(--a-text-3)", marginBottom: 4, fontWeight: 600 }}>Short Description</div>
                <EditableCell value={product.shortDescription} onSave={(v) => save("short_description", v)} multiline />
              </div>
              <div>
                <div style={{ fontSize: 10, color: "var(--a-text-3)", marginBottom: 4, fontWeight: 600 }}>Full Description</div>
                <EditableCell value={product.fullDescription} onSave={(v) => save("full_description", v)} multiline />
              </div>
              <div>
                <div style={{ fontSize: 10, color: "var(--a-text-3)", marginBottom: 4, fontWeight: 600 }}>Usage Information</div>
                <EditableCell value={product.usageInformation} onSave={(v) => save("usage_information", v)} multiline />
              </div>
              <div>
                <div style={{ fontSize: 10, color: "var(--a-text-3)", marginBottom: 4, fontWeight: 600 }}>Ingredients</div>
                <EditableCell value={product.ingredients} onSave={(v) => save("ingredients", v)} multiline />
              </div>
              <div>
                <div style={{ fontSize: 10, color: "var(--a-text-3)", marginBottom: 4, fontWeight: 600 }}>Warnings / Allergens</div>
                <EditableCell value={product.warningsAllergens} onSave={(v) => save("warnings_allergens", v)} multiline />
              </div>
            </div>
          </div>

          {/* Nutrition */}
          {(product.calories !== null || product.proteinG !== null) && (
            <div className="a-card" style={{ padding: "12px 14px" }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "var(--a-text-3)", marginBottom: 10, letterSpacing: "0.05em" }}>
                Nutrition {product.servingSizeLabel ? `(per ${product.servingSizeLabel})` : ""}
              </div>
              <div className="a-grid-4" style={{ gap: 6 }}>
                {[
                  { label: "Calories", val: product.calories, unit: "kcal" },
                  { label: "Protein",  val: product.proteinG, unit: "g" },
                  { label: "Carbs",    val: product.carbohydratesG, unit: "g" },
                  { label: "Fat",      val: product.fatG, unit: "g" },
                ].map(({ label, val, unit }) => val !== null && (
                  <div key={label} style={{ background: "var(--a-surface-2)", border: "1px solid var(--a-border)", borderRadius: "var(--a-radius)", padding: "8px 6px", textAlign: "center" }}>
                    <p style={{ fontSize: 13, fontWeight: 700, color: "var(--a-text)" }}>{val}{unit}</p>
                    <p style={{ fontSize: 10, color: "var(--a-text-3)" }}>{label}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Goals */}
          {product.goalTags.length > 0 && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "var(--a-text-3)", marginBottom: 8, letterSpacing: "0.05em" }}>Goals</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                {product.goalTags.map((t) => <GoalBadge key={t} tag={t} />)}
              </div>
            </div>
          )}

          {/* Variants */}
          {product.variants.length > 0 && (
            <div className="a-card" style={{ padding: "12px 14px" }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "var(--a-text-3)", marginBottom: 10, letterSpacing: "0.05em" }}>
                Variants ({product.variants.length})
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {product.variants.map((v) => (
                  <div key={v.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 10px", background: v.isDefaultVariant ? "var(--a-primary-light)" : "var(--a-surface-2)", border: `1px solid ${v.isDefaultVariant ? "var(--a-primary)" : "var(--a-border)"}`, borderRadius: "var(--a-radius)" }}>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 500 }}>{v.variantName || `${v.sizeWeight}${v.flavour ? ` – ${v.flavour}` : ""}`}</div>
                      <div style={{ fontSize: 10, color: "var(--a-text-3)", fontFamily: "monospace" }}>{v.sku}</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      {v.suggestedPriceINR !== null && <div style={{ fontSize: 13, fontWeight: 700, color: "var(--a-primary)" }}>₹{v.suggestedPriceINR.toLocaleString("en-IN")}</div>}
                      {v.isDefaultVariant && <span className="a-badge a-badge-blue" style={{ fontSize: 9 }}>Default</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Images */}
          {product.imageUrls.length > 0 && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "var(--a-text-3)", marginBottom: 8, letterSpacing: "0.05em" }}>Images</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {product.imageUrls.map((url, i) => (
                  <div key={i} style={{ width: 64, height: 64, border: "1px solid var(--a-border)", borderRadius: "var(--a-radius)", overflow: "hidden", background: "var(--a-surface-2)" }}>
                    <img src={url} alt={`Image ${i + 1}`} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: "12px 16px", borderTop: "1px solid var(--a-border)", background: "var(--a-surface-2)" }}>
          <button
            onClick={() => onAddToStore(product)}
            className={`a-btn ${isInStore ? "a-btn-secondary" : "a-btn-primary"}`}
            style={{ width: "100%" }}
          >
            <Plus style={{ width: 14, height: 14 }} />
            {isInStore ? "Add Another to Store" : "Add to Store"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── CSV Import Modal ──────────────────────────────────────────────────────

function CsvImportModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ imported: number; errors: string[] } | null>(null);

  async function handleImport() {
    if (!file) return;
    setImporting(true);
    try {
      const text = await file.text();
      const { parse } = await import("papaparse");
      const parsed = parse<CatalogueImportRow>(text, { header: true, skipEmptyLines: true });
      const res = await importCatalogueFromRows(parsed.data);
      setResult(res);
    } catch (e) {
      setResult({ imported: 0, errors: [(e as Error).message] });
    }
    setImporting(false);
  }

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.45)", padding: 16 }}>
      <div style={{ background: "var(--a-surface)", borderRadius: "var(--a-radius-lg)", border: "1px solid var(--a-border)", width: "100%", maxWidth: 480, maxHeight: "90vh", overflowY: "auto", padding: 24, boxSizing: "border-box" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 15 }}>Bulk Import from CSV</div>
          <button onClick={onClose} className="a-btn a-btn-ghost a-btn-icon a-btn-sm"><X style={{ width: 14, height: 14 }} /></button>
        </div>

        <div className="a-alert a-alert-info" style={{ marginBottom: 16 }}>
          <Info style={{ width: 13, height: 13, flexShrink: 0 }} />
          <span style={{ fontSize: 12 }}>CSV is only for initial and bulk import. The database is always the source of truth after import.</span>
        </div>

        {!result ? (
          <>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, fontWeight: 600, display: "block", marginBottom: 6 }}>Select CSV file</label>
              <input
                type="file"
                accept=".csv"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                style={{ fontSize: 13 }}
              />
              <div style={{ fontSize: 11, color: "var(--a-text-3)", marginTop: 6 }}>
                Expected columns: product_id, product_name, slug, brand, user_category, category, … (same as product_catalog.csv)
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button onClick={onClose} className="a-btn a-btn-secondary">Cancel</button>
              <button onClick={handleImport} disabled={!file || importing} className="a-btn a-btn-primary">
                {importing ? <><RefreshCw style={{ width: 13, height: 13 }} className="animate-spin" /> Importing…</> : <><Upload style={{ width: 13, height: 13 }} /> Import</>}
              </button>
            </div>
          </>
        ) : (
          <>
            <div className={`a-alert ${result.errors.length === 0 ? "a-alert-success" : "a-alert-warning"}`} style={{ marginBottom: 12 }}>
              {result.errors.length === 0 ? <Check style={{ width: 13, height: 13 }} /> : <AlertTriangle style={{ width: 13, height: 13 }} />}
              <span style={{ fontSize: 13 }}>{result.imported} products imported successfully.</span>
            </div>
            {result.errors.length > 0 && (
              <div style={{ maxHeight: 160, overflowY: "auto", fontSize: 11, color: "var(--a-danger)", background: "var(--a-danger-bg)", border: "1px solid var(--a-danger-border)", borderRadius: "var(--a-radius)", padding: 10, marginBottom: 12 }}>
                {result.errors.map((e, i) => <div key={i}>{e}</div>)}
              </div>
            )}
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button onClick={onClose} className="a-btn a-btn-secondary">Close</button>
              <button onClick={() => { onDone(); onClose(); }} className="a-btn a-btn-primary">View Catalogue</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────

export default function AdminCatalogPage() {
  const router = useRouter();
  const [products, setProducts] = useState<CatalogueProduct[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);

  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [groupFilter, setGroupFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");

  const [groups, setGroups] = useState<ProductGroup[]>([]);
  const [types, setTypes] = useState<ProductType[]>([]);

  const [selectedProduct, setSelectedProduct] = useState<CatalogueProduct | null>(null);
  const [viewedProduct, setViewedProduct] = useState<CatalogueProduct | null>(null);
  const [importedIds, setImportedIds] = useState<Set<string>>(new Set());
  const [showImport, setShowImport] = useState(false);

  const filteredTypes = types.filter((t) => !groupFilter || t.productGroupId === groupFilter);

  useEffect(() => {
    fetchAllProductGroups().then(setGroups);
    fetchAllProductTypes().then(setTypes);
    adminFetchImportedCatalogIds().then(setImportedIds);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const { products: p, total: t } = await fetchCatalogue({
      search: search || undefined,
      productGroupId: groupFilter || undefined,
      productTypeId: typeFilter || undefined,
      limit: PAGE_SIZE,
      offset: page * PAGE_SIZE,
    });
    setProducts(p);
    setTotal(t);
    setLoading(false);
  }, [search, groupFilter, typeFilter, page]);

  useEffect(() => { load(); }, [load]);

  async function refreshSelected(id: string) {
    const p = await fetchCatalogueProductById(id);
    if (p) setSelectedProduct(p);
    load();
  }

  function handleAddToStore(product: CatalogueProduct) {
    const v = product.variants.find((v) => v.isDefaultVariant) ?? product.variants[0];
    const params = new URLSearchParams({
      from_catalog:       "1",
      catalog_id:         product.productId,
      name:               product.productName,
      brand:              product.brand,
      user_category:      product.productGroupName,
      type:               product.productTypeName,
      slug:               product.slug,
      short_description:  product.shortDescription,
      full_description:   product.fullDescription,
      usage_info:         product.usageInformation,
      ingredients:        product.ingredients,
      warnings:           product.warningsAllergens,
      images:             JSON.stringify(product.imageUrls),
      goal_tags:          JSON.stringify(product.goalTags),
      search_tags:        JSON.stringify(product.searchTags),
      variants:           JSON.stringify(product.variants),
      selected_variant_id: v?.variantId ?? "",
    });
    router.push(`/admin/products/new?${params.toString()}`);
  }

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const hasFilters = !!(search || groupFilter || typeFilter);

  return (
    <div style={{ maxWidth: 1280 }}>
      {/* Header */}
      <div className="a-page-header">
        <div>
          <h2 className="a-page-title">Product Catalogue</h2>
          <p className="a-page-subtitle">
            The database is the source of truth. Edit product info inline. CSV is for bulk import only.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => setShowImport(true)} className="a-btn a-btn-secondary">
            <Upload style={{ width: 13, height: 13 }} /> Import CSV
          </button>
          <button onClick={load} className="a-btn a-btn-secondary a-btn-icon" title="Refresh">
            <RefreshCw style={{ width: 13, height: 13 }} className={loading ? "animate-spin" : ""} />
          </button>
          <span className="a-badge a-badge-neutral">
            <BookOpen style={{ width: 10, height: 10 }} />
            {loading ? "…" : `${total} products`}
          </span>
        </div>
      </div>

      {/* Info banner */}
      <div className="a-alert a-alert-info" style={{ marginBottom: 16 }}>
        <Info style={{ width: 13, height: 13, flexShrink: 0 }} />
        <span style={{ fontSize: 12 }}>
          <strong>Catalogue → Store Products flow:</strong> Edit product info here (it updates the DB) → click <strong>Add to Store</strong> to create an active store listing. Editing here does <em>not</em> auto-add to inventory.
        </span>
      </div>

      {/* Filter bar */}
      <div className="a-filter-bar">
        <form onSubmit={(e) => { e.preventDefault(); setPage(0); setSearch(searchInput); }} style={{ display: "flex", gap: 6, flex: 1, minWidth: 200 }}>
          <div className="a-search-wrap">
            <Search />
            <input
              type="text" value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search by name, brand…"
              className="a-search-input"
            />
          </div>
          <button type="submit" className="a-btn a-btn-secondary" style={{ height: 32 }}>Search</button>
        </form>

        <select value={groupFilter} onChange={(e) => { setGroupFilter(e.target.value); setTypeFilter(""); setPage(0); }} className="a-filter-select">
          <option value="">All Product Groups</option>
          {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>

        <select value={typeFilter} onChange={(e) => { setTypeFilter(e.target.value); setPage(0); }} className="a-filter-select">
          <option value="">All Product Types</option>
          {filteredTypes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>

        {hasFilters && (
          <button onClick={() => { setSearch(""); setSearchInput(""); setGroupFilter(""); setTypeFilter(""); setPage(0); }} className="a-btn a-btn-ghost" style={{ height: 32, fontSize: 12, color: "var(--a-danger)" }}>
            <X style={{ width: 12, height: 12 }} /> Clear
          </button>
        )}
      </div>

      {/* Table */}
      <div className="a-card" style={{ overflow: "hidden" }}>
        {loading ? (
          <div className="a-loading"><RefreshCw style={{ width: 16, height: 16 }} className="animate-spin" />Loading catalogue…</div>
        ) : total === 0 && !hasFilters ? (
          <div className="a-empty">
            <div className="a-empty-icon"><BookOpen style={{ width: 18, height: 18 }} /></div>
            <div className="a-empty-title">Catalogue is empty</div>
            <p className="a-empty-sub">Use the Import CSV button to populate the catalogue from your product_catalog.csv file.</p>
            <button onClick={() => setShowImport(true)} className="a-btn a-btn-primary"><Upload style={{ width: 13, height: 13 }} /> Import CSV</button>
          </div>
        ) : products.length === 0 ? (
          <div className="a-empty">
            <div className="a-empty-icon"><Package style={{ width: 18, height: 18 }} /></div>
            <div className="a-empty-title">No products match</div>
            <div className="a-empty-sub">Try adjusting your search or filters.</div>
            <button onClick={() => { setSearch(""); setSearchInput(""); setGroupFilter(""); setTypeFilter(""); }} className="a-btn a-btn-secondary">Clear filters</button>
          </div>
        ) : (
          <>
            <div className="a-table-wrap" style={{ overflowX: "auto" }}>
              <table className="a-table" style={{ minWidth: 900 }}>
                <thead>
                  <tr>
                    <th style={{ width: 36 }}>#</th>
                    <th>Product</th>
                    <th>Brand</th>
                    <th>Product Group</th>
                    <th>Product Type</th>
                    <th>Goals</th>
                    <th>Variants</th>
                    <th style={{ textAlign: "right" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((p, i) => {
                    const inStore = importedIds.has(p.productId);
                    return (
                      <tr key={p.id}>
                        <td style={{ color: "var(--a-text-3)", fontSize: 12 }}>{page * PAGE_SIZE + i + 1}</td>
                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <div className="a-product-thumb" style={{ flexShrink: 0 }}>
                              {p.imageUrls[0]
                                ? <img src={p.imageUrls[0]} alt={p.productName} />
                                : <Package style={{ width: 14, height: 14, color: "var(--a-text-3)" }} />}
                            </div>
                            <div>
                              <div style={{ fontWeight: 500, fontSize: 12, display: "flex", alignItems: "center", gap: 5 }}>
                                {p.productName}
                                {inStore && <span className="a-badge a-badge-green" style={{ fontSize: 9 }}>In Store</span>}
                              </div>
                              <div style={{ fontSize: 10, fontFamily: "monospace", color: "var(--a-text-3)" }}>{p.productId}</div>
                            </div>
                          </div>
                        </td>
                        <td>
                          <EditableCell value={p.brand} onSave={async (v) => { await updateCatalogueProduct(p.id, { brand: v }); load(); }} />
                        </td>
                        <td>
                          <SelectCell
                            value={p.productGroupName}
                            options={groups}
                            onSave={async (id) => { await updateCatalogueProduct(p.id, { product_group_id: id }); load(); }}
                          />
                        </td>
                        <td>
                          <SelectCell
                            value={p.productTypeName}
                            options={types.filter((t) => !p.productGroupId || t.productGroupId === p.productGroupId)}
                            onSave={async (id) => { await updateCatalogueProduct(p.id, { product_type_id: id }); load(); }}
                          />
                        </td>
                        <td>
                          {p.goalTags.length > 0 ? (
                            <div style={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
                              {p.goalTags.slice(0, 2).map((t) => <GoalBadge key={t} tag={t} />)}
                              {p.goalTags.length > 2 && <span className="a-badge a-badge-neutral" style={{ fontSize: 9 }}>+{p.goalTags.length - 2}</span>}
                            </div>
                          ) : <span style={{ color: "var(--a-text-4)", fontSize: 12 }}>—</span>}
                        </td>
                        <td style={{ fontSize: 12, color: "var(--a-text-2)" }}>
                          {p.variants.length > 0 ? `${p.variants.length} variant${p.variants.length !== 1 ? "s" : ""}` : <span style={{ color: "var(--a-text-4)" }}>—</span>}
                        </td>
                        <td>
                          <div className="a-table-actions">
                            <button onClick={() => setViewedProduct(p)} className="a-btn a-btn-ghost a-btn-sm" style={{ fontSize: 11 }}>
                              <Eye style={{ width: 11, height: 11 }} /> View
                            </button>
                            <button onClick={() => setSelectedProduct(p)} className="a-btn a-btn-ghost a-btn-sm" style={{ fontSize: 11 }}>
                              <Edit2 style={{ width: 11, height: 11 }} /> Edit
                            </button>
                            <button onClick={() => handleAddToStore(p)} className={`a-btn a-btn-sm ${inStore ? "a-btn-secondary" : "a-btn-primary"}`} style={{ fontSize: 11 }}>
                              <Plus style={{ width: 11, height: 11 }} /> {inStore ? "Re-add" : "Add"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="a-pagination">
                <span>{page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} of {total}</span>
                <div className="a-pagination-btns">
                  <button onClick={() => setPage((p) => p - 1)} disabled={page === 0} className="a-page-btn"><ChevronLeft style={{ width: 14, height: 14 }} /></button>
                  {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => (
                    <button key={i} onClick={() => setPage(i)} className={`a-page-btn ${i === page ? "active" : ""}`}>{i + 1}</button>
                  ))}
                  <button onClick={() => setPage((p) => p + 1)} disabled={page >= totalPages - 1} className="a-page-btn"><ChevronRight style={{ width: 14, height: 14 }} /></button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Read-only product-detail view (restored) */}
      {viewedProduct && !selectedProduct && (
        <ProductDetailView
          product={viewedProduct}
          onClose={() => setViewedProduct(null)}
          onEdit={() => { setSelectedProduct(viewedProduct); setViewedProduct(null); }}
        />
      )}

      {/* Detail side panel (existing Add/Edit Product functionality, unchanged) */}
      {selectedProduct && (
        <DetailPanel
          product={selectedProduct}
          groups={groups}
          types={types}
          onClose={() => setSelectedProduct(null)}
          onRefresh={() => refreshSelected(selectedProduct.id)}
          onAddToStore={(p) => { setSelectedProduct(null); handleAddToStore(p); }}
          isInStore={importedIds.has(selectedProduct.productId)}
        />
      )}

      {/* CSV import modal */}
      {showImport && (
        <CsvImportModal
          onClose={() => setShowImport(false)}
          onDone={() => { load(); fetchAllProductGroups().then(setGroups); fetchAllProductTypes().then(setTypes); }}
        />
      )}
    </div>
  );
}
