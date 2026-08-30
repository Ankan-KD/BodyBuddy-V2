"use client";

import { useParams } from "next/navigation";
import { useState, useEffect } from "react";
import { Star, Truck, Shield, ChevronLeft, Package, Info, Sparkles } from "lucide-react";
import Link from "next/link";
import { useProductBySlug } from "@/lib/useStoreData";
import { useAuth } from "@/lib/auth";
import { trackRecentlyViewed } from "@/lib/recentlyViewed";
import {
  formatPriceINR,
  discountPercent,
  defaultVariant,
  stockLabel,
  StoreProductVariant,
} from "@/lib/storeTypes";
import { AddToCartButton, WishlistHeartButton } from "@/components/store/ProductCard";
import { usePersonalization } from "@/lib/usePersonalization";
import { cn } from "@/lib/utils";

function NutritionRow({ label, value, unit }: { label: string; value: number | null; unit: string }) {
  if (value == null) return null;
  return (
    <div className="flex justify-between text-sm py-2 border-b border-[var(--border)] last:border-0">
      <span className="text-[var(--text-muted)]">{label}</span>
      <span className="font-medium">{value}{unit}</span>
    </div>
  );
}

export default function ProductDetailPage() {
  const params = useParams();
  const slug = params.id as string;
  const { data: product, loading } = useProductBySlug(slug);
  const { user } = useAuth();

  const [selectedVariant, setSelectedVariant] = useState<StoreProductVariant | null>(null);
  const personalization = usePersonalization();

  // Record this view for the "Recently Viewed" rail on Store Home.
  useEffect(() => {
    if (product) trackRecentlyViewed(user?.id, product.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product?.id, user?.id]);

  const variants = product?.variants ?? [];
  const activeVariant = selectedVariant ?? (product ? defaultVariant(variants) : null);
  const price = activeVariant?.pricePaise ?? null;
  const comparePrice = activeVariant?.comparePricePaise ?? null;
  const discount = price && comparePrice ? discountPercent(price, comparePrice) : 0;
  const stock = activeVariant ? stockLabel(activeVariant) : null;
  const primaryImage = activeVariant?.images?.[0] ?? product?.images?.[0] ?? null;

  if (loading) {
    return (
      <div className="animate-pulse px-4 pt-4 space-y-4">
        <div className="h-56 rounded-2xl bg-[var(--border)]" />
        <div className="h-5 w-3/4 rounded bg-[var(--border)]" />
        <div className="h-4 w-1/2 rounded bg-[var(--border)]" />
        <div className="h-8 w-1/3 rounded bg-[var(--border)]" />
        <div className="h-14 rounded-2xl bg-[var(--border)]" />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="px-4 pt-4 text-center py-16">
        <Package className="w-10 h-10 text-[var(--text-muted)] mx-auto mb-3 opacity-30" />
        <p className="text-sm text-[var(--text-muted)]">Product not found.</p>
        <Link href="/store/products" className="text-sm text-amber-500 mt-2 inline-block">
          Back to products
        </Link>
      </div>
    );
  }

  const n = product.nutrition;

  return (
    <div>
      {/* Back */}
      <div className="px-4 pt-4 pb-2">
        <Link href="/store/products" className="inline-flex items-center gap-1 text-sm text-[var(--text-muted)]">
          <ChevronLeft className="w-4 h-4" /> Back
        </Link>
      </div>

      {/* Image */}
      <div className="mx-4 h-56 bg-gradient-to-br from-amber-500/10 to-nova-500/10 rounded-2xl border border-[var(--border)] flex items-center justify-center mb-4 overflow-hidden relative">
        {primaryImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={primaryImage} alt={product.name} className="w-full h-full object-cover" />
        ) : (
          <Package className="w-16 h-16 text-amber-500/30" />
        )}
        {discount > 0 && (
          <span className="absolute top-3 right-3 text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-300">
            -{discount}%
          </span>
        )}
        <div className="absolute top-3 left-3">
          {product && <WishlistHeartButton product={product} size="lg" />}
        </div>
      </div>

      <div className="px-4 space-y-4">
        {/* Brand + Name + Rating */}
        <div>
          {product.brand && (
            <p className="text-xs text-[var(--text-muted)] mb-0.5">{product.brand.name}</p>
          )}
          <h1 className="font-display text-xl font-semibold">{product.name}</h1>
          {product.shortDescription && (
            <p className="text-sm text-[var(--text-muted)] mt-1">{product.shortDescription}</p>
          )}
          {/* Category / Type breadcrumb — connects back into storefront browsing */}
          {(product.category || product.productType) && (
            <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
              {product.category && (
                <Link
                  href={`/store/categories/${product.category.slug}`}
                  className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-300"
                >
                  {product.category.name}
                </Link>
              )}
              {product.productType && (
                <span className="text-[11px] font-medium px-2 py-0.5 rounded-full glass-panel border border-[var(--border)] text-[var(--text-muted)]">
                  {product.productType}
                </span>
              )}
            </div>
          )}
          {product.ratingCount > 0 && (
            <div className="flex items-center gap-1.5 mt-2">
              <div className="flex">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Star
                    key={i}
                    className={cn(
                      "w-3.5 h-3.5",
                      i <= Math.round(product.ratingAverage)
                        ? "text-amber-400 fill-amber-400"
                        : "text-[var(--text-muted)]"
                    )}
                  />
                ))}
              </div>
              <span className="text-xs text-[var(--text-muted)]">
                {product.ratingAverage.toFixed(1)} ({product.ratingCount.toLocaleString()} reviews)
              </span>
            </div>
          )}
        </div>

        {/* Price */}
        {price && (
          <div className="flex items-baseline gap-2">
            <span className="font-display text-2xl font-bold">{formatPriceINR(price)}</span>
            {comparePrice && comparePrice > price && (
              <span className="text-sm text-[var(--text-muted)] line-through">
                {formatPriceINR(comparePrice)}
              </span>
            )}
            {discount > 0 && (
              <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                {discount}% off
              </span>
            )}
          </div>
        )}

        {stock && (
          <p className="text-sm font-medium text-orange-500 dark:text-orange-400">{stock}</p>
        )}

        {/* Variant picker */}
        {variants.length > 1 && (
          <div>
            <p className="text-sm font-semibold mb-2">Options</p>
            <div className="flex flex-wrap gap-2">
              {variants.map((v) => (
                <button
                  key={v.id}
                  onClick={() => setSelectedVariant(v)}
                  className={cn(
                    "text-xs font-medium px-3 py-1.5 rounded-xl border transition-colors",
                    activeVariant?.id === v.id
                      ? "bg-amber-500/15 border-amber-500/40 text-amber-600 dark:text-amber-300"
                      : "glass-panel border-[var(--border)] text-[var(--text-muted)]"
                  )}
                >
                  {v.sizeLabel || v.flavour || v.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Trust badges */}
        <div className="flex gap-4">
          <div className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
            <Truck className="w-3.5 h-3.5 text-amber-500" /> Free delivery
          </div>
          <div className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
            <Shield className="w-3.5 h-3.5 text-amber-500" /> Authentic
          </div>
        </div>

        {/* Phase 10: Personalised fit badge */}
        {personalization.hasHealthData && product.healthGoalTags.includes(personalization.goalTag) && (
          <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20">
            <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" />
            <p className="text-xs text-amber-600 dark:text-amber-300 font-medium">
              Matches your {personalization.goalLabel} goal from BB Health
            </p>
          </div>
        )}

        {/* Phase 10: Protein context for user's target */}
        {personalization.hasHealthData && personalization.proteinGoalG > 0 &&
          n.proteinPerServing != null && n.proteinPerServing >= personalization.highProteinThresholdG && (
          <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-nova-500/10 border border-nova-500/20">
            <span className="text-sm">💪</span>
            <p className="text-xs text-nova-600 dark:text-nova-300 font-medium">
              {n.proteinPerServing}g protein per serving · your goal is {personalization.proteinGoalG}g/day
            </p>
          </div>
        )}

        {/* Nutrition info */}
        {(n.caloriesPerServing != null || n.proteinPerServing != null) && (
          <div className="glass-panel border border-[var(--border)] rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <Info className="w-4 h-4 text-amber-500" />
              <h3 className="font-semibold text-sm">Nutrition Facts</h3>
              {n.servingSizeLabel && (
                <span className="text-xs text-[var(--text-muted)] ml-auto">per {n.servingSizeLabel}</span>
              )}
            </div>
            <NutritionRow label="Calories"      value={n.caloriesPerServing} unit=" kcal" />
            <NutritionRow label="Protein"       value={n.proteinPerServing}  unit="g" />
            <NutritionRow label="Carbohydrates" value={n.carbsPerServing}    unit="g" />
            <NutritionRow label="Fat"           value={n.fatPerServing}      unit="g" />
            <NutritionRow label="Fibre"         value={n.fibrePerServing}    unit="g" />
            <NutritionRow label="Sugar"         value={n.sugarPerServing}    unit="g" />
            <NutritionRow label="Sodium"        value={n.sodiumPerServing}   unit="mg" />
          </div>
        )}

        {/* Description */}
        {product.fullDescription && (
          <div className="glass-panel border border-[var(--border)] rounded-2xl p-4">
            <h3 className="font-semibold text-sm mb-2">Description</h3>
            <p className="text-sm text-[var(--text-muted)] whitespace-pre-line">{product.fullDescription}</p>
          </div>
        )}

        {/* Usage */}
        {product.usageInfo && (
          <div className="glass-panel border border-[var(--border)] rounded-2xl p-4">
            <h3 className="font-semibold text-sm mb-2">How to Use</h3>
            <p className="text-sm text-[var(--text-muted)]">{product.usageInfo}</p>
          </div>
        )}

        {/* Ingredients */}
        {product.ingredients && (
          <div className="glass-panel border border-[var(--border)] rounded-2xl p-4">
            <h3 className="font-semibold text-sm mb-2">Ingredients</h3>
            <p className="text-sm text-[var(--text-muted)]">{product.ingredients}</p>
          </div>
        )}

        {/* Warnings */}
        {product.warnings && (
          <div className="glass-panel border border-amber-500/20 bg-amber-500/5 rounded-2xl p-4">
            <h3 className="font-semibold text-sm mb-2 text-amber-600 dark:text-amber-400">⚠ Warnings</h3>
            <p className="text-sm text-[var(--text-muted)]">{product.warnings}</p>
          </div>
        )}

        {/* Add to cart */}
        <AddToCartButton product={product} variant={activeVariant} />
      </div>

      <div className="h-6" />
    </div>
  );
}
