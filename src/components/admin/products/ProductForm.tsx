"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Save,
  ArrowLeft,
  Loader2,
  AlertTriangle,
  Info,
  Tag,
  Dumbbell,
  Flame,
  Heart,
  Scale,
  Eye,
  EyeOff,
  Plus,
  X,
} from "lucide-react";
import {
  adminCreateProduct,
  adminUpdateProduct,
  adminCreateVariant,
  adminUpdateVariant,
  adminDeleteVariant,
  adminFetchAllCategories,
  adminFetchAllBrands,
  adminCreateBrand,
  generateSlug,
} from "@/lib/storeAdminApi";
import type { StoreProduct, StoreCategory, StoreBrand } from "@/lib/storeTypes";
import type { CatalogPrefill } from "@/lib/catalogTypes";
import { ImageUploader } from "./ImageUploader";
import { VariantEditor, VariantDraft, emptyVariant } from "./VariantEditor";

const HEALTH_GOAL_TAGS = [
  { key: "weight-gain",     label: "Weight Gain",      Icon: Scale  },
  { key: "weight-loss",     label: "Weight Loss",      Icon: Flame  },
  { key: "muscle-building", label: "Muscle Building",  Icon: Dumbbell },
  { key: "general-fitness", label: "General Fitness",  Icon: Heart  },
];

// ── Shared field wrapper ──────────────────────────────────────────────────

function Field({ label, children, hint, col = 1 }: { label: string; children: React.ReactNode; hint?: string; col?: 1 | 2 }) {
  return (
    <div className={`a-form-field ${col === 2 ? "sm:col-span-2" : ""}`}>
      <label className="a-form-label">{label}</label>
      {children}
      {hint && <p className="a-form-hint">{hint}</p>}
    </div>
  );
}

function SectionHeading({ title, icon: Icon }: { title: string; icon: React.ElementType }) {
  return (
    <div className="a-section-heading">
      <div className="a-section-heading-icon">
        <Icon style={{ width: 13, height: 13 }} />
      </div>
      <span className="a-section-heading-text">{title}</span>
    </div>
  );
}

// ── Main form ─────────────────────────────────────────────────────────────

interface Props {
  product?: StoreProduct;         // undefined = create mode
  catalogPrefill?: CatalogPrefill; // prefill from catalog → form bridge
}

