"use client";

import {
  Dumbbell, Flame, Leaf, Pill, Zap, Apple, Heart, Droplets, Moon, Activity,
  Tag, ShoppingBag, Star, Coffee, Cookie, Milk, Wheat, Scale, Trophy, Sparkles,
  LucideIcon,
} from "lucide-react";

const ICON_MAP: Record<string, LucideIcon> = {
  Dumbbell, Flame, Leaf, Pill, Zap, Apple, Heart, Droplets, Moon, Activity,
  Tag, ShoppingBag, Star, Coffee, Cookie, Milk, Wheat, Scale, Trophy, Sparkles,
};

export function CategoryIcon({
  iconKey,
  className,
}: {
  iconKey: string;
  className?: string;
}) {
  const Icon = ICON_MAP[iconKey] ?? Tag;
  return <Icon className={className} />;
}
