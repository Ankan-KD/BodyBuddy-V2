"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Save, ArrowLeft, Loader2, AlertTriangle, Info, Tag, Dumbbell, Flame,
  Heart, Scale, Eye, EyeOff, Plus, X, Star, ChevronDown, ChevronUp,
  GripVertical, Trash2, Upload, Link2, ImageIcon, Package, FileText,
  BarChart2, Layers, Sparkles, CheckCircle2, AlertCircle,
} from "lucide-react";
import {
  adminCreateProduct, adminUpdateProduct, adminCreateVariant,
  adminUpdateVariant, adminDeleteVariant,
  adminFetchAllBrands, adminCreateBrand, generateSlug,
} from "@/lib/storeAdminApi";
import type { StoreProduct, StoreBrand } from "@/lib/storeTypes";
import type { CatalogPrefill } from "@/lib/catalogTypes";
import { fetchAllProductTypes, fetchAllProductGroups } from "@/lib/catalogueAdminApi";
import type { ProductGroup } from "@/lib/catalogueAdminApi";
import { adminUploadProductImage } from "@/lib/storeAdminApi";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface VariantDraft {
  id?: string;
  tempId: string;
  sku: string;
  name: string;
  sizeLabel: string;
  flavour: string;
  color: string;
  pricePaise: number;
  comparePricePaise: number | null;
  stockQuantity: number;
  lowStockThreshold: number;
  availability: string;
  isDefault: boolean;
  sortOrder: number;
}

function emptyVariant(sortOrder: number): VariantDraft {
  return {
    tempId: `new-${Date.now()}-${Math.random()}`,
    sku: "", name: "", sizeLabel: "", flavour: "", color: "",
    pricePaise: 0, comparePricePaise: null, stockQuantity: 0,
    lowStockThreshold: 5, availability: "active",
    isDefault: sortOrder === 0, sortOrder,
  };
}

// ─── Design tokens (scoped, no globals polluted) ──────────────────────────────

const T = {
  bg: "#F0F4F9",
  surface: "#FFFFFF",
  surface2: "#F5F7FB",
  surface3: "#E8EDF5",
  border: "#E2E8F0",
  borderStrong: "#B8C4D8",
  text: "#0F172A",
  text2: "#374151",
  text3: "#6B7280",
  text4: "#9CA3AF",
  primary: "#1D4ED8",
  primaryHover: "#1E40AF",
  primaryLight: "#EFF6FF",
  primaryMid: "#DBEAFE",
  primaryMuted: "rgba(29,78,216,0.08)",
  primaryText: "#1E40AF",
  success: "#15803D",
  successBg: "#DCFCE7",
  successBorder: "#86EFAC",
  warning: "#B45309",
  warningBg: "#FEF3C7",
  warningBorder: "#FCD34D",
  danger: "#B91C1C",
  dangerBg: "#FEE2E2",
  dangerBorder: "#FCA5A5",
  dangerText: "#991B1B",
  radius: "7px",
  radiusMd: "10px",
  radiusLg: "14px",
  radiusSm: "5px",
  shadow: "0 1px 3px rgba(15,23,42,0.08),0 1px 2px rgba(15,23,42,0.04)",
  shadowXs: "0 1px 2px rgba(15,23,42,0.05)",
};

// Section definitions for the nav
const SECTIONS = [
  { id: "basics",     label: "Basics",      Icon: Package,   color: "#1D4ED8", bg: "#EFF6FF" },
  { id: "media",      label: "Media",       Icon: ImageIcon, color: "#7C3AED", bg: "#F3E8FF" },
  { id: "goals",      label: "Goals",       Icon: Sparkles,  color: "#0891B2", bg: "#E0F2FE" },
  { id: "nutrition",  label: "Nutrition",   Icon: BarChart2, color: "#15803D", bg: "#DCFCE7" },
  { id: "content",    label: "Content",     Icon: FileText,  color: "#B45309", bg: "#FEF3C7" },
  { id: "variants",   label: "Variants",    Icon: Layers,    color: "#BE185D", bg: "#FCE7F3" },
];

const HEALTH_GOAL_TAGS = [
  { key: "weight-gain",     label: "Weight Gain",     Icon: Scale,    color: "#15803D", bg: "#DCFCE7" },
  { key: "weight-loss",     label: "Weight Loss",     Icon: Flame,    color: "#B45309", bg: "#FEF3C7" },
  { key: "muscle-building", label: "Muscle Building", Icon: Dumbbell, color: "#1D4ED8", bg: "#EFF6FF" },
  { key: "general-fitness", label: "General Fitness", Icon: Heart,    color: "#BE185D", bg: "#FCE7F3" },
];

// ─── Micro helpers ────────────────────────────────────────────────────────────

function friendlyDbError(raw: string | null): string | null {
  if (!raw) return raw;
  if (/duplicate key.*slug/i.test(raw) || /store_products_slug/i.test(raw))
    return "That URL slug is already used. Choose a different slug.";
  if (/duplicate key.*sku/i.test(raw) || /store_product_variants_sku/i.test(raw))
    return "A SKU is already in use elsewhere. SKUs must be unique store-wide.";
  if (/duplicate key/i.test(raw))
    return "That value is already in use — please choose something unique.";
  return raw;
}

// ─── Shared Field ─────────────────────────────────────────────────────────────

function Field({ label, children, hint, required }: {
  label: string; children: React.ReactNode; hint?: string; required?: boolean;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <label style={{ fontSize: 12, fontWeight: 600, color: T.text2, letterSpacing: "0.01em" }}>
        {label}
        {required && <span style={{ color: T.danger, marginLeft: 2 }}>*</span>}
      </label>
      {children}
      {hint && <p style={{ fontSize: 11, color: T.text3, lineHeight: 1.5, marginTop: 1 }}>{hint}</p>}
    </div>
  );
}

// ─── Section card wrapper ─────────────────────────────────────────────────────

function Section({ id, title, icon: Icon, iconColor, iconBg, children, action }: {
  id: string; title: string; icon: React.ElementType; iconColor: string; iconBg: string;
  children: React.ReactNode; action?: React.ReactNode;
}) {
  return (
    <div id={id} style={{
      background: T.surface, border: `1px solid ${T.border}`, borderRadius: T.radiusMd,
      boxShadow: T.shadowXs, overflow: "hidden", marginBottom: 12,
    }}>
      {/* Section header */}
      <div style={{
        background: T.surface2, borderBottom: `1px solid ${T.border}`,
        padding: "11px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 28, height: 28, borderRadius: T.radiusSm, background: iconBg,
            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
          }}>
            <Icon style={{ width: 14, height: 14, color: iconColor }} />
          </div>
          <span style={{ fontSize: 13, fontWeight: 700, color: T.text, letterSpacing: "-0.01em" }}>{title}</span>
        </div>
        {action && <div>{action}</div>}
      </div>
      <div style={{ padding: "16px 18px" }}>{children}</div>
    </div>
  );
}

