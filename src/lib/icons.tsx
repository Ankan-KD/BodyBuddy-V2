"use client";

/**
 * React-facing icon helpers. The underlying key lists live in iconKeys.ts
 * (plain data, safe to import from server code too) — this file just adds
 * the lucide-react lookup + rendering on top.
 *
 * We import only the icons actually used in this app (from iconKeys.ts +
 * any used directly in app code) rather than `import * as LucideIcons`
 * which would pull in all 1500+ icons and break tree-shaking.
 *
 * If a new icon key is needed: add it to FOOD_ICON_OPTIONS in iconKeys.ts
 * AND add a named import + entry in ICON_MAP below.
 */

import type { LucideProps } from "lucide-react";
import type { ComponentType } from "react";

// ── Named imports — ONLY what's actually used ────────────────────────────
import {
  Egg, Milk, Beef, Drumstick, Fish, Wheat, Croissant, Sandwich,
  Pizza, Soup, Salad, Carrot, Apple, Banana, Cherry, Grape,
  Popcorn, Cookie, CakeSlice, Candy, Coffee, CupSoda, GlassWater,
  Nut, Utensils, Tag,
} from "lucide-react";

import { FALLBACK_ICON_KEY, CATEGORY_ICON_KEYS } from "./iconKeys";
import { getCategoryStyle } from "./categoryStyles";
import { cn } from "./utils";
import type { FoodCategory } from "./types";

export { FOOD_ICON_OPTIONS, CATEGORY_ICON_KEYS, ALL_ICON_KEYS } from "./iconKeys";
export { getCategoryStyle } from "./categoryStyles";

// ── Icon lookup map ───────────────────────────────────────────────────────
const ICON_MAP: Record<string, ComponentType<LucideProps>> = {
  Egg, Milk, Beef, Drumstick, Fish, Wheat, Croissant, Sandwich,
  Pizza, Soup, Salad, Carrot, Apple, Banana, Cherry, Grape,
  Popcorn, Cookie, CakeSlice, Candy, Coffee, CupSoda, GlassWater,
  Nut, Utensils, Tag,
};

export function isKnownIcon(key: string | undefined | null): boolean {
  return !!key && !!ICON_MAP[key];
}

/** Resolve an icon key to a renderable component, always falling back safely. */
export function resolveIcon(key: string | undefined | null): ComponentType<LucideProps> {
  if (key && ICON_MAP[key]) return ICON_MAP[key];
  return ICON_MAP[FALLBACK_ICON_KEY];
}

/**
 * Icon resolution priority used everywhere a food is displayed:
 *   1. the food's own icon key, if it's a real, known icon
 *   2. its category's icon key, if the category is known
 *   3. the generic fallback icon
 */
export function resolveFoodIconKey(
  iconKey: string | undefined | null,
  category?: FoodCategory | string | null
): string {
  if (iconKey && ICON_MAP[iconKey]) return iconKey;
  const categoryIcon = category ? CATEGORY_ICON_KEYS[category as FoodCategory] : undefined;
  if (categoryIcon && ICON_MAP[categoryIcon]) return categoryIcon;
  return FALLBACK_ICON_KEY;
}

/** Renders a food/category icon by key. */
export function AppIcon({
  name,
  className,
  ...props
}: { name: string | undefined | null } & LucideProps) {
  const Comp = resolveIcon(name);
  return <Comp className={className} {...props} />;
}

const BADGE_SIZE: Record<"sm" | "md" | "lg" | "xl", string> = {
  sm: "h-8 w-8 rounded-lg",
  md: "h-9 w-9 rounded-xl",
  lg: "h-11 w-11 rounded-xl",
  xl: "h-[50px] w-[50px] rounded-2xl",
};

const GLYPH_SIZE: Record<"sm" | "md" | "lg" | "xl", string> = {
  sm: "w-6 h-6",
  md: "w-7 h-7",
  lg: "w-9 h-9",
  xl: "w-8 h-8",
};

export function FoodIcon({
  iconKey,
  category,
  size = "md",
  className,
  variant = "plain",
}: {
  iconKey?: string | null;
  category?: FoodCategory | string | null;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
  variant?: "badge" | "plain";
}) {
  const style = getCategoryStyle(category);
  const Icon = ICON_MAP[resolveFoodIconKey(iconKey, category)] ?? ICON_MAP[FALLBACK_ICON_KEY];

  if (variant === "plain") {
    return (
      <span className={cn("inline-flex shrink-0 items-center justify-center", BADGE_SIZE[size], className)}>
        <Icon className={cn(GLYPH_SIZE[size], style.iconColor)} fill="currentColor" fillOpacity={0.25} strokeWidth={1.5} />
      </span>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center",
        BADGE_SIZE[size],
        style.badgeBg,
        className
      )}
    >
      <Icon
        className={cn(GLYPH_SIZE[size], style.iconColor)}
        fill="currentColor"
        fillOpacity={0.22}
        strokeWidth={1.75}
      />
    </span>
  );
}
