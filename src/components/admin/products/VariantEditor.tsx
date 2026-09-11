"use client";

import { useState } from "react";
import { Plus, Trash2, Star, ChevronDown, ChevronUp, GripVertical } from "lucide-react";

export interface VariantDraft {
  id?: string;         // set if this is an existing variant
  tempId: string;      // always set for React key
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
    sku: "",
    name: "",
    sizeLabel: "",
    flavour: "",
    color: "",
    pricePaise: 0,
    comparePricePaise: null,
    stockQuantity: 0,
    lowStockThreshold: 5,
    availability: "active",
    isDefault: sortOrder === 0,
    sortOrder,
  };
}

interface VariantRowProps {
  variant: VariantDraft;
  index: number;
  onChange: (v: VariantDraft) => void;
  onDelete: () => void;
  onSetDefault: () => void;
  canDelete: boolean;
}

function VariantRow({ variant, index, onChange, onDelete, onSetDefault, canDelete }: VariantRowProps) {
  const [expanded, setExpanded] = useState(index === 0);

  const update = (patch: Partial<VariantDraft>) => onChange({ ...variant, ...patch });

  return (
    <div style={{ border: "1px solid var(--a-border)", borderRadius: "var(--a-radius-md)", overflow: "hidden", marginBottom: 8 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", background: "var(--a-surface-2)" }}>
        <GripVertical style={{ width: 14, height: 14, color: "var(--a-text-3)", flexShrink: 0, cursor: "grab" }} />
        <button type="button" onClick={() => setExpanded(e => !e)} style={{ flex: 1, display: "flex", alignItems: "center", gap: 8, textAlign: "left", background: "none", border: "none", cursor: "pointer", minWidth: 0, padding: 0 }}>
          <span style={{ fontSize: 13, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "var(--a-text)" }}>
            {variant.name || `Variant ${index + 1}`}
            {variant.sizeLabel ? ` · ${variant.sizeLabel}` : ""}
            {variant.flavour ? ` · ${variant.flavour}` : ""}
          </span>
          {variant.pricePaise > 0 && (
            <span style={{ fontSize: 11, color: "var(--a-text-3)", flexShrink: 0 }}>
              ₹{(variant.pricePaise / 100).toLocaleString("en-IN")}
            </span>
          )}
          {variant.isDefault && (
            <span className="a-badge a-badge-blue" style={{ flexShrink: 0, fontSize: 10 }}>Default</span>
          )}
          {expanded
            ? <ChevronUp style={{ width: 14, height: 14, marginLeft: "auto", color: "var(--a-text-3)", flexShrink: 0 }} />
            : <ChevronDown style={{ width: 14, height: 14, marginLeft: "auto", color: "var(--a-text-3)", flexShrink: 0 }} />
          }
        </button>

        <button
          type="button"
          onClick={onSetDefault}
          disabled={variant.isDefault}
          title={variant.isDefault ? "Default variant" : "Set as default"}
          className="a-btn a-btn-ghost a-btn-icon a-btn-sm"
          style={variant.isDefault ? { color: "#d97706" } : {}}
        >
          <Star style={{ width: 13, height: 13, fill: variant.isDefault ? "#d97706" : "none" }} />
        </button>

        {canDelete && (
          <button
            type="button"
            onClick={onDelete}
            className="a-btn a-btn-ghost a-btn-icon a-btn-sm"
            style={{ color: "var(--a-danger)" }}
          >
            <Trash2 style={{ width: 13, height: 13 }} />
          </button>
        )}
      </div>

      {/* Fields */}
      {expanded && (
        <div className="a-grid-2" style={{ padding: "12px 14px 14px", gap: 12, background: "var(--a-surface)" }}>
          <Field label="SKU *" required>
            <input
              required
              type="text"
              value={variant.sku}
              onChange={e => update({ sku: e.target.value })}
              placeholder="e.g. WP-1KG-CHOC"
              className="a-form-input"
            />
          </Field>
          <Field label="Variant Name">
            <input
              type="text"
              value={variant.name}
              onChange={e => update({ name: e.target.value })}
              placeholder="e.g. 1kg – Chocolate"
              className="a-form-input"
            />
          </Field>
          <Field label="Size / Weight">
            <input
              type="text"
              value={variant.sizeLabel}
              onChange={e => update({ sizeLabel: e.target.value })}
              placeholder="e.g. 1kg, 500g, 60 caps"
              className="a-form-input"
            />
          </Field>
          <Field label="Flavour">
            <input
              type="text"
              value={variant.flavour}
              onChange={e => update({ flavour: e.target.value })}
              placeholder="e.g. Chocolate Fudge"
              className="a-form-input"
            />
          </Field>
          <Field label="Colour (non-food)">
            <input
              type="text"
              value={variant.color}
              onChange={e => update({ color: e.target.value })}
              placeholder="e.g. Black, Blue"
              className="a-form-input"
            />
          </Field>
          <Field label="Availability">
            <select value={variant.availability} onChange={e => update({ availability: e.target.value })} className="a-form-input">
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="out_of_stock">Out of Stock</option>
              <option value="discontinued">Discontinued</option>
            </select>
          </Field>

          {/* Pricing row */}
          <Field label="Price (₹) *" required>
            <div className="relative">
              <span style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)", color: "var(--a-text-3)", fontSize: 13, pointerEvents: "none" }}>₹</span>
              <input
                required
                type="number"
                min="0"
                step="0.01"
                value={variant.pricePaise > 0 ? (variant.pricePaise / 100).toFixed(2) : ""}
                onChange={e => update({ pricePaise: Math.round(parseFloat(e.target.value || "0") * 100) })}
                placeholder="0.00"
                className="a-form-input"
                style={{ paddingLeft: 22 }}
              />
            </div>
          </Field>
          <Field label="Compare-at Price (₹)" hint="Leave blank if not on sale">
            <div className="relative">
              <span style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)", color: "var(--a-text-3)", fontSize: 13, pointerEvents: "none" }}>₹</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={variant.comparePricePaise != null ? (variant.comparePricePaise / 100).toFixed(2) : ""}
                onChange={e => {
                  const v = e.target.value;
                  update({ comparePricePaise: v ? Math.round(parseFloat(v) * 100) : null });
                }}
                placeholder="0.00"
                className="a-form-input"
                style={{ paddingLeft: 22 }}
              />
            </div>
          </Field>

          {/* Inventory row */}
          <Field label="Stock Quantity">
            <input
              type="number"
              min="0"
              value={variant.stockQuantity}
              onChange={e => update({ stockQuantity: parseInt(e.target.value || "0") })}
              className="a-form-input"
            />
          </Field>
          <Field label="Low Stock Threshold" hint="Shows 'Low stock' label to customers">
            <input
              type="number"
              min="0"
              value={variant.lowStockThreshold}
              onChange={e => update({ lowStockThreshold: parseInt(e.target.value || "5") })}
              className="a-form-input"
            />
          </Field>
        </div>
      )}
    </div>
  );
}

