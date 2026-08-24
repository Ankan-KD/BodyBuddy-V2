"use client";

// ════════════════════════════════════════════════════════════════════════
// Admin — Product Catalog  (fixed: Goals always visible, Aim in detail
// only, real pagination, variant selector compact, no overflow on Actions)
// ════════════════════════════════════════════════════════════════════════

import { useState, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Search, BookOpen, Package, Plus, Info, X, Layers, RefreshCw,
  Dumbbell, Flame, Heart, Scale, ChevronRight, ChevronLeft, ChevronDown,
} from "lucide-react";
import type { CatalogProduct, CatalogVariant } from "@/lib/catalogTypes";

const PAGE_SIZE = 25;

// ── Goal badge helpers ────────────────────────────────────────────────────

const GOAL_META: Record<string, { label: string; Icon: React.ElementType; cls: string }> = {
  "weight-gain":     { label: "Weight Gain",     Icon: Scale,    cls: "a-badge-blue"   },
  "weight-loss":     { label: "Weight Loss",     Icon: Flame,    cls: "a-badge-orange" },
  "muscle-building": { label: "Muscle Building", Icon: Dumbbell, cls: "a-badge-yellow" },
  "general-fitness": { label: "General Fitness", Icon: Heart,    cls: "a-badge-green"  },
};

function GoalBadge({ tag }: { tag: string }) {
  const key = tag.toLowerCase().replace(/\s+/g, "-");
  const meta = GOAL_META[key];
  if (!meta) return <span className="a-badge a-badge-blue">{tag}</span>;
  const { label, Icon, cls } = meta;
  return (
    <span className={`a-badge ${cls}`}>
      <Icon style={{ width: 9, height: 9 }} />
      {label}
    </span>
  );
}

function AimBadge({ tag }: { tag: string }) {
  return <span className="a-badge a-badge-neutral" style={{ fontSize: 9 }}>{tag}</span>;
}

// ── Tooltip "+N more" ─────────────────────────────────────────────────────

