"use client";

// ════════════════════════════════════════════════════════════════════════
// BB Store — Phase 10 Personalized Goal Banner
// When the user is onboarded in BB Health, show a personalised hero
// that references their active goal instead of the generic launch banner.
// ════════════════════════════════════════════════════════════════════════

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { usePersonalization } from "@/lib/usePersonalization";
import { goalByKey } from "@/lib/goalShopping";

export function PersonalizedGoalBanner() {
  const ctx = usePersonalization();

  if (!ctx.hasHealthData) return null;

  const goal = goalByKey(ctx.goalTag);
  const Icon = goal?.icon;

  const firstName = ctx.userName?.split(" ")[0] || "";
  const greeting = firstName ? `Hi ${firstName}!` : "Your store,";
  const subLine = ctx.goalBlurb;

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border p-5 ${goal?.ring ?? "border-amber-500/20"}`}
      style={{
        background:
          "linear-gradient(135deg, color-mix(in srgb, var(--card-bg) 85%, transparent), color-mix(in srgb, var(--card-bg) 95%, transparent))",
      }}
    >
      {/* decorative blobs */}
      <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full bg-amber-400/10 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-8 -left-8 w-32 h-32 rounded-full bg-nova-500/10 blur-3xl pointer-events-none" />

      <div className="relative flex items-start gap-4">
        <div className="flex-1 min-w-0">
          <span
            className={`text-[11px] font-semibold px-2.5 py-1 rounded-full inline-block mb-2 ${goal?.bg ?? "bg-amber-500/20"} ${goal?.text ?? "text-amber-600 dark:text-amber-300"}`}
          >
            {ctx.goalLabel}
          </span>
          <h2 className="font-display text-2xl font-semibold mb-1 leading-tight">
            {greeting}
            <br />
            <span className={goal?.text ?? "text-amber-500 dark:text-amber-400"}>
              Let&apos;s reach your goal.
            </span>
          </h2>
          <p className="text-sm text-[var(--text-muted)] mb-4">{subLine}</p>
          <Link
            href={`/store/goals/${ctx.goalTag}`}
            className="inline-flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-xl bg-amber-500 text-white shadow-soft active:scale-95 transition-transform"
          >
            Shop for {ctx.goalLabel} <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
        {Icon && (
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${goal?.bg ?? "bg-amber-500/10"}`}>
            <Icon className={`w-6 h-6 ${goal?.text ?? "text-amber-500"}`} />
          </div>
        )}
      </div>
    </div>
  );
}