// ─── Inline image uploader ────────────────────────────────────────────────────

function ImageUploader({ images, onChange, productSlug }: {
  images: string[]; onChange: (imgs: string[]) => void; productSlug: string;
}) {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [urlInput, setUrlInput] = useState("");
  const [showUrl, setShowUrl] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    setUploading(true); setUploadError(null);
    const slug = productSlug || `product-${Date.now()}`;
    const results = await Promise.all(files.map(f => adminUploadProductImage(f, slug)));
    const urls = results.filter(r => r.url).map(r => r.url as string);
    const errors = results.filter(r => r.error).map(r => r.error as string);
    if (errors.length) {
      const objectUrls = files.map(f => URL.createObjectURL(f));
      onChange([...images, ...objectUrls]);
      setUploadError("Local preview only — set up Supabase Storage to make permanent.");
    } else {
      onChange([...images, ...urls]);
    }
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
  }

  function addUrl() {
    const url = urlInput.trim();
    if (!url) return;
    try { new URL(url); } catch { setUploadError("Invalid URL"); return; }
    onChange([...images, url]);
    setUrlInput(""); setShowUrl(false); setUploadError(null);
  }

  function remove(i: number) { onChange(images.filter((_, idx) => idx !== i)); }
  function move(from: number, to: number) {
    if (to < 0 || to >= images.length) return;
    const n = [...images]; [n[from], n[to]] = [n[to], n[from]]; onChange(n);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {/* Grid */}
      {images.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(90px, 1fr))", gap: 8 }}>
          {images.map((url, i) => (
            <div key={i} className="img-thumb-wrap" style={{
              position: "relative", aspectRatio: "1", borderRadius: T.radius, overflow: "hidden",
              background: T.surface2, border: `1px solid ${T.border}`,
            }}>
              <img src={url} alt={`Image ${i + 1}`} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              {i === 0 && (
                <div style={{
                  position: "absolute", top: 5, left: 5, background: T.primary, color: "white",
                  fontSize: 9, fontWeight: 700, padding: "2px 5px", borderRadius: 3,
                }}>Primary</div>
              )}
              <div className="img-thumb-overlay" style={{
                position: "absolute", inset: 0, background: "rgba(0,0,0,0.5)",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 4,
                opacity: 0, transition: "opacity 0.15s",
              }}>
                {i > 0 && (
                  <button type="button" onClick={() => move(i, i - 1)} style={imgBtn}>←</button>
                )}
                <button type="button" onClick={() => remove(i)} style={{ ...imgBtn, background: "rgba(220,38,38,0.85)" }}>
                  <X style={{ width: 11, height: 11 }} />
                </button>
                {i < images.length - 1 && (
                  <button type="button" onClick={() => move(i, i + 1)} style={imgBtn}>→</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Upload zone */}
      <div
        onClick={() => !uploading && fileRef.current?.click()}
        style={{
          border: `1.5px dashed ${T.border}`, borderRadius: T.radius, padding: "18px 16px",
          textAlign: "center", cursor: uploading ? "default" : "pointer",
          transition: "border-color 0.1s, background 0.1s",
          background: "transparent",
        }}
        onMouseEnter={e => { if (!uploading) (e.currentTarget as HTMLDivElement).style.borderColor = T.primary; (e.currentTarget as HTMLDivElement).style.background = T.primaryLight; }}
        onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = T.border; (e.currentTarget as HTMLDivElement).style.background = "transparent"; }}
      >
        {uploading ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, color: T.text3 }}>
            <Loader2 style={{ width: 16, height: 16 }} className="animate-spin" />
            <span style={{ fontSize: 13 }}>Uploading…</span>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
            <div style={{
              width: 36, height: 36, borderRadius: T.radius, background: T.surface3,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <Upload style={{ width: 16, height: 16, color: T.text3 }} />
            </div>
            <p style={{ fontSize: 13, color: T.text2, fontWeight: 500, margin: 0 }}>
              {images.length > 0 ? "Add more images" : "Upload product images"}
            </p>
            <p style={{ fontSize: 11, color: T.text4, margin: 0 }}>PNG, JPG, WebP · drag or click</p>
          </div>
        )}
        <input ref={fileRef} type="file" accept="image/*" multiple onChange={handleFiles} style={{ display: "none" }} />
      </div>

      {/* URL input */}
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        {showUrl ? (
          <>
            <input
              autoFocus type="text" value={urlInput} onChange={e => setUrlInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addUrl(); } }}
              placeholder="https://example.com/image.jpg"
              className="a-form-input" style={{ flex: 1, fontSize: 12 }}
            />
            <button type="button" onClick={addUrl} className="a-btn a-btn-primary a-btn-sm">Add</button>
            <button type="button" onClick={() => setShowUrl(false)} className="a-btn a-btn-ghost a-btn-sm">Cancel</button>
          </>
        ) : (
          <button type="button" onClick={() => setShowUrl(true)} style={{
            display: "flex", alignItems: "center", gap: 5, background: "none", border: "none",
            cursor: "pointer", fontSize: 12, color: T.text3, padding: 0,
          }}>
            <Link2 style={{ width: 12, height: 12 }} />
            Add by URL
          </button>
        )}
      </div>

      {uploadError && (
        <p style={{ fontSize: 11, color: T.warning, background: T.warningBg, padding: "6px 10px", borderRadius: T.radiusSm, margin: 0 }}>
          {uploadError}
        </p>
      )}

      <style>{`.img-thumb-wrap:hover .img-thumb-overlay { opacity: 1 !important; }`}</style>
    </div>
  );
}

const imgBtn: React.CSSProperties = {
  width: 26, height: 26, borderRadius: 4, background: "rgba(255,255,255,0.2)",
  border: "none", color: "white", cursor: "pointer", fontSize: 13, fontWeight: 700,
  display: "flex", alignItems: "center", justifyContent: "center",
};

// ─── Variant Row ──────────────────────────────────────────────────────────────

