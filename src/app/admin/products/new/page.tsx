"use client";

// ── New Product page ──────────────────────────────────────────────────────
// When navigating here from the Product Catalog (/admin/catalog), the URL
// contains query params that prefill the form. This keeps the catalog and
// form cleanly separated — the form itself just accepts an optional
// `initialData` prop; it doesn't know where the data came from.

import { useSearchParams } from "next/navigation";
import { useMemo, Suspense } from "react";
import { ProductForm } from "@/components/admin/products/ProductForm";
import type { CatalogPrefill } from "@/lib/catalogTypes";

function NewProductInner() {
  const params = useSearchParams();

  const prefill = useMemo<CatalogPrefill | undefined>(() => {
    if (!params.get("from_catalog")) return undefined;

    function safe(key: string) { return params.get(key) ?? ""; }
    function safeJSON<T>(key: string, fallback: T): T {
      try { return JSON.parse(params.get(key) ?? "null") ?? fallback; }
      catch { return fallback; }
    }

    return {
      catalogId:         safe("catalog_id"),
      name:              safe("name"),
      brand:             safe("brand"),
      category:          safe("category"),
      slug:              safe("slug"),
      shortDescription:  safe("short_description"),
      fullDescription:   safe("full_description"),
      usageInfo:         safe("usage_info"),
      ingredients:       safe("ingredients"),
      warnings:          safe("warnings"),
      images:            safeJSON<string[]>("images", []),
      goalTags:          safeJSON<string[]>("goal_tags", []),  // broad segments → health_goal_tags in DB
      searchTags:        safeJSON<string[]>("search_tags", []),
      servingSizeLabel:  safe("serving_size_label"),
      servingSizeG:      safe("serving_size_g")    ? parseFloat(safe("serving_size_g"))    : null,
      calories:          safe("calories")          ? parseFloat(safe("calories"))          : null,
      proteinG:          safe("protein_g")         ? parseFloat(safe("protein_g"))         : null,
      carbohydratesG:    safe("carbohydrates_g")   ? parseFloat(safe("carbohydrates_g"))   : null,
      fatG:              safe("fat_g")             ? parseFloat(safe("fat_g"))             : null,
      fibreG:            safe("fibre_g")           ? parseFloat(safe("fibre_g"))           : null,
      sugarG:            safe("sugar_g")           ? parseFloat(safe("sugar_g"))           : null,
      sodiumMg:          safe("sodium_mg")         ? parseFloat(safe("sodium_mg"))         : null,
      variants:          safeJSON("variants", []),
      selectedVariantId: safe("selected_variant_id") || undefined,
    };
  }, [params]);

  return <ProductForm catalogPrefill={prefill} />;
}

export default function NewProductPage() {
  return (
    <Suspense fallback={<div className="a-loading">Loading…</div>}>
      <NewProductInner />
    </Suspense>
  );
}