function TagListWithOverflow({
  items,
  max = 2,
  renderItem,
  extraCls = "a-badge-neutral",
}: {
  items: string[];
  max?: number;
  renderItem: (item: string, idx: number) => React.ReactNode;
  extraCls?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const visible = items.slice(0, max);
  const hidden  = items.slice(max);

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 3, alignItems: "center", position: "relative" }}>
      {visible.map((item, i) => renderItem(item, i))}
      {hidden.length > 0 && (
        <div ref={ref} style={{ position: "relative" }}>
          <button
            className={`a-badge ${extraCls}`}
            style={{ cursor: "pointer", border: "1px dashed currentColor", background: "transparent", fontSize: 9, padding: "2px 5px" }}
            onClick={() => setOpen(v => !v)}
            onMouseEnter={() => setOpen(true)}
            onMouseLeave={() => setOpen(false)}
            title={hidden.join(", ")}
          >
            +{hidden.length}
          </button>
          {open && (
            <div
              style={{
                position: "absolute", bottom: "calc(100% + 6px)", left: 0, zIndex: 200,
                background: "var(--a-surface)", border: "1px solid var(--a-border)",
                borderRadius: "var(--a-radius)", boxShadow: "0 4px 16px rgba(0,0,0,0.22)",
                padding: "8px 10px", minWidth: 160, maxWidth: 260,
                display: "flex", flexWrap: "wrap", gap: 4,
              }}
              onMouseEnter={() => setOpen(true)}
              onMouseLeave={() => setOpen(false)}
            >
              {hidden.map((item, i) => (
                <span key={i} className={`a-badge ${extraCls}`} style={{ fontSize: 9 }}>{item}</span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Variant label ─────────────────────────────────────────────────────────

function buildVariantLabel(v: CatalogVariant): string {
  if (v.variantName) return v.variantName;
  const parts: string[] = [];
  if (v.sizeWeight) parts.push(v.sizeWeight);
  if (v.flavour)    parts.push(v.flavour);
  if (v.colour)     parts.push(v.colour);
  return parts.join(" — ") || v.sku || v.variantId;
}

// ── Compact variant selector (for table rows) ─────────────────────────────

function VariantSelector({
  product,
  value,
  onChange,
}: {
  product: CatalogProduct;
  value: CatalogVariant | null;
  onChange: (v: CatalogVariant) => void;
}) {
  if (product.variants.length === 0) return <span style={{ fontSize: 11, color: "var(--a-text-3)" }}>—</span>;
  if (product.variants.length === 1) {
    return (
      <span style={{ fontSize: 11, color: "var(--a-text-2)", whiteSpace: "nowrap" }}>
        {buildVariantLabel(product.variants[0])}
      </span>
    );
  }
  return (
    <select
      value={value?.variantId ?? ""}
      onChange={e => {
        const found = product.variants.find(v => v.variantId === e.target.value);
        if (found) onChange(found);
      }}
      className="a-filter-select"
      style={{ height: 26, fontSize: 11, padding: "0 20px 0 7px", width: "100%", maxWidth: 180 }}
      onClick={e => e.stopPropagation()}
      title={`${product.variants.length} variants`}
    >
      {product.variants.map(v => (
        <option key={v.variantId} value={v.variantId}>{buildVariantLabel(v)}</option>
      ))}
    </select>
  );
}

// ── Nutrition mini-grid ───────────────────────────────────────────────────

function NutritionGrid({ variant, product }: { variant: CatalogVariant | null; product: CatalogProduct }) {
  const cal  = variant?.calories       ?? product.calories;
  const prot = variant?.proteinG       ?? product.proteinG;
  const carb = variant?.carbohydratesG ?? product.carbohydratesG;
  const fat  = variant?.fatG           ?? product.fatG;
  const fib  = variant?.fibreG         ?? product.fibreG;
  const sug  = variant?.sugarG         ?? product.sugarG;
  const sod  = variant?.sodiumMg       ?? product.sodiumMg;
  const servLabel = variant?.servingSizeLabel || product.servingSizeLabel;

  if (cal === null && prot === null) return <span style={{ fontSize: 12, color: "var(--a-text-3)" }}>—</span>;

  return (
    <div>
      {servLabel && (
        <p style={{ fontSize: 10, color: "var(--a-text-3)", marginBottom: 6 }}>
          Per serving ({servLabel})
        </p>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6 }}>
        {[
          { label: "Calories", val: cal,  unit: "kcal" },
          { label: "Protein",  val: prot, unit: "g"    },
          { label: "Carbs",    val: carb, unit: "g"    },
          { label: "Fat",      val: fat,  unit: "g"    },
        ].map(({ label, val, unit }) => val !== null && (
          <div key={label} style={{
            background: "var(--a-surface-2)", border: "1px solid var(--a-border)",
            borderRadius: "var(--a-radius)", padding: "8px 6px", textAlign: "center",
          }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: "var(--a-text)" }}>{val}{unit}</p>
            <p style={{ fontSize: 10, color: "var(--a-text-3)" }}>{label}</p>
          </div>
        ))}
      </div>
      {(fib !== null || sug !== null || sod !== null) && (
        <div style={{ display: "flex", gap: 10, marginTop: 6, flexWrap: "wrap" }}>
          {fib !== null && <span style={{ fontSize: 11, color: "var(--a-text-3)" }}>Fibre: {fib}g</span>}
          {sug !== null && <span style={{ fontSize: 11, color: "var(--a-text-3)" }}>Sugar: {sug}g</span>}
          {sod !== null && <span style={{ fontSize: 11, color: "var(--a-text-3)" }}>Sodium: {sod}mg</span>}
        </div>
      )}
    </div>
  );
}

// ── Detail modal ──────────────────────────────────────────────────────────

function CatalogDetailModal({
  product,
  selectedVariant,
  onVariantChange,
  onClose,
  onAddToStore,
}: {
  product: CatalogProduct;
  selectedVariant: CatalogVariant | null;
  onVariantChange: (v: CatalogVariant) => void;
  onClose: () => void;
  onAddToStore: (p: CatalogProduct, v: CatalogVariant | null) => void;
}) {
  const v = selectedVariant;
  const price     = v?.suggestedPriceINR ?? null;
  const compareAt = v?.compareAtPriceINR ?? null;

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.45)" }} onClick={onClose} />
      <div style={{
        position: "relative", width: "100%", maxWidth: 560, maxHeight: "90vh",
        display: "flex", flexDirection: "column",
        background: "var(--a-surface)", border: "1px solid var(--a-border)",
        borderRadius: "var(--a-radius-lg)", boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
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

          {/* Catalog notice */}
          <div className="a-alert a-alert-info" style={{ padding: "8px 12px" }}>
            <BookOpen style={{ width: 13, height: 13, flexShrink: 0 }} />
            <span style={{ fontSize: 12 }}>This is a <strong>catalog template</strong> — not a live store product.</span>
          </div>

          {/* Goals */}
          {product.goalTags.length > 0 && (
            <div>
              <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--a-text-3)", marginBottom: 6 }}>Goals</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                {product.goalTags.map(t => <GoalBadge key={t} tag={t} />)}
              </div>
            </div>
          )}

          {/* Aim — shown in detail only */}
          {product.aimTags.length > 0 && (
            <div>
              <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--a-text-3)", marginBottom: 6 }}>Aim</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                {product.aimTags.map(t => <AimBadge key={t} tag={t} />)}
              </div>
            </div>
          )}

          {/* Description */}
          {product.shortDescription && (
            <p style={{ fontSize: 13, color: "var(--a-text-2)", lineHeight: 1.5 }}>{product.shortDescription}</p>
          )}

          {/* Variant selector */}
          {product.variants.length > 0 && (
            <div style={{ background: "var(--a-surface-2)", border: "1px solid var(--a-border)", borderRadius: "var(--a-radius)", padding: "10px 12px" }}>
              <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--a-text-3)", marginBottom: 8 }}>
                Select Variant ({product.variants.length})
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {product.variants.map(variant => {
                  const isSelected = selectedVariant?.variantId === variant.variantId;
                  return (
                    <label
                      key={variant.variantId}
                      style={{
                        display: "flex", alignItems: "center", justifyContent: "space-between",
                        background: isSelected ? "var(--a-primary-bg, rgba(37,99,235,0.08))" : "var(--a-surface)",
                        border: `1px solid ${isSelected ? "var(--a-primary)" : "var(--a-border)"}`,
                        borderRadius: "var(--a-radius)", padding: "8px 12px",
                        cursor: "pointer", transition: "all 0.12s",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <input
                          type="radio"
                          name={`variant-${product.productId}`}
                          checked={isSelected}
                          onChange={() => onVariantChange(variant)}
                          style={{ accentColor: "var(--a-primary)" }}
                        />
                        <div>
                          <p style={{ fontSize: 12, fontWeight: 500, color: "var(--a-text)" }}>{buildVariantLabel(variant)}</p>
                          <p style={{ fontSize: 10, color: "var(--a-text-3)", fontFamily: "monospace" }}>{variant.sku}</p>
                        </div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        {variant.suggestedPriceINR !== null && (
                          <p style={{ fontSize: 13, fontWeight: 700, color: "var(--a-primary)" }}>₹{variant.suggestedPriceINR.toLocaleString("en-IN")}</p>
                        )}
                        {variant.compareAtPriceINR !== null && variant.compareAtPriceINR > (variant.suggestedPriceINR ?? 0) && (
                          <p style={{ fontSize: 10, color: "var(--a-text-3)", textDecoration: "line-through" }}>₹{variant.compareAtPriceINR.toLocaleString("en-IN")}</p>
                        )}
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {/* Nutrition — updates with selected variant */}
          {(product.calories !== null || product.proteinG !== null ||
            v?.calories !== null || v?.proteinG !== null) && (
            <div>
              <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--a-text-3)", marginBottom: 8 }}>
                Nutrition — {v ? buildVariantLabel(v) : "product level"}
              </p>
              <NutritionGrid variant={v} product={product} />
            </div>
          )}

          {/* Selected variant SKU summary */}
          {v && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", fontSize: 11, color: "var(--a-text-2)" }}>
              <span>SKU: <strong style={{ fontFamily: "monospace" }}>{v.sku}</strong></span>
              {v.sizeWeight && <span>· Size: <strong>{v.sizeWeight}</strong></span>}
              {v.flavour    && <span>· Flavour: <strong>{v.flavour}</strong></span>}
              {v.colour     && <span>· Colour: <strong>{v.colour}</strong></span>}
            </div>
          )}

          {/* Price summary */}
          {price !== null && (
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 18, fontWeight: 700, color: "var(--a-primary)" }}>
                ₹{price.toLocaleString("en-IN")}
              </span>
              {compareAt !== null && compareAt > price && (
                <>
                  <span style={{ fontSize: 13, color: "var(--a-text-3)", textDecoration: "line-through" }}>
                    ₹{compareAt.toLocaleString("en-IN")}
                  </span>
                  <span className="a-badge a-badge-green" style={{ fontSize: 10 }}>
                    {Math.round((1 - price / compareAt) * 100)}% off
                  </span>
                </>
              )}
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

          {/* Search tags */}
          {product.searchTags.length > 0 && (
            <div>
              <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--a-text-3)", marginBottom: 6 }}>Search Tags</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                {product.searchTags.map(t => (
                  <span key={t} className="a-badge a-badge-neutral" style={{ fontSize: 9 }}>{t}</span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: "12px 16px", borderTop: "1px solid var(--a-border)", flexShrink: 0 }}>
          {product.variants.length > 1 && !selectedVariant && (
            <p style={{ fontSize: 11, color: "var(--a-danger, #dc2626)", marginBottom: 8, textAlign: "center" }}>
              ← Select a variant above before adding to store
            </p>
          )}
          <button
            onClick={() => onAddToStore(product, selectedVariant)}
            className="a-btn a-btn-primary a-btn-lg"
            style={{ width: "100%" }}
            disabled={product.variants.length > 1 && !selectedVariant}
          >
            <Plus style={{ width: 14, height: 14 }} />
            {selectedVariant
              ? `Add "${buildVariantLabel(selectedVariant)}" to Store`
              : product.variants.length === 1
                ? `Add "${buildVariantLabel(product.variants[0])}" to Store`
                : "Select a variant first"
            }
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Catalog table row ─────────────────────────────────────────────────────

function CatalogTableRow({
  product,
  onSelect,
  onAddToStore,
}: {
  product: CatalogProduct;
  onSelect: (p: CatalogProduct) => void;
  onAddToStore: (p: CatalogProduct, v: CatalogVariant | null) => void;
}) {
  const defaultVariant = product.variants.find(v => v.isDefaultVariant) ?? product.variants[0] ?? null;
  const [selectedVariant, setSelectedVariant] = useState<CatalogVariant | null>(defaultVariant);

  const price     = selectedVariant?.suggestedPriceINR ?? null;
  const compareAt = selectedVariant?.compareAtPriceINR ?? null;
  const prot      = selectedVariant?.proteinG ?? product.proteinG;

  return (
    <tr>
      {/* Product */}
      <td style={{ minWidth: 180, maxWidth: 240 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div className="a-product-thumb" style={{ flexShrink: 0 }}>
            {product.primaryImageUrl
              ? <img src={product.primaryImageUrl} alt={product.productName} />
              : <Package style={{ width: 14, height: 14, color: "var(--a-text-3)" }} />
            }
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 500, fontSize: 12, color: "var(--a-text)", lineHeight: 1.3, wordBreak: "break-word" }}>{product.productName}</div>
            <div style={{ fontSize: 10, fontFamily: "monospace", color: "var(--a-text-3)", marginTop: 1 }}>{product.productId}</div>
          </div>
        </div>
      </td>

      {/* Brand */}
      <td style={{ fontSize: 12, color: "var(--a-text-2)", whiteSpace: "nowrap" }}>{product.brand}</td>

      {/* Category */}
      <td style={{ fontSize: 12, color: "var(--a-text-2)", whiteSpace: "nowrap" }}>{product.category}</td>

      {/* Goals ONLY — Aim is in detail modal */}
      <td style={{ minWidth: 140 }}>
        {product.goalTags.length > 0 ? (
          <TagListWithOverflow
            items={product.goalTags}
            max={2}
            extraCls="a-badge-blue"
            renderItem={(tag, i) => <GoalBadge key={i} tag={tag} />}
          />
        ) : (
          <span style={{ fontSize: 11, color: "var(--a-text-3)" }}>—</span>
        )}
      </td>

      {/* Variant selector */}
      <td style={{ minWidth: 140, maxWidth: 190 }}>
        <VariantSelector
          product={product}
          value={selectedVariant}
          onChange={setSelectedVariant}
        />
        {product.variants.length > 1 && (
          <div style={{ fontSize: 9, color: "var(--a-text-3)", marginTop: 2 }}>
            {product.variants.length} variants
          </div>
        )}
      </td>

      {/* Price */}
      <td style={{ fontSize: 12, whiteSpace: "nowrap" }}>
        {price !== null ? (
          <div>
            <span style={{ color: "var(--a-primary)", fontWeight: 600 }}>
              ₹{price.toLocaleString("en-IN")}
            </span>
            {compareAt !== null && compareAt > price && (
              <div style={{ fontSize: 10, color: "var(--a-text-3)", textDecoration: "line-through" }}>
                ₹{compareAt.toLocaleString("en-IN")}
              </div>
            )}
          </div>
        ) : "—"}
      </td>

      {/* Protein */}
      <td style={{ fontSize: 12, color: "var(--a-text-2)", whiteSpace: "nowrap" }}>
        {prot !== null ? `${prot}g` : "—"}
      </td>

      {/* Actions — fixed width so they never go offscreen */}
      <td style={{ whiteSpace: "nowrap", width: 140 }}>
        <div style={{ display: "flex", gap: 4, justifyContent: "flex-end" }}>
          <button
            onClick={() => onSelect(product)}
            className="a-btn a-btn-ghost a-btn-sm"
            style={{ fontSize: 11, padding: "0 8px" }}
            title="View details"
          >
            <ChevronRight style={{ width: 12, height: 12 }} />
            Details
          </button>
          <button
            onClick={() => onAddToStore(product, selectedVariant)}
            className="a-btn a-btn-primary a-btn-sm"
            style={{ fontSize: 11, padding: "0 8px" }}
            title="Add to store"
          >
            <Plus style={{ width: 12, height: 12 }} />
            Add
          </button>
        </div>
      </td>
    </tr>
  );
}

// ── Pagination controls ───────────────────────────────────────────────────

function Pagination({
  page,
  totalPages,
  total,
  showing,
  onPage,
}: {
  page: number;
  totalPages: number;
  total: number;
  showing: number;
  onPage: (p: number) => void;
}) {
  if (totalPages <= 1) {
    return (
      <div className="a-pagination">
        <span>Showing {showing} of {total} product{total !== 1 ? "s" : ""}</span>
      </div>
    );
  }

  // Build page numbers: always show first, last, current ±1
  const pages: (number | "…")[] = [];
  const add = (n: number) => { if (!pages.includes(n)) pages.push(n); };
  add(1);
  if (page > 3) pages.push("…");
  if (page > 2) add(page - 1);
  add(page);
  if (page < totalPages - 1) add(page + 1);
  if (page < totalPages - 2) pages.push("…");
  add(totalPages);

  return (
    <div className="a-pagination">
      <span>Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total} product{total !== 1 ? "s" : ""}</span>
      <div className="a-pagination-btns">
        <button
          className="a-page-btn"
          disabled={page === 1}
          onClick={() => onPage(page - 1)}
          title="Previous page"
        >
          <ChevronLeft style={{ width: 12, height: 12 }} />
        </button>
        {pages.map((p, i) =>
          p === "…"
            ? <span key={`ellipsis-${i}`} style={{ padding: "0 4px", fontSize: 12, color: "var(--a-text-3)" }}>…</span>
            : (
              <button
                key={p}
                className={`a-page-btn${page === p ? " active" : ""}`}
                onClick={() => onPage(p as number)}
              >
                {p}
              </button>
            )
        )}
        <button
          className="a-page-btn"
          disabled={page === totalPages}
          onClick={() => onPage(page + 1)}
          title="Next page"
        >
          <ChevronRight style={{ width: 12, height: 12 }} />
        </button>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────

export default function AdminCatalogPage() {
  const router = useRouter();

  const [catalog, setCatalog]               = useState<CatalogProduct[]>([]);
  const [loading, setLoading]               = useState(true);
  const [search, setSearch]                 = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [goalFilter, setGoalFilter]         = useState("");
  const [page, setPage]                     = useState(1);

  // Detail modal
  const [selected, setSelected]             = useState<CatalogProduct | null>(null);
  const [modalVariant, setModalVariant]     = useState<CatalogVariant | null>(null);

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

  // Reset to page 1 when filters change
  useEffect(() => { setPage(1); }, [search, categoryFilter, goalFilter]);

  function openModal(product: CatalogProduct) {
    setSelected(product);
    const def = product.variants.find(v => v.isDefaultVariant) ?? product.variants[0] ?? null;
    setModalVariant(def);
  }

  const categories = useMemo(() => {
    const s = new Set(catalog.map(p => p.category).filter(Boolean));
    return Array.from(s).sort();
  }, [catalog]);

  const filtered = useMemo(() => catalog.filter(p => {
    if (search.trim() &&
      !p.productName.toLowerCase().includes(search.toLowerCase()) &&
      !p.brand.toLowerCase().includes(search.toLowerCase()) &&
      !p.category.toLowerCase().includes(search.toLowerCase()) &&
      !p.searchTags.some(t => t.toLowerCase().includes(search.toLowerCase())) &&
      !p.aimTags.some(t => t.toLowerCase().includes(search.toLowerCase()))
    ) return false;
    if (categoryFilter && p.category !== categoryFilter) return false;
    if (goalFilter && !p.goalTags.includes(goalFilter)) return false;
    return true;
  }), [catalog, search, categoryFilter, goalFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage   = Math.min(page, totalPages);
  const pageItems  = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  function handleAddToStore(product: CatalogProduct, variant: CatalogVariant | null) {
    const v = variant ?? (product.variants.length === 1 ? product.variants[0] : null);
    const params = new URLSearchParams({
      from_catalog:        "1",
      catalog_id:          product.productId,
      name:                product.productName,
      brand:               product.brand,
      category:            product.category,
      slug:                product.slug,
      short_description:   product.shortDescription,
      full_description:    product.fullDescription,
      usage_info:          product.usageInformation,
      ingredients:         product.ingredients,
      warnings:            product.warningsAllergens,
      images:              JSON.stringify(product.imageUrls),
      goal_tags:           JSON.stringify(product.goalTags),
      search_tags:         JSON.stringify(product.searchTags),
      serving_size_label:  (v?.servingSizeLabel || product.servingSizeLabel),
      serving_size_g:      (v?.servingSizeG     ?? product.servingSizeG)?.toString()  ?? "",
      calories:            (v?.calories         ?? product.calories)?.toString()       ?? "",
      protein_g:           (v?.proteinG         ?? product.proteinG)?.toString()       ?? "",
      carbohydrates_g:     (v?.carbohydratesG   ?? product.carbohydratesG)?.toString() ?? "",
      fat_g:               (v?.fatG             ?? product.fatG)?.toString()           ?? "",
      fibre_g:             (v?.fibreG           ?? product.fibreG)?.toString()         ?? "",
      sugar_g:             (v?.sugarG           ?? product.sugarG)?.toString()         ?? "",
      sodium_mg:           (v?.sodiumMg         ?? product.sodiumMg)?.toString()       ?? "",
      variants:            JSON.stringify(product.variants),
      selected_variant_id: v?.variantId ?? "",
    });
    router.push(`/admin/products/new?${params.toString()}`);
  }

  const hasFilters = !!(search || categoryFilter || goalFilter);

  return (
    <div style={{ maxWidth: 1280 }}>
      {/* Page header */}
      <div className="a-page-header">
        <div>
          <h2 className="a-page-title">Product Catalog</h2>
          <p className="a-page-subtitle">
            Read-only template library — select a variant, then click <strong>Add</strong> to prefill the product form.
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
          Browse catalog → select a <strong>variant</strong> → click <strong>Add</strong> → edit price/stock/publishing → save to your store.
          Click <strong>Details</strong> to see full product info including Aim, ingredients, and nutrition.
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
            placeholder="Search by name, brand, category, tag…"
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

      {/* Table card */}
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
            <div className="a-table-wrap" style={{ overflowX: "auto" }}>
              <table className="a-table" style={{ tableLayout: "fixed", width: "100%", minWidth: 860 }}>
                <colgroup>
                  <col style={{ width: "22%" }}/>
                  <col style={{ width: "10%" }}/>
                  <col style={{ width: "11%" }}/>
                  <col style={{ width: "16%" }}/>
                  <col style={{ width: "17%" }}/>
                  <col style={{ width: "9%"  }}/>
                  <col style={{ width: "7%"  }}/>
                  <col style={{ width: "8%"  }}/>
                </colgroup>
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Brand</th>
                    <th>Category</th>
                    <th>Goals</th>
                    <th>Variant</th>
                    <th>Price</th>
                    <th>Protein</th>
                    <th style={{ textAlign: "right" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pageItems.map(product => (
                    <CatalogTableRow
                      key={product.productId}
                      product={product}
                      onSelect={openModal}
                      onAddToStore={(p, v) => handleAddToStore(p, v)}
                    />
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <Pagination
              page={safePage}
              totalPages={totalPages}
              total={filtered.length}
              showing={pageItems.length}
              onPage={p => { setPage(p); window.scrollTo({ top: 0, behavior: "smooth" }); }}
            />
          </>
        )}
      </div>

      {/* Detail modal */}
      {selected && (
        <CatalogDetailModal
          product={selected}
          selectedVariant={modalVariant}
          onVariantChange={setModalVariant}
          onClose={() => { setSelected(null); setModalVariant(null); }}
          onAddToStore={(p, v) => { setSelected(null); setModalVariant(null); handleAddToStore(p, v); }}
        />
      )}
    </div>
  );
}
