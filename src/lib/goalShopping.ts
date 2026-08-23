// ════════════════════════════════════════════════════════════════════════
// BB Store — Phase 5 Goal Shopping metadata
// Keys MUST match the health_goal_tags values set in BB Store Admin
// (see components/admin/products/ProductForm.tsx HEALTH_GOAL_TAGS).
// ════════════════════════════════════════════════════════════════════════

import { Scale, Flame, Dumbbell, Heart, LucideIcon } from "lucide-react";

export interface GoalMeta {
  key: string;
  /** Customer-facing label used across the Store (SRS "Shop By Goal" wording) */
  label: string;
  icon: LucideIcon;
  text: string;   // tailwind text color classes
  bg: string;     // tailwind bg color classes
  ring: string;   // tailwind border/ring color classes
  blurb: string;
}

export const GOAL_SHOPPING: GoalMeta[] = [
  {
    key: "weight-gain",
    label: "Gain Weight",
    icon: Scale,
    text: "text-amber-500 dark:text-amber-400",
    bg: "bg-amber-500/10",
    ring: "border-amber-500/30",
    blurb: "Calorie-dense picks to help you bulk up steadily.",
  },
  {
    key: "weight-loss",
    label: "Lose Weight",
    icon: Flame,
    text: "text-orange-500 dark:text-orange-400",
    bg: "bg-orange-500/10",
    ring: "border-orange-500/30",
    blurb: "Lower-calorie, high-satiety products to support a deficit.",
  },
  {
    key: "muscle-building",
    label: "Muscle Building",
    icon: Dumbbell,
    text: "text-nova-500 dark:text-nova-400",
    bg: "bg-nova-500/10",
    ring: "border-nova-500/30",
    blurb: "High-protein staples for training and recovery.",
  },
  {
    key: "general-fitness",
    label: "General Health",
    icon: Heart,
    text: "text-rose-500 dark:text-rose-400",
    bg: "bg-rose-500/10",
    ring: "border-rose-500/30",
    blurb: "Everyday wellness picks to round out your routine.",
  },
];

export function goalByKey(key: string | undefined | null): GoalMeta | null {
  if (!key) return null;
  return GOAL_SHOPPING.find((g) => g.key === key) ?? null;
}