export function ProductForm({ product, catalogPrefill }: Props) {
  const router = useRouter();
  const isEdit = !!product;

  // When coming from the catalog, use prefill values as defaults
  const pre = catalogPrefill;

  // Core fields
  const [name, setName] = useState(product?.name ?? pre?.name ?? "");
  const [slug, setSlug] = useState(product?.slug ?? pre?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(isEdit || !!pre?.slug);
  const [brandId, setBrandId] = useState(product?.brandId ?? "");
  const [categoryId, setCategoryId] = useState(product?.categoryId ?? "");
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
  const [published, setPublished] = useState(product?.published ?? false);
  const [availability, setAvailability] = useState<"active" | "inactive" | "out_of_stock" | "discontinued">(product?.availability ?? "active");
  const [sortOrder, setSortOrder] = useState(product?.sortOrder ?? 0);
  // Traceability: remember which catalog entry this product was imported from
  const [catalogSourceId] = useState(pre?.catalogId ?? "");

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

  // Variants — build from catalog prefill when creating from catalog
  const [variants, setVariants] = useState<VariantDraft[]>(() => {
    if (product?.variants?.length) {
      return product.variants.map((v, i) => ({
        id: v.id,
        tempId: v.id,
        sku: v.sku,
        name: v.name,
        sizeLabel: v.sizeLabel,
        flavour: v.flavour,
        color: v.color,
        pricePaise: v.pricePaise,
        comparePricePaise: v.comparePricePaise,
        stockQuantity: v.stockQuantity,
        lowStockThreshold: v.lowStockThreshold,
        availability: v.availability,
        isDefault: v.isDefault,
        sortOrder: v.sortOrder ?? i,
      }));
    }
    if (pre?.variants?.length) {
      return pre.variants.map((cv, i) => ({
        id: undefined,
        tempId: `temp-${i}`,
        sku: cv.sku,
        name: cv.variantName || `${cv.sizeWeight}${cv.flavour ? ` – ${cv.flavour}` : ""}`,
        sizeLabel: cv.sizeWeight,
        flavour: cv.flavour,
        color: cv.colour,
        // Catalog suggests price in INR; store works in paise
        pricePaise: cv.suggestedPriceINR != null ? Math.round(cv.suggestedPriceINR * 100) : 0,
        comparePricePaise: cv.compareAtPriceINR != null ? Math.round(cv.compareAtPriceINR * 100) : null,
        stockQuantity: cv.stockQuantity,
        lowStockThreshold: cv.lowStockThreshold,
        availability: "active" as const,
        isDefault: cv.isDefaultVariant || i === 0,
        sortOrder: i,
      }));
    }
    return [emptyVariant(0)];
  });

  // Meta
  const [categories, setCategories] = useState<StoreCategory[]>([]);
  const [brands, setBrands] = useState<StoreBrand[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [newBrandName, setNewBrandName] = useState("");
  const [showNewBrand, setShowNewBrand] = useState(false);

  useEffect(() => {
    adminFetchAllCategories().then(setCategories);
    adminFetchAllBrands().then(setBrands);
  }, []);

  // Auto-generate slug from name
  useEffect(() => {
    if (!slugTouched && name) {
      setSlug(generateSlug(name));
    }
  }, [name, slugTouched]);

  function toggleGoalTag(key: string) {
    setHealthGoalTags(prev =>
      prev.includes(key) ? prev.filter(t => t !== key) : [...prev, key]
    );
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
    if (brand) {
      setBrands(prev => [...prev, brand]);
      setBrandId(brand.id);
    }
    setNewBrandName("");
    setShowNewBrand(false);
  }

  function buildPayload() {
    return {
      name: name.trim(),
      slug: slug.trim() || generateSlug(name.trim()),
      brand_id: brandId || null,
      category_id: categoryId || null,
      short_description: shortDescription.trim(),
      full_description: fullDescription.trim(),
      usage_info: usageInfo.trim(),
      ingredients: ingredients.trim(),
      warnings: warnings.trim(),
      images,
      tags,
      health_goal_tags: healthGoalTags,
      serving_size_label: servingSizeLabel.trim(),
      serving_size_g: servingSizeG ? parseFloat(servingSizeG) : null,
      calories_per_serving: calories ? parseFloat(calories) : null,
      protein_per_serving: protein ? parseFloat(protein) : null,
      carbs_per_serving: carbs ? parseFloat(carbs) : null,
      fat_per_serving: fat ? parseFloat(fat) : null,
      fibre_per_serving: fibre ? parseFloat(fibre) : null,
      sodium_per_serving: sodium ? parseFloat(sodium) : null,
      sugar_per_serving: sugar ? parseFloat(sugar) : null,
      published,
      availability,
      is_featured: isFeatured,
      sort_order: sortOrder,
    };
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError("Product name is required"); return; }
    if (variants.some(v => !v.sku.trim())) { setError("All variants must have a SKU"); return; }
    if (variants.some(v => v.pricePaise <= 0)) { setError("All variants must have a price greater than 0"); return; }

    setSaving(true);
    setError(null);

    let productId: string;

    if (isEdit && product) {
      const { product: updated, error: err } = await adminUpdateProduct(product.id, buildPayload());
      if (err || !updated) { setError(err ?? "Failed to update product"); setSaving(false); return; }
      productId = updated.id;
    } else {
      const { product: created, error: err } = await adminCreateProduct(buildPayload() as Parameters<typeof adminCreateProduct>[0]);
      if (err || !created) { setError(err ?? "Failed to create product"); setSaving(false); return; }
      productId = created.id;
    }

    // Sync variants
    const existingIds = product?.variants?.map(v => v.id) ?? [];
    const incomingIds = variants.filter(v => v.id).map(v => v.id as string);

    // Delete removed variants
    const toDelete = existingIds.filter(id => !incomingIds.includes(id));
    await Promise.all(toDelete.map(id => adminDeleteVariant(id)));

    // Create/update variants
    for (let i = 0; i < variants.length; i++) {
      const v = variants[i];
      const payload = {
        product_id: productId,
        sku: v.sku.trim(),
        name: v.name.trim(),
        size_label: v.sizeLabel.trim(),
        flavour: v.flavour.trim(),
        color: v.color.trim(),
        price_paise: v.pricePaise,
        compare_price_paise: v.comparePricePaise,
        stock_quantity: v.stockQuantity,
        low_stock_threshold: v.lowStockThreshold,
        images: [],
        availability: v.availability,
        is_default: v.isDefault,
        sort_order: i,
      };

      if (v.id) {
        await adminUpdateVariant(v.id, payload);
      } else {
        const { error: ve } = await adminCreateVariant(payload);
        if (ve) { setError(`Variant error: ${ve}`); setSaving(false); return; }
      }
    }

    setSaving(false);
    setSuccess(true);
    setTimeout(() => {
      router.push("/admin/products");
    }, 800);
  }

  const topCategories = categories.filter(c => !c.parentId);
  const subCategories = categories.filter(c => c.parentId);

  return (
    <form onSubmit={handleSubmit} style={{ maxWidth: 900, paddingBottom: 80 }}>

      {/* Catalog prefill banner */}
      {catalogPrefill && (
        <div className="a-alert a-alert-info" style={{ marginBottom: 16 }}>
          <Info style={{ width: 14, height: 14, flexShrink: 0, marginTop: 1 }} />
          <div style={{ fontSize: 13 }}>
            <strong>Prefilled from catalog</strong>
            {" "}({catalogPrefill.catalogId}) — review and adjust before saving. Price, stock, and publishing only exist in your store once saved.
          </div>
        </div>
      )}

      {/* Header */}
      <div className="a-page-header">
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button
            type="button"
            onClick={() => router.push("/admin/products")}
            className="a-btn a-btn-secondary a-btn-icon"
            aria-label="Back to products"
          >
            <ArrowLeft style={{ width: 14, height: 14 }} />
          </button>
          <div>
            <h2 className="a-page-title">{isEdit ? "Edit Product" : "Add Product"}</h2>
            {isEdit && <p className="a-page-subtitle">{product?.name}</p>}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button
            type="button"
            onClick={() => setPublished(p => !p)}
            className={`a-btn ${published ? "a-btn-secondary" : "a-btn-ghost"}`}
            style={published ? { color: "var(--a-success)", borderColor: "var(--a-success-border)" } : {}}
          >
            {published ? <Eye style={{ width: 14, height: 14 }} /> : <EyeOff style={{ width: 14, height: 14 }} />}
            {published ? "Published" : "Draft"}
          </button>
          <button
            type="submit"
            disabled={saving || success}
            className="a-btn a-btn-primary"
          >
            {saving ? <Loader2 style={{ width: 13, height: 13 }} className="animate-spin" /> : <Save style={{ width: 13, height: 13 }} />}
            {saving ? "Saving…" : success ? "Saved!" : "Save Product"}
          </button>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="a-alert a-alert-error" style={{ marginBottom: 16 }}>
          <AlertTriangle style={{ width: 14, height: 14, flexShrink: 0, marginTop: 1 }} />
          <p>{error}</p>
        </div>
      )}

      {/* ── BASIC INFO ─────────────────────────────────────────────────── */}
      <div className="a-card" style={{ overflow: "hidden", marginBottom: 14 }}>
        <div style={{ background: "var(--a-surface-2)", borderBottom: "1px solid var(--a-border)", padding: "10px 18px" }}><SectionHeading title="Basic Information" icon={Info} /></div>
        <div style={{ padding: "16px 18px" }}>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Field label="Product Name *" col={2}>
            <input
              required
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Whey Protein Isolate"
              className="a-form-input w-full"
            />
          </Field>

          <Field label="URL Slug" hint="Auto-generated from name — edit if needed">
            <input
              type="text"
              value={slug}
              onChange={e => { setSlug(e.target.value); setSlugTouched(true); }}
              placeholder="whey-protein-isolate"
              className="a-form-input w-full font-mono text-sm"
            />
          </Field>

          <Field label="Availability">
            <select
              value={availability}
              onChange={e => setAvailability(e.target.value as "active" | "inactive" | "out_of_stock" | "discontinued")}
              className="a-form-input w-full"
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="out_of_stock">Out of Stock</option>
              <option value="discontinued">Discontinued</option>
            </select>
          </Field>

          {/* Brand */}
          <Field label="Brand">
            {showNewBrand ? (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newBrandName}
                  onChange={e => setNewBrandName(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && (e.preventDefault(), handleCreateBrand())}
                  placeholder="New brand name"
                  className="a-form-input flex-1"
                  autoFocus
                />
                <button type="button" onClick={handleCreateBrand} className="a-btn a-btn-primary">Add</button>
                <button type="button" onClick={() => setShowNewBrand(false)} className="a-btn a-btn-ghost">Cancel</button>
              </div>
            ) : (
              <div className="flex gap-2">
                <select value={brandId} onChange={e => setBrandId(e.target.value)} className="a-form-input flex-1">
                  <option value="">No brand</option>
                  {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
                <button type="button" onClick={() => setShowNewBrand(true)} className="a-btn a-btn-secondary a-btn-icon" title="Add new brand">
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            )}
          </Field>

          {/* Category */}
          <Field label="Category">
            <select value={categoryId} onChange={e => setCategoryId(e.target.value)} className="a-form-input w-full">
              <option value="">No category</option>
              <optgroup label="Top-level">
                {topCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </optgroup>
              {subCategories.length > 0 && (
                <optgroup label="Subcategories">
                  {subCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </optgroup>
              )}
            </select>
          </Field>

          <Field label="Sort Order" hint="Lower = shown first">
            <input
              type="number"
              min="0"
              value={sortOrder}
              onChange={e => setSortOrder(parseInt(e.target.value || "0"))}
              className="a-form-input w-full"
            />
          </Field>

          <Field label="Short Description" col={2}>
            <textarea
              value={shortDescription}
              onChange={e => setShortDescription(e.target.value)}
              rows={2}
              placeholder="One-line product summary shown in cards and search results"
              className="a-form-input w-full resize-none"
            />
          </Field>

          <Field label="Full Description" col={2} hint="Markdown supported">
            <textarea
              value={fullDescription}
              onChange={e => setFullDescription(e.target.value)}
              rows={6}
              placeholder="Detailed product description. **Bold**, *italic*, bullet lists supported."
              className="a-form-input w-full resize-y font-mono text-sm"
            />
          </Field>
        </div>

        {/* Featured toggle */}
        <label className="flex items-center gap-3 cursor-pointer select-none group">
          <div
            onClick={() => setIsFeatured(f => !f)}
            style={{ height: "22px", width: 40, borderRadius: 11, background: isFeatured ? "var(--a-primary)" : "var(--a-border)", position: "relative", flexShrink: 0, transition: "background 0.15s", cursor: "pointer" }}
          >
            <span style={{ position: "absolute", top: 2, left: isFeatured ? 20 : 2, width: 18, height: 18, background: "white", borderRadius: "50%", boxShadow: "0 1px 3px rgba(0,0,0,0.15)", transition: "left 0.15s" }} />
          </div>
          <span className="text-sm font-medium">Featured product</span>
          <span style={{ fontSize: 11, color: "var(--a-text-3)" }}>(shown in featured sections on the store homepage)</span>
        </label>
        </div>
      </div>

      {/* ── IMAGES ─────────────────────────────────────────────────────── */}
      <div className="a-card" style={{ overflow: "hidden", marginBottom: 14 }}>
        <div style={{ background: "var(--a-surface-2)", borderBottom: "1px solid var(--a-border)", padding: "10px 18px" }}><SectionHeading title="Product Images" icon={Info} /></div>
        <ImageUploader images={images} onChange={setImages} productSlug={slug || "product"} />
      </div>

      {/* ── HEALTH GOAL TAGS ─────────────────────────────────────────── */}
      <div className="a-card" style={{ overflow: "hidden", marginBottom: 14 }}>
        <div style={{ background: "var(--a-surface-2)", borderBottom: "1px solid var(--a-border)", padding: "10px 18px" }}><SectionHeading title="Goal Tags" icon={Dumbbell} /></div>
        <div style={{ padding: "16px 18px" }}>
        <p style={{ fontSize: 12, color: "var(--a-text-3)", marginBottom: 10 }}>Tag this product with relevant health goals for goal-based store sections</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
          {HEALTH_GOAL_TAGS.map(({ key, label, Icon }) => {
            const active = healthGoalTags.includes(key);
            return (
              <button
                key={key}
                type="button"
                onClick={() => toggleGoalTag(key)}
                className={`a-btn ${active ? "a-btn-primary" : "a-btn-secondary"}`}
              style={{ flexDirection: "column", height: "auto", padding: "12px 8px", gap: 6 }}
              >
                <Icon style={{ width: 16, height: 16 }} />
                {label}
              </button>
            );
          })}
        </div>

        {/* General tags */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8, paddingTop: 12, marginTop: 12, borderTop: "1px solid var(--a-border)" }}>
          <label className="a-form-label">Search Tags</label>
          <div className="flex flex-wrap gap-2">
            {tags.map(t => (
              <span key={t} className="a-tag">
                {t}
                <button type="button" onClick={() => setTags(prev => prev.filter(x => x !== t))} className="a-tag-remove">
                  <X style={{ width: 10, height: 10 }} />
                </button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={tagInput}
              onChange={e => setTagInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addTag(); } if (e.key === ",") { e.preventDefault(); addTag(); } }}
              placeholder="keto, vegan, bestseller…"
              className="a-form-input flex-1 text-sm"
            />
            <button type="button" onClick={addTag} className="a-btn a-btn-secondary">
              Add
            </button>
          </div>
          <p className="a-form-hint">Separate with Enter or comma</p>
        </div>
        </div>
      </div>

      {/* ── NUTRITION / HEALTH FIELDS ─────────────────────────────────── */}
      <div className="a-card" style={{ overflow: "hidden", marginBottom: 14 }}>
        <div style={{ background: "var(--a-surface-2)", borderBottom: "1px solid var(--a-border)", padding: "10px 18px" }}><SectionHeading title="Nutrition Information (per serving)" icon={Heart} /></div>
        <div style={{ padding: "16px 18px" }}>
        <p style={{ fontSize: 12, color: "var(--a-text-3)", marginBottom: 10 }}>Fill in for supplements and health food products. Leave blank for non-food items.</p>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Field label="Serving Size Label" hint='e.g. "1 scoop (30g)"'>
            <input type="text" value={servingSizeLabel} onChange={e => setServingSizeLabel(e.target.value)} placeholder="1 scoop (30g)" className="a-form-input w-full" />
          </Field>
          <Field label="Serving Size (g)" hint="Grams per serving">
            <input type="number" min="0" step="0.1" value={servingSizeG} onChange={e => setServingSizeG(e.target.value)} placeholder="30" className="a-form-input w-full" />
          </Field>
          <Field label="Calories">
            <input type="number" min="0" step="0.1" value={calories} onChange={e => setCalories(e.target.value)} placeholder="120" className="a-form-input w-full" />
          </Field>
          <Field label="Protein (g)">
            <input type="number" min="0" step="0.1" value={protein} onChange={e => setProtein(e.target.value)} placeholder="25" className="a-form-input w-full" />
          </Field>
          <Field label="Carbohydrates (g)">
            <input type="number" min="0" step="0.1" value={carbs} onChange={e => setCarbs(e.target.value)} placeholder="5" className="a-form-input w-full" />
          </Field>
          <Field label="Fat (g)">
            <input type="number" min="0" step="0.1" value={fat} onChange={e => setFat(e.target.value)} placeholder="2" className="a-form-input w-full" />
          </Field>
          <Field label="Fibre (g)">
            <input type="number" min="0" step="0.1" value={fibre} onChange={e => setFibre(e.target.value)} placeholder="1" className="a-form-input w-full" />
          </Field>
          <Field label="Sugar (g)">
            <input type="number" min="0" step="0.1" value={sugar} onChange={e => setSugar(e.target.value)} placeholder="2" className="a-form-input w-full" />
          </Field>
          <Field label="Sodium (mg)" col={2}>
            <input type="number" min="0" step="0.1" value={sodium} onChange={e => setSodium(e.target.value)} placeholder="50" className="a-form-input w-full sm:w-1/2" />
          </Field>
        </div>
        </div>
      </div>

      {/* ── USAGE, INGREDIENTS, WARNINGS ─────────────────────────────── */}
      <div className="a-card" style={{ overflow: "hidden", marginBottom: 14 }}>
        <div style={{ background: "var(--a-surface-2)", borderBottom: "1px solid var(--a-border)", padding: "10px 18px" }}><SectionHeading title="Usage & Ingredients" icon={Tag} /></div>
        <div style={{ padding: "16px 18px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 12 }}>
          <Field label="Usage Information" hint="How to use this product — shown on the product page">
            <textarea
              value={usageInfo}
              onChange={e => setUsageInfo(e.target.value)}
              rows={3}
              placeholder="e.g. Mix 1 scoop with 200ml water or milk. Take 30 minutes post-workout."
              className="a-form-input w-full resize-y"
            />
          </Field>
          <Field label="Ingredients">
            <textarea
              value={ingredients}
              onChange={e => setIngredients(e.target.value)}
              rows={4}
              placeholder="Full ingredient list"
              className="a-form-input w-full resize-y font-mono text-sm"
            />
          </Field>
          <Field label="Warnings / Allergens">
            <textarea
              value={warnings}
              onChange={e => setWarnings(e.target.value)}
              rows={3}
              placeholder="e.g. Contains milk. Not suitable for individuals with lactose intolerance."
              className="a-form-input w-full resize-y"
            />
          </Field>
        </div>
        </div>
      </div>

      {/* ── VARIANTS ─────────────────────────────────────────────────── */}
      <div className="a-card" style={{ overflow: "hidden", marginBottom: 14 }}>
        <div style={{ background: "var(--a-surface-2)", borderBottom: "1px solid var(--a-border)", padding: "10px 18px" }}><SectionHeading title="Variants & Pricing" icon={Tag} /></div>
        <p style={{ fontSize: 12, color: "var(--a-text-3)", marginBottom: 10 }}>
          Each product needs at least one variant. Variants hold size, flavour, price, SKU, and stock quantity.
          The starred variant is shown first on the product page.
        </p>
        <VariantEditor variants={variants} onChange={setVariants} />
      </div>

      <div className="a-form-actions">
        <span style={{ fontSize: 12, color: "var(--a-text-3)" }}>
          {success ? "✓ Saved — redirecting…" : isEdit ? "Editing product" : "New product"}
        </span>
        <button type="button" onClick={() => router.push("/admin/products")} className="a-btn a-btn-secondary">
          Cancel
        </button>
        <button type="submit" disabled={saving || success} className="a-btn a-btn-primary">
          {saving ? <Loader2 style={{ width: 13, height: 13 }} className="animate-spin" /> : <Save style={{ width: 13, height: 13 }} />}
          {saving ? "Saving…" : success ? "Saved!" : "Save Product"}
        </button>
      </div>
    </form>
  );
}