function VariantRow({ variant, index, onChange, onDelete, onSetDefault, canDelete }: {
  variant: VariantDraft; index: number; onChange: (v: VariantDraft) => void;
  onDelete: () => void; onSetDefault: () => void; canDelete: boolean;
}) {
  const [expanded, setExpanded] = useState(index === 0);
  const up = (patch: Partial<VariantDraft>) => onChange({ ...variant, ...patch });

  const hasPrice = variant.pricePaise > 0;
  const hasStock = variant.stockQuantity > 0;

  return (
    <div style={{
      border: `1px solid ${variant.isDefault ? T.primaryMid : T.border}`,
      borderRadius: T.radiusMd, overflow: "hidden",
      background: T.surface,
      transition: "border-color 0.15s",
    }}>
      {/* Header row — always visible */}
      <div style={{
        display: "flex", alignItems: "center", gap: 8, padding: "8px 12px",
        background: variant.isDefault ? T.primaryLight : T.surface2,
        cursor: "pointer",
      }} onClick={() => setExpanded(e => !e)}>
        <GripVertical style={{ width: 13, height: 13, color: T.text4, flexShrink: 0 }} />

        {/* Identity */}
        <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: T.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {variant.name || `Variant ${index + 1}`}
          </span>
          {variant.sizeLabel && (
            <span style={{ fontSize: 11, color: T.text3, background: T.surface3, padding: "1px 6px", borderRadius: 4, flexShrink: 0 }}>
              {variant.sizeLabel}
            </span>
          )}
          {variant.flavour && (
            <span style={{ fontSize: 11, color: T.text3, background: T.surface3, padding: "1px 6px", borderRadius: 4, flexShrink: 0 }}>
              {variant.flavour}
            </span>
          )}
        </div>

        {/* Key stats — always visible */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
          {hasPrice && (
            <span style={{ fontSize: 13, fontWeight: 700, color: T.text2 }}>
              ₹{(variant.pricePaise / 100).toLocaleString("en-IN")}
            </span>
          )}
          {variant.sku && (
            <span style={{ fontSize: 11, color: T.text3, fontFamily: "monospace" }}>{variant.sku}</span>
          )}
          {hasStock && (
            <span style={{ fontSize: 11, color: variant.stockQuantity <= variant.lowStockThreshold ? T.warning : T.success }}>
              {variant.stockQuantity} in stock
            </span>
          )}
          {variant.isDefault && (
            <span style={{
              fontSize: 10, fontWeight: 700, background: T.primaryMid, color: T.primaryText,
              padding: "2px 6px", borderRadius: 4, letterSpacing: "0.03em",
            }}>DEFAULT</span>
          )}
        </div>

        {/* Actions */}
        <div style={{ display: "flex", alignItems: "center", gap: 2, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
          <button
            type="button" onClick={onSetDefault} disabled={variant.isDefault}
            title={variant.isDefault ? "Default variant" : "Set as default"}
            className="a-btn a-btn-ghost a-btn-icon a-btn-sm"
            style={variant.isDefault ? { color: "#D97706" } : {}}
          >
            <Star style={{ width: 13, height: 13, fill: variant.isDefault ? "#D97706" : "none" }} />
          </button>
          {canDelete && (
            <button type="button" onClick={onDelete} className="a-btn a-btn-ghost a-btn-icon a-btn-sm" style={{ color: T.danger }}>
              <Trash2 style={{ width: 12, height: 12 }} />
            </button>
          )}
          <button type="button" onClick={() => setExpanded(e => !e)} className="a-btn a-btn-ghost a-btn-icon a-btn-sm">
            {expanded ? <ChevronUp style={{ width: 13, height: 13 }} /> : <ChevronDown style={{ width: 13, height: 13 }} />}
          </button>
        </div>
      </div>

      {/* Expanded fields */}
      {expanded && (
        <div style={{ padding: "14px 14px 16px", borderTop: `1px solid ${T.border}` }}>
          {/* Identity group */}
          <div style={{ marginBottom: 14 }}>
            <p style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: T.text4, marginBottom: 8 }}>Identity</p>
            <div className="a-grid-2" style={{ gap: 10 }}>
              <Field label="SKU" required>
                <input required type="text" value={variant.sku} onChange={e => up({ sku: e.target.value })}
                  placeholder="WP-1KG-CHOC" className="a-form-input" style={{ fontFamily: "monospace", fontSize: 12 }} />
              </Field>
              <Field label="Variant name">
                <input type="text" value={variant.name} onChange={e => up({ name: e.target.value })}
                  placeholder="1kg – Chocolate" className="a-form-input" />
              </Field>
              <Field label="Size / weight">
                <input type="text" value={variant.sizeLabel} onChange={e => up({ sizeLabel: e.target.value })}
                  placeholder="1kg, 500g, 60 caps" className="a-form-input" />
              </Field>
              <Field label="Flavour">
                <input type="text" value={variant.flavour} onChange={e => up({ flavour: e.target.value })}
                  placeholder="Chocolate Fudge" className="a-form-input" />
              </Field>
              <Field label="Colour (non-food)">
                <input type="text" value={variant.color} onChange={e => up({ color: e.target.value })}
                  placeholder="Black, Blue" className="a-form-input" />
              </Field>
              <Field label="Status">
                <select value={variant.availability} onChange={e => up({ availability: e.target.value })} className="a-form-input">
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="out_of_stock">Out of Stock</option>
                  <option value="discontinued">Discontinued</option>
                </select>
              </Field>
            </div>
          </div>

          {/* Pricing group */}
          <div style={{ marginBottom: 14, paddingTop: 12, borderTop: `1px solid ${T.border}` }}>
            <p style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: T.text4, marginBottom: 8 }}>Pricing</p>
            <div className="a-grid-2" style={{ gap: 10 }}>
              <Field label="Price (₹)" required>
                <div style={{ position: "relative" }}>
                  <span style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)", color: T.text3, fontSize: 13, pointerEvents: "none" }}>₹</span>
                  <input required type="number" min="0" step="0.01"
                    value={variant.pricePaise > 0 ? (variant.pricePaise / 100).toFixed(2) : ""}
                    onChange={e => up({ pricePaise: Math.round(parseFloat(e.target.value || "0") * 100) })}
                    placeholder="0.00" className="a-form-input" style={{ paddingLeft: 22 }} />
                </div>
              </Field>
              <Field label="Compare-at price (₹)" hint="Leave blank if not on sale">
                <div style={{ position: "relative" }}>
                  <span style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)", color: T.text3, fontSize: 13, pointerEvents: "none" }}>₹</span>
                  <input type="number" min="0" step="0.01"
                    value={variant.comparePricePaise != null ? (variant.comparePricePaise / 100).toFixed(2) : ""}
                    onChange={e => { const v = e.target.value; up({ comparePricePaise: v ? Math.round(parseFloat(v) * 100) : null }); }}
                    placeholder="0.00" className="a-form-input" style={{ paddingLeft: 22 }} />
                </div>
              </Field>
            </div>
            {variant.comparePricePaise != null && variant.comparePricePaise > variant.pricePaise && (
              <p style={{ fontSize: 11, color: T.success, marginTop: 6, display: "flex", alignItems: "center", gap: 4 }}>
                <CheckCircle2 style={{ width: 12, height: 12 }} />
                {Math.round((1 - variant.pricePaise / variant.comparePricePaise) * 100)}% off
              </p>
            )}
          </div>

          {/* Inventory group */}
          <div style={{ paddingTop: 12, borderTop: `1px solid ${T.border}` }}>
            <p style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: T.text4, marginBottom: 8 }}>Inventory</p>
            <div className="a-grid-2" style={{ gap: 10 }}>
              <Field label="Stock quantity">
                <input type="number" min="0" value={variant.stockQuantity}
                  onChange={e => up({ stockQuantity: parseInt(e.target.value || "0") })}
                  className="a-form-input" />
              </Field>
              <Field label="Low stock threshold" hint="Alert when at or below this">
                <input type="number" min="0" value={variant.lowStockThreshold}
                  onChange={e => up({ lowStockThreshold: parseInt(e.target.value || "0") })}
                  className="a-form-input" />
              </Field>
            </div>
            {variant.stockQuantity > 0 && variant.stockQuantity <= variant.lowStockThreshold && (
              <p style={{ fontSize: 11, color: T.warning, marginTop: 6, display: "flex", alignItems: "center", gap: 4 }}>
                <AlertCircle style={{ width: 12, height: 12 }} />
                Low stock — only {variant.stockQuantity} remaining
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Section nav (sticky, compact) ────────────────────────────────────────────

function SectionNav({ activeSection }: { activeSection: string }) {
  return (
    <div style={{
      position: "sticky", top: 16, background: T.surface,
      border: `1px solid ${T.border}`, borderRadius: T.radiusMd,
      boxShadow: T.shadow, padding: "10px 8px", display: "flex",
      flexDirection: "column", gap: 2,
    }}>
      <p style={{ fontSize: 9.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: T.text4, padding: "2px 8px 8px" }}>Sections</p>
      {SECTIONS.map(({ id, label, Icon, color, bg }) => {
        const active = activeSection === id;
        return (
          <button
            key={id}
            type="button"
            onClick={() => { document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" }); }}
            style={{
              display: "flex", alignItems: "center", gap: 9, padding: "7px 8px",
              borderRadius: T.radius, border: "none", cursor: "pointer",
              background: active ? bg : "transparent",
              color: active ? color : T.text3,
              fontSize: 13, fontWeight: active ? 600 : 500,
              transition: "all 0.12s", width: "100%", textAlign: "left",
            }}
          >
            <div style={{
              width: 22, height: 22, borderRadius: T.radiusSm, flexShrink: 0,
              background: active ? bg : T.surface2, display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <Icon style={{ width: 12, height: 12, color: active ? color : T.text4 }} />
            </div>
            {label}
            {active && <div style={{ width: 4, height: 4, borderRadius: "50%", background: color, marginLeft: "auto" }} />}
          </button>
        );
      })}
    </div>
  );
}

// ─── Toggle ───────────────────────────────────────────────────────────────────

function Toggle({ checked, onChange, label, sub }: {
  checked: boolean; onChange: (v: boolean) => void; label: string; sub?: string;
}) {
  return (
    <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", userSelect: "none" }}>
      <div
        onClick={() => onChange(!checked)}
        style={{
          height: 20, width: 36, borderRadius: 10,
          background: checked ? T.primary : T.border,
          position: "relative", flexShrink: 0, transition: "background 0.15s", cursor: "pointer",
        }}
      >
        <span style={{
          position: "absolute", top: 2, left: checked ? 18 : 2, width: 16, height: 16,
          background: "white", borderRadius: "50%", boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
          transition: "left 0.15s",
        }} />
      </div>
      <div>
        <span style={{ fontSize: 13, fontWeight: 500, color: T.text }}>{label}</span>
        {sub && <span style={{ fontSize: 11, color: T.text3, marginLeft: 6 }}>{sub}</span>}
      </div>
    </label>
  );
}

// ─── Inline number field with unit ───────────────────────────────────────────

function NumField({ label, value, onChange, placeholder, unit, hint }: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder: string; unit: string; hint?: string;
}) {
  return (
    <Field label={label} hint={hint}>
      <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
        <input type="number" min="0" step="0.1" value={value} onChange={e => onChange(e.target.value)}
          placeholder={placeholder} className="a-form-input" style={{ paddingRight: 36 }} />
        <span style={{
          position: "absolute", right: 10, fontSize: 11, fontWeight: 600,
          color: T.text4, pointerEvents: "none", letterSpacing: "0.02em",
        }}>{unit}</span>
      </div>
    </Field>
  );
}

// ─── Main form ────────────────────────────────────────────────────────────────

interface Props {
  product?: StoreProduct;
  catalogPrefill?: CatalogPrefill;
}

export function ProductForm({ product, catalogPrefill }: Props) {
  const router = useRouter();
  const isEdit = !!product;
  const pre = catalogPrefill;

  // Core
  const [name, setName] = useState(product?.name ?? pre?.name ?? "");
  const [slug, setSlug] = useState(product?.slug ?? pre?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(isEdit || !!pre?.slug);
  const [brandId, setBrandId] = useState(product?.brandId ?? "");
  const [productGroupId, setProductGroupId] = useState(product?.productGroupId ?? "");
  const [productType, setProductType] = useState(product?.productType ?? pre?.type ?? "");
  const [shortDescription, setShortDescription] = useState(product?.shortDescription ?? pre?.shortDescription ?? "");
  const [fullDescription, setFullDescription] = useState(product?.fullDescription ?? pre?.fullDescription ?? "");
  const [usageInfo, setUsageInfo] = useState(product?.usageInfo ?? pre?.usageInfo ?? "");
  const [ingredients, setIngredients] = useState(product?.ingredients ?? pre?.ingredients ?? "");
  const [warnings, setWarnings] = useState(product?.warnings ?? pre?.warnings ?? "");
  const [images, setImages] = useState<string[]>(product?.images ?? pre?.images ?? []);
  const [tags, setTags] = useState<string[]>(product?.tags ?? pre?.searchTags ?? []);
  const [tagInput, setTagInput] = useState("");
  const [healthGoalTags, setHealthGoalTags] = useState<string[]>(product?.healthGoalTags ?? pre?.goalTags ?? []);
  const [isFeatured, setIsFeatured] = useState(product?.isFeatured ?? false);
  const [published, setPublished] = useState(product?.published ?? (pre != null ? true : false));
  const [availability, setAvailability] = useState<"active" | "inactive" | "out_of_stock" | "discontinued">(product?.availability ?? "active");
  const [sortOrder, setSortOrder] = useState(product?.sortOrder ?? 0);
  const [catalogSourceId] = useState(product?.catalogSourceId ?? pre?.catalogId ?? "");

  // Nutrition
  const n = product?.nutrition;
  const [servingSizeLabel, setServingSizeLabel] = useState(n?.servingSizeLabel ?? pre?.servingSizeLabel ?? "");
  const [servingSizeG, setServingSizeG] = useState<string>(n?.servingSizeG?.toString() ?? pre?.servingSizeG?.toString() ?? "");
  const [calories, setCalories] = useState<string>(n?.caloriesPerServing?.toString() ?? pre?.calories?.toString() ?? "");
  const [protein, setProtein] = useState<string>(n?.proteinPerServing?.toString() ?? pre?.proteinG?.toString() ?? "");
  const [carbs, setCarbs] = useState<string>(n?.carbsPerServing?.toString() ?? pre?.carbohydratesG?.toString() ?? "");
  const [fat, setFat] = useState<string>(n?.fatPerServing?.toString() ?? pre?.fatG?.toString() ?? "");
  const [fibre, setFibre] = useState<string>(n?.fibrePerServing?.toString() ?? pre?.fibreG?.toString() ?? "");
  const [sodium, setSodium] = useState<string>(n?.sodiumPerServing?.toString() ?? pre?.sodiumMg?.toString() ?? "");
  const [sugar, setSugar] = useState<string>(n?.sugarPerServing?.toString() ?? pre?.sugarG?.toString() ?? "");

  // Variants
  const [variants, setVariants] = useState<VariantDraft[]>(() => {
    if (product?.variants?.length) {
      return product.variants.map((v, i) => ({
        id: v.id, tempId: v.id, sku: v.sku, name: v.name, sizeLabel: v.sizeLabel,
        flavour: v.flavour, color: v.color, pricePaise: v.pricePaise,
        comparePricePaise: v.comparePricePaise, stockQuantity: v.stockQuantity,
        lowStockThreshold: v.lowStockThreshold, availability: v.availability,
        isDefault: v.isDefault, sortOrder: v.sortOrder ?? i,
      }));
    }
    if (pre?.variants?.length) {
      return pre.variants.map((cv, i) => ({
        id: undefined, tempId: `temp-${i}`, sku: cv.sku,
        name: cv.variantName || `${cv.sizeWeight}${cv.flavour ? ` – ${cv.flavour}` : ""}`,
        sizeLabel: cv.sizeWeight, flavour: cv.flavour, color: cv.colour,
        pricePaise: cv.suggestedPriceINR != null ? Math.round(cv.suggestedPriceINR * 100) : 0,
        comparePricePaise: cv.compareAtPriceINR != null ? Math.round(cv.compareAtPriceINR * 100) : null,
        stockQuantity: cv.stockQuantity, lowStockThreshold: cv.lowStockThreshold,
        availability: "active" as const, isDefault: cv.isDefaultVariant || i === 0, sortOrder: i,
      }));
    }
    return [emptyVariant(0)];
  });

  // Meta
  const [productGroups, setProductGroups] = useState<ProductGroup[]>([]);
  const [brands, setBrands] = useState<StoreBrand[]>([]);
  const [existingTypes, setExistingTypes] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [newBrandName, setNewBrandName] = useState("");
  const [showNewBrand, setShowNewBrand] = useState(false);
  const [activeSection, setActiveSection] = useState("basics");

  useEffect(() => {
    fetchAllProductGroups().then(grps => {
      setProductGroups(grps);
      if (!isEdit && pre?.userCategory && !productGroupId) {
        const needle = pre.userCategory.toLowerCase();
        const match = grps.find(g => g.name.toLowerCase() === needle || g.slug.toLowerCase() === needle);
        if (match) setProductGroupId(match.id);
      }
    });
    adminFetchAllBrands().then(bds => {
      setBrands(bds);
      if (!isEdit && pre?.brand && !brandId) {
        const needle = pre.brand.toLowerCase();
        const match = bds.find(b => b.name.toLowerCase() === needle || b.slug.toLowerCase() === needle);
        if (match) setBrandId(match.id);
      }
    });
    fetchAllProductTypes().then(pts => setExistingTypes(pts.map(t => t.name)));
  }, []); // eslint-disable-line

  useEffect(() => {
    if (!slugTouched && name) setSlug(generateSlug(name));
  }, [name, slugTouched]);

  // Scroll-spy for nav
  useEffect(() => {
    const ids = SECTIONS.map(s => s.id);
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (entry.isIntersecting) setActiveSection(entry.target.id);
      }
    }, { rootMargin: "-30% 0px -60% 0px", threshold: 0 });
    ids.forEach(id => { const el = document.getElementById(id); if (el) observer.observe(el); });
    return () => observer.disconnect();
  }, []);

  function toggleGoalTag(key: string) {
    setHealthGoalTags(prev => prev.includes(key) ? prev.filter(t => t !== key) : [...prev, key]);
  }

  function addTag() {
    const t = tagInput.trim().toLowerCase();
    if (t && !tags.includes(t)) setTags(prev => [...prev, t]);
    setTagInput("");
  }

  async function handleCreateBrand() {
    if (!newBrandName.trim()) return;
    const { brand, error } = await adminCreateBrand(newBrandName.trim());
    if (error) { setError(`Brand error: ${error}`); return; }
    if (brand) { setBrands(prev => [...prev, brand]); setBrandId(brand.id); }
    setNewBrandName(""); setShowNewBrand(false);
  }

  function buildPayload() {
    return {
      name: name.trim(),
      slug: slug.trim() || generateSlug(name.trim()),
      brand_id: brandId || null,
      category_id: null,
      product_group_id: productGroupId || null,
      product_type: productType.trim(),
      catalog_source_id: catalogSourceId || null,
      short_description: shortDescription.trim(),
      full_description: fullDescription.trim(),
      usage_info: usageInfo.trim(),
      ingredients: ingredients.trim(),
      warnings: warnings.trim(),
      images, tags, health_goal_tags: healthGoalTags,
      serving_size_label: servingSizeLabel.trim(),
      serving_size_g: servingSizeG ? parseFloat(servingSizeG) : null,
      calories_per_serving: calories ? parseFloat(calories) : null,
      protein_per_serving: protein ? parseFloat(protein) : null,
      carbs_per_serving: carbs ? parseFloat(carbs) : null,
      fat_per_serving: fat ? parseFloat(fat) : null,
      fibre_per_serving: fibre ? parseFloat(fibre) : null,
      sodium_per_serving: sodium ? parseFloat(sodium) : null,
      sugar_per_serving: sugar ? parseFloat(sugar) : null,
      published, availability, is_featured: isFeatured, sort_order: sortOrder,
    };
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError("Product name is required"); return; }
    if (!slug.trim()) { setError("URL slug is required"); return; }
    if (published && !productGroupId) { setError("Select a Product Group before publishing — customers browse by Product Group on the storefront."); return; }
    if (variants.length === 0) { setError("At least one variant is required"); return; }
    if (variants.some(v => !v.sku.trim())) { setError("All variants must have a SKU"); return; }
    if (variants.some(v => v.pricePaise <= 0)) { setError("All variants must have a price greater than 0"); return; }
    if (!variants.some(v => v.isDefault)) { setError("Mark one variant as the default (star icon)"); return; }
    const skus = variants.map(v => v.sku.trim().toLowerCase());
    if (new Set(skus).size !== skus.length) { setError("Variant SKUs must be unique"); return; }

    setSaving(true); setError(null);
    let productId: string;

    if (isEdit && product) {
      const { product: updated, error: err } = await adminUpdateProduct(product.id, buildPayload());
      if (err || !updated) { setError(friendlyDbError(err) ?? "Failed to update product"); setSaving(false); return; }
      productId = updated.id;
    } else {
      const { product: created, error: err } = await adminCreateProduct(buildPayload() as Parameters<typeof adminCreateProduct>[0]);
      if (err || !created) { setError(friendlyDbError(err) ?? "Failed to create product"); setSaving(false); return; }
      productId = created.id;
    }

    const existingIds = product?.variants?.map(v => v.id) ?? [];
    const incomingIds = variants.filter(v => v.id).map(v => v.id as string);
    const toDelete = existingIds.filter(id => !incomingIds.includes(id));
    await Promise.all(toDelete.map(id => adminDeleteVariant(id)));

    for (let i = 0; i < variants.length; i++) {
      const v = variants[i];
      // For updates, omit images so existing variant images are preserved.
      // For creates, pass empty array (images managed separately).
      const basePayload = {
        product_id: productId, sku: v.sku.trim(), name: v.name.trim(),
        size_label: v.sizeLabel.trim(), flavour: v.flavour.trim(), color: v.color.trim(),
        price_paise: v.pricePaise, compare_price_paise: v.comparePricePaise,
        stock_quantity: v.stockQuantity, low_stock_threshold: v.lowStockThreshold,
        availability: v.availability, is_default: v.isDefault, sort_order: i,
      };
      if (v.id) {
        const { error: ve } = await adminUpdateVariant(v.id, basePayload);
        if (ve) { setError(friendlyDbError(ve) ?? "Failed to update a variant"); setSaving(false); return; }
      } else {
        const { error: ve } = await adminCreateVariant({ ...basePayload, images: [] });
        if (ve) { setError(friendlyDbError(ve) ?? "Failed to save a variant"); setSaving(false); return; }
      }
    }

    setSaving(false); setSuccess(true);
    setTimeout(() => router.push("/admin/products"), 800);
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <form onSubmit={handleSubmit} style={{ maxWidth: 1100, paddingBottom: 80 }}>

      {/* Catalog prefill banner */}
      {catalogPrefill && (
        <div className="a-alert a-alert-info" style={{ marginBottom: 14 }}>
          <Info style={{ width: 14, height: 14, flexShrink: 0, marginTop: 1 }} />
          <div style={{ fontSize: 13 }}>
            <strong>Prefilled from catalog</strong> ({catalogPrefill.catalogId}) — review and adjust before saving.
            Price, stock, and publishing only exist once saved.
          </div>
        </div>
      )}

      {/* ── Page header ──────────────────────────────────────────────────────── */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        gap: 12, marginBottom: 18, flexWrap: "wrap",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button
            type="button" onClick={() => router.push("/admin/products")}
            className="a-btn a-btn-secondary a-btn-icon" aria-label="Back"
          >
            <ArrowLeft style={{ width: 14, height: 14 }} />
          </button>
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: T.text, letterSpacing: "-0.02em", lineHeight: 1.2 }}>
              {isEdit ? "Edit product" : "Add product"}
            </h2>
            {isEdit && <p style={{ fontSize: 12, color: T.text3, marginTop: 1 }}>{product?.name}</p>}
          </div>
        </div>

        {/* Header actions */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {/* Publish toggle — visual pill */}
          <button
            type="button"
            onClick={() => setPublished(p => !p)}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              height: 34, padding: "0 12px", borderRadius: T.radius, cursor: "pointer",
              border: `1px solid ${published ? T.successBorder : T.border}`,
              background: published ? T.successBg : T.surface,
              color: published ? T.success : T.text3,
              fontSize: 13, fontWeight: 500, transition: "all 0.15s",
            }}
          >
            {published
              ? <><Eye style={{ width: 14, height: 14 }} /> Published</>
              : <><EyeOff style={{ width: 14, height: 14 }} /> Draft</>
            }
          </button>

          <button type="submit" disabled={saving || success} className="a-btn a-btn-primary">
            {saving
              ? <><Loader2 style={{ width: 13, height: 13 }} className="animate-spin" /> Saving…</>
              : success
              ? <><CheckCircle2 style={{ width: 13, height: 13 }} /> Saved!</>
              : <><Save style={{ width: 13, height: 13 }} /> Save product</>
            }
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="a-alert a-alert-error" style={{ marginBottom: 14 }}>
          <AlertTriangle style={{ width: 14, height: 14, flexShrink: 0, marginTop: 1 }} />
          <p style={{ margin: 0 }}>{error}</p>
        </div>
      )}

      {/* ── Two-col layout: nav + content ─────────────────────────────────── */}
      <div className="a-grid-thumb-148" style={{ gap: 16, alignItems: "start" }}>

        {/* Left nav */}
        <SectionNav activeSection={activeSection} />

        {/* Right content */}
        <div>

          {/* ── BASICS ──────────────────────────────────────────────────── */}
          <Section id="basics" title="Basic information" icon={Package} iconColor={SECTIONS[0].color} iconBg={SECTIONS[0].bg}>
            {/* Row 1: name (full width) */}
            <div style={{ marginBottom: 12 }}>
              <Field label="Product name" required>
                <input
                  required type="text" value={name} onChange={e => setName(e.target.value)}
                  placeholder="e.g. Whey Protein Isolate"
                  className="a-form-input"
                  style={{ fontSize: 15, fontWeight: 500, height: 40 }}
                />
              </Field>
            </div>

            {/* Row 2: slug + availability */}
            <div className="a-grid-2" style={{ gap: 10, marginBottom: 12 }}>
              <Field label="URL slug" hint="Auto-generated from name">
                <input
                  type="text" value={slug}
                  onChange={e => { setSlug(e.target.value); setSlugTouched(true); }}
                  placeholder="whey-protein-isolate"
                  className="a-form-input"
                  style={{ fontFamily: "monospace", fontSize: 12 }}
                />
              </Field>
              <Field label="Availability">
                <select value={availability} onChange={e => setAvailability(e.target.value as typeof availability)} className="a-form-input">
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="out_of_stock">Out of Stock</option>
                  <option value="discontinued">Discontinued</option>
                </select>
              </Field>
            </div>

            {/* Row 3: brand + category */}
            <div className="a-grid-2" style={{ gap: 10, marginBottom: 12 }}>
              <Field label="Brand">
                {showNewBrand ? (
                  <div style={{ display: "flex", gap: 6 }}>
                    <input
                      autoFocus type="text" value={newBrandName} onChange={e => setNewBrandName(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && (e.preventDefault(), handleCreateBrand())}
                      placeholder="New brand name" className="a-form-input" style={{ flex: 1 }}
                    />
                    <button type="button" onClick={handleCreateBrand} className="a-btn a-btn-primary a-btn-sm">Add</button>
                    <button type="button" onClick={() => setShowNewBrand(false)} className="a-btn a-btn-ghost a-btn-sm">×</button>
                  </div>
                ) : (
                  <div style={{ display: "flex", gap: 6 }}>
                    <select value={brandId} onChange={e => setBrandId(e.target.value)} className="a-form-input" style={{ flex: 1 }}>
                      <option value="">No brand</option>
                      {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                    <button type="button" onClick={() => setShowNewBrand(true)} className="a-btn a-btn-secondary a-btn-icon" title="Add new brand">
                      <Plus style={{ width: 14, height: 14 }} />
                    </button>
                  </div>
                )}
              </Field>

              <Field label={`Product group${published ? " *" : ""}`} hint="Required to publish">
                <select value={productGroupId} onChange={e => setProductGroupId(e.target.value)} className="a-form-input">
                  <option value="">No product group</option>
                  {productGroups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
              </Field>
            </div>

            {/* Row 4: product type + sort order */}
            <div className="a-grid-suffix-120" style={{ gap: 10, marginBottom: 16 }}>
              <Field label="Product type" hint='e.g. "Whey Protein", "Creatine"'>
                <input
                  type="text" value={productType} onChange={e => setProductType(e.target.value)}
                  placeholder="e.g. Whey Protein" className="a-form-input" list="product-type-suggestions"
                />
                <datalist id="product-type-suggestions">
                  {existingTypes.map(t => <option key={t} value={t} />)}
                </datalist>
              </Field>
              <Field label="Sort order" hint="Lower = first">
                <input type="number" min="0" value={sortOrder} onChange={e => setSortOrder(parseInt(e.target.value || "0"))} className="a-form-input" />
              </Field>
            </div>

            {/* Short description */}
            <div style={{ marginBottom: 12 }}>
              <Field label="Short description">
                <textarea
                  value={shortDescription} onChange={e => setShortDescription(e.target.value)}
                  rows={2} placeholder="One-line summary shown in cards and search results"
                  className="a-form-input w-full resize-none"
                />
              </Field>
            </div>

            {/* Full description */}
            <div style={{ marginBottom: 16 }}>
              <Field label="Full description" hint="Markdown supported — **bold**, *italic*, bullet lists">
                <textarea
                  value={fullDescription} onChange={e => setFullDescription(e.target.value)}
                  rows={5} placeholder="Detailed product description…"
                  className="a-form-input w-full resize-y"
                  style={{ fontFamily: "monospace", fontSize: 12 }}
                />
              </Field>
            </div>

            {/* Toggles row */}
            <div style={{
              display: "flex", gap: 24, padding: "14px 16px",
              background: T.surface2, borderRadius: T.radius, border: `1px solid ${T.border}`,
            }}>
              <Toggle checked={isFeatured} onChange={setIsFeatured} label="Featured product" sub="Shown in homepage sections" />
            </div>
          </Section>

          {/* ── MEDIA ───────────────────────────────────────────────────── */}
          <Section id="media" title="Product images" icon={ImageIcon} iconColor={SECTIONS[1].color} iconBg={SECTIONS[1].bg}>
            <ImageUploader images={images} onChange={setImages} productSlug={slug || "product"} />
          </Section>

          {/* ── GOALS ───────────────────────────────────────────────────── */}
          <Section id="goals" title="Goals & tags" icon={Sparkles} iconColor={SECTIONS[2].color} iconBg={SECTIONS[2].bg}>
            <p style={{ fontSize: 12, color: T.text3, marginBottom: 12 }}>
              Tag with health goals for goal-based store sections. Add search tags below.
            </p>

            {/* Goal buttons — 2×2 compact grid */}
            <div className="a-grid-4" style={{ gap: 8, marginBottom: 16 }}>
              {HEALTH_GOAL_TAGS.map(({ key, label, Icon, color, bg }) => {
                const active = healthGoalTags.includes(key);
                return (
                  <button
                    key={key} type="button" onClick={() => toggleGoalTag(key)}
                    style={{
                      display: "flex", flexDirection: "column", alignItems: "center",
                      gap: 6, padding: "12px 8px", borderRadius: T.radius, cursor: "pointer",
                      border: `1.5px solid ${active ? color : T.border}`,
                      background: active ? bg : T.surface,
                      color: active ? color : T.text3,
                      fontSize: 12, fontWeight: active ? 600 : 500, transition: "all 0.15s",
                    }}
                  >
                    <div style={{
                      width: 28, height: 28, borderRadius: T.radiusSm, background: active ? bg : T.surface2,
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      <Icon style={{ width: 14, height: 14, color: active ? color : T.text4 }} />
                    </div>
                    {label}
                  </button>
                );
              })}
            </div>

            {/* Search tags */}
            <div style={{ paddingTop: 14, borderTop: `1px solid ${T.border}` }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: T.text2, marginBottom: 8 }}>Search tags</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
                {tags.map(t => (
                  <span key={t} style={{
                    display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 8px",
                    borderRadius: 4, fontSize: 11, fontWeight: 500, background: T.primaryMid, color: T.primaryText,
                    border: `1px solid #BFDBFE`,
                  }}>
                    {t}
                    <button type="button" onClick={() => setTags(prev => prev.filter(x => x !== t))} style={{
                      display: "inline-flex", alignItems: "center", justifyContent: "center",
                      width: 14, height: 14, border: "none", background: "none", cursor: "pointer",
                      color: T.primaryText, padding: 0, borderRadius: 2, opacity: 0.7,
                    }}>
                      <X style={{ width: 10, height: 10 }} />
                    </button>
                  </span>
                ))}
                {tags.length === 0 && <span style={{ fontSize: 12, color: T.text4 }}>No tags yet</span>}
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <input
                  type="text" value={tagInput} onChange={e => setTagInput(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addTag(); } if (e.key === ",") { e.preventDefault(); addTag(); } }}
                  placeholder="keto, vegan, bestseller… (Enter or comma to add)"
                  className="a-form-input" style={{ flex: 1, fontSize: 12 }}
                />
                <button type="button" onClick={addTag} className="a-btn a-btn-secondary a-btn-sm">Add</button>
              </div>
            </div>
          </Section>

          {/* ── NUTRITION ───────────────────────────────────────────────── */}
          <Section id="nutrition" title="Nutrition (per serving)" icon={BarChart2} iconColor={SECTIONS[3].color} iconBg={SECTIONS[3].bg}>
            <p style={{ fontSize: 12, color: T.text3, marginBottom: 14 }}>
              For supplements and health foods. Leave blank for non-food items.
            </p>

            {/* Serving */}
            <div className="a-grid-suffix-140" style={{ gap: 10, marginBottom: 14 }}>
              <Field label="Serving size label" hint='e.g. "1 scoop (30g)"'>
                <input type="text" value={servingSizeLabel} onChange={e => setServingSizeLabel(e.target.value)}
                  placeholder="1 scoop (30g)" className="a-form-input" />
              </Field>
              <NumField label="Serving size" value={servingSizeG} onChange={setServingSizeG} placeholder="30" unit="g" />
            </div>

            {/* Macro grid — 2×4 layout */}
            <div className="a-grid-4" style={{
              gap: 10,
              padding: 14, background: T.surface2, borderRadius: T.radius,
              border: `1px solid ${T.border}`,
            }}>
              <NumField label="Calories" value={calories} onChange={setCalories} placeholder="120" unit="kcal" />
              <NumField label="Protein" value={protein} onChange={setProtein} placeholder="25" unit="g" />
              <NumField label="Carbs" value={carbs} onChange={setCarbs} placeholder="5" unit="g" />
              <NumField label="Fat" value={fat} onChange={setFat} placeholder="2" unit="g" />
              <NumField label="Fibre" value={fibre} onChange={setFibre} placeholder="1" unit="g" />
              <NumField label="Sugar" value={sugar} onChange={setSugar} placeholder="2" unit="g" />
              <NumField label="Sodium" value={sodium} onChange={setSodium} placeholder="50" unit="mg" />
            </div>

            {/* Visual macro bar — shown when values exist */}
            {(calories || protein || carbs || fat) && (() => {
              const p = parseFloat(protein) || 0;
              const c = parseFloat(carbs) || 0;
              const f = parseFloat(fat) || 0;
              const total = p * 4 + c * 4 + f * 9;
              if (total === 0) return null;
              return (
                <div style={{ marginTop: 12 }}>
                  <p style={{ fontSize: 11, color: T.text4, marginBottom: 5 }}>Macros (% of calories)</p>
                  <div style={{ display: "flex", borderRadius: 4, overflow: "hidden", height: 8, gap: 1 }}>
                    {p > 0 && <div title={`Protein ${Math.round(p * 4 / total * 100)}%`} style={{ flex: p * 4, background: "#1D4ED8", transition: "flex 0.3s" }} />}
                    {c > 0 && <div title={`Carbs ${Math.round(c * 4 / total * 100)}%`} style={{ flex: c * 4, background: "#F59E0B", transition: "flex 0.3s" }} />}
                    {f > 0 && <div title={`Fat ${Math.round(f * 9 / total * 100)}%`} style={{ flex: f * 9, background: "#EF4444", transition: "flex 0.3s" }} />}
                  </div>
                  <div style={{ display: "flex", gap: 12, marginTop: 5 }}>
                    {[[`Protein ${Math.round(p * 4 / total * 100)}%`, "#1D4ED8"],
                      [`Carbs ${Math.round(c * 4 / total * 100)}%`, "#F59E0B"],
                      [`Fat ${Math.round(f * 9 / total * 100)}%`, "#EF4444"]].map(([lbl, col]) => (
                      <div key={lbl as string} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <div style={{ width: 8, height: 8, borderRadius: 2, background: col as string }} />
                        <span style={{ fontSize: 10, color: T.text3 }}>{lbl as string}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}
          </Section>

          {/* ── CONTENT ─────────────────────────────────────────────────── */}
          <Section id="content" title="Usage & ingredients" icon={FileText} iconColor={SECTIONS[4].color} iconBg={SECTIONS[4].bg}>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <Field label="Usage information" hint="How to use — shown on the product page">
                <textarea
                  value={usageInfo} onChange={e => setUsageInfo(e.target.value)}
                  rows={3} placeholder="e.g. Mix 1 scoop with 200ml water. Take 30 min post-workout."
                  className="a-form-input w-full resize-y"
                />
              </Field>
              <Field label="Ingredients">
                <textarea
                  value={ingredients} onChange={e => setIngredients(e.target.value)}
                  rows={4} placeholder="Full ingredient list"
                  className="a-form-input w-full resize-y"
                  style={{ fontFamily: "monospace", fontSize: 12 }}
                />
              </Field>
              <Field label="Warnings / allergens">
                <textarea
                  value={warnings} onChange={e => setWarnings(e.target.value)}
                  rows={3} placeholder="e.g. Contains milk. Not suitable for individuals with lactose intolerance."
                  className="a-form-input w-full resize-y"
                  style={{ borderColor: warnings ? T.warningBorder : undefined }}
                />
              </Field>
            </div>
          </Section>

          {/* ── VARIANTS ────────────────────────────────────────────────── */}
          <Section
            id="variants" title="Variants & pricing" icon={Layers}
            iconColor={SECTIONS[5].color} iconBg={SECTIONS[5].bg}
            action={
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 12, color: T.text3 }}>{variants.length} variant{variants.length !== 1 ? "s" : ""}</span>
                <button
                  type="button"
                  onClick={() => setVariants(prev => [...prev, emptyVariant(prev.length)])}
                  className="a-btn a-btn-secondary a-btn-sm"
                  style={{ gap: 4 }}
                >
                  <Plus style={{ width: 12, height: 12 }} /> Add variant
                </button>
              </div>
            }
          >
            <p style={{ fontSize: 12, color: T.text3, marginBottom: 12 }}>
              Each product needs at least one variant. Variants hold size, flavour, price, SKU, and stock.
              The <Star style={{ width: 10, height: 10, display: "inline" }} /> starred variant is shown first.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {variants.map((v, i) => (
                <VariantRow
                  key={v.tempId} variant={v} index={i}
                  onChange={upd => { const next = [...variants]; next[i] = upd; setVariants(next); }}
                  onDelete={() => {
                    const wasDefault = variants[i]?.isDefault;
                    const next = variants.filter((_, idx) => idx !== i);
                    if (wasDefault && next.length > 0 && !next.some(x => x.isDefault)) next[0] = { ...next[0], isDefault: true };
                    setVariants(next);
                  }}
                  onSetDefault={() => setVariants(variants.map((x, idx) => ({ ...x, isDefault: idx === i })))}
                  canDelete={variants.length > 1}
                />
              ))}
            </div>
          </Section>

        </div>{/* end right col */}
      </div>{/* end grid */}

      {/* ── Sticky footer ─────────────────────────────────────────────────── */}
      <div className="a-form-actions">
        <span style={{ fontSize: 12, color: T.text3, marginRight: "auto" }}>
          {success ? "✓ Saved — redirecting…" : isEdit ? `Editing · ${product?.name}` : "New product"}
        </span>
        <button type="button" onClick={() => router.push("/admin/products")} className="a-btn a-btn-secondary">
          Cancel
        </button>
        <button type="submit" disabled={saving || success} className="a-btn a-btn-primary">
          {saving
            ? <><Loader2 style={{ width: 13, height: 13 }} className="animate-spin" /> Saving…</>
            : success
            ? <><CheckCircle2 style={{ width: 13, height: 13 }} /> Saved!</>
            : <><Save style={{ width: 13, height: 13 }} /> Save product</>
          }
        </button>
      </div>

      {/* Responsive — collapse nav on small screens */}
      <style>{`
        @media (max-width: 720px) {
          form > div:last-of-type > div:first-child { display: none; }
          form > div:last-of-type { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </form>
  );
}