function Field({ label, children, hint, required }: { label: string; children: React.ReactNode; hint?: string; required?: boolean }) {
  return (
    <div className="a-form-field">
      <label className="a-form-label">{label}{required && <span style={{ color: "var(--a-danger)", marginLeft: 2 }}>*</span>}</label>
      {children}
      {hint && <p className="a-form-hint">{hint}</p>}
    </div>
  );
}

interface Props {
  variants: VariantDraft[];
  onChange: (variants: VariantDraft[]) => void;
}

export function VariantEditor({ variants, onChange }: Props) {
  function addVariant() {
    onChange([...variants, emptyVariant(variants.length)]);
  }

  function updateVariant(i: number, v: VariantDraft) {
    const next = [...variants];
    next[i] = v;
    onChange(next);
  }

  function deleteVariant(i: number) {
    const wasDefault = variants[i]?.isDefault;
    const next = variants.filter((_, idx) => idx !== i);
    if (wasDefault && next.length > 0 && !next.some(v => v.isDefault)) {
      next[0] = { ...next[0], isDefault: true };
    }
    onChange(next);
  }

  function setDefault(i: number) {
    onChange(variants.map((v, idx) => ({ ...v, isDefault: idx === i })));
  }

  return (
    <div className="space-y-3">
      {variants.map((v, i) => (
        <VariantRow
          key={v.tempId}
          variant={v}
          index={i}
          onChange={upd => updateVariant(i, upd)}
          onDelete={() => deleteVariant(i)}
          onSetDefault={() => setDefault(i)}
          canDelete={variants.length > 1}
        />
      ))}
      <button
        type="button"
        onClick={addVariant}
        style={{
          width: "100%", display: "flex", alignItems: "center", justifyContent: "center",
          gap: 6, padding: "10px", borderRadius: "var(--a-radius)", border: "1.5px dashed var(--a-border)",
          background: "none", fontSize: 13, fontWeight: 500, color: "var(--a-text-3)",
          cursor: "pointer", transition: "border-color 0.1s, color 0.1s",
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--a-primary)"; (e.currentTarget as HTMLButtonElement).style.color = "var(--a-primary)"; }}
        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--a-border)"; (e.currentTarget as HTMLButtonElement).style.color = "var(--a-text-3)"; }}
      >
        <Plus style={{ width: 14, height: 14 }} />
        Add Variant
      </button>
    </div>
  );
}

export { emptyVariant };
