"use client";

// ════════════════════════════════════════════════════════════════════════
// BB Store — Active Offers Banner
// Fetches and displays all currently-valid, active offers so customers
// know what promo codes are available. Codes are tap-to-copy.
// ════════════════════════════════════════════════════════════════════════

import { useEffect, useState } from "react";
import { Tag, Copy, Check, ChevronDown, ChevronUp } from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { OfferRow, StoreOffer } from "@/lib/offerTypes";
import { offerFromRow, offerLabel, isOfferCurrentlyValid } from "@/lib/offerTypes";

async function fetchActiveOffers(): Promise<StoreOffer[]> {
  if (!supabase) return [];
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("store_offers")
    .select("*")
    .eq("is_active", true)
    .or(`starts_at.is.null,starts_at.lte.${now}`)
    .or(`ends_at.is.null,ends_at.gte.${now}`)
    .order("created_at", { ascending: false });

  if (error || !data) return [];
  return (data as OfferRow[])
    .map(offerFromRow)
    .filter((o) => isOfferCurrentlyValid(o));
}

function OfferChip({ offer, onCopy }: { offer: StoreOffer; onCopy: (code: string) => void }) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    if (!offer.code) return;
    navigator.clipboard.writeText(offer.code).catch(() => {});
    setCopied(true);
    onCopy(offer.code);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="shrink-0 flex items-center gap-2 bg-amber-500/10 border border-amber-500/25 rounded-xl px-3 py-2.5">
      <div className="min-w-0">
        <p className="text-xs font-bold text-amber-700 dark:text-amber-300 leading-tight">
          {offerLabel(offer)}
        </p>
        <p className="text-[11px] text-[var(--text-muted)] leading-tight line-clamp-1 max-w-[150px]">
          {offer.title}
        </p>
        {offer.minOrderPaise && (
          <p className="text-[10px] text-[var(--text-muted)] mt-0.5">
            Min order ₹{Math.ceil(offer.minOrderPaise / 100)}
          </p>
        )}
      </div>

      {offer.code ? (
        <button
          onClick={handleCopy}
          className="shrink-0 flex items-center gap-1 bg-amber-500 hover:bg-amber-600 text-white text-[11px] font-bold rounded-lg px-2 py-1 transition-colors active:scale-95"
          title="Copy code"
        >
          <span className="font-mono tracking-wide">{offer.code}</span>
          {copied ? (
            <Check className="w-3 h-3" />
          ) : (
            <Copy className="w-3 h-3" />
          )}
        </button>
      ) : (
        <span className="shrink-0 text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold bg-emerald-500/10 rounded-lg px-2 py-1">
          Auto
        </span>
      )}
    </div>
  );
}

interface ActiveOffersBannerProps {
  /** If provided, only show offers applicable to these product ids */
  productIds?: string[];
  className?: string;
}

export function ActiveOffersBanner({ productIds, className = "" }: ActiveOffersBannerProps) {
  const [offers, setOffers] = useState<StoreOffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  useEffect(() => {
    fetchActiveOffers().then((all) => {
      // Filter to relevant scope: sitewide always shown; scoped shown if
      // product is in cart (or if no productIds provided)
      const relevant = all.filter((o) => {
        if (o.productIds.length === 0) return true;        // sitewide
        if (!productIds || productIds.length === 0) return true;
        return o.productIds.some((pid) => productIds.includes(pid));
      });
      setOffers(relevant);
      setLoading(false);
    });
  }, [productIds?.join(",")]);

  if (loading || offers.length === 0) return null;

  const codeOffers = offers.filter((o) => o.code);
  const autoOffers = offers.filter((o) => !o.code);

  return (
    <div className={`rounded-2xl border border-amber-500/20 bg-amber-500/5 overflow-hidden ${className}`}>
      <button
        className="w-full flex items-center gap-2 px-3.5 py-2.5 text-left"
        onClick={() => setExpanded((x) => !x)}
      >
        <Tag className="w-3.5 h-3.5 text-amber-500 shrink-0" />
        <span className="text-xs font-semibold text-amber-700 dark:text-amber-300 flex-1">
          {offers.length} offer{offers.length !== 1 ? "s" : ""} available
          {copiedCode && (
            <span className="ml-2 text-emerald-600 dark:text-emerald-400 font-normal">
              · Code "{copiedCode}" copied!
            </span>
          )}
        </span>
        {expanded ? (
          <ChevronUp className="w-3.5 h-3.5 text-amber-500 shrink-0" />
        ) : (
          <ChevronDown className="w-3.5 h-3.5 text-amber-500 shrink-0" />
        )}
      </button>

      {expanded && (
        <div className="px-3.5 pb-3.5 space-y-3">
          {codeOffers.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wide mb-2">
                Coupon codes — apply at checkout
              </p>
              <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
                {codeOffers.map((offer) => (
                  <OfferChip
                    key={offer.id}
                    offer={offer}
                    onCopy={setCopiedCode}
                  />
                ))}
              </div>
            </div>
          )}

          {autoOffers.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wide mb-2">
                Auto-applied discounts
              </p>
              <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
                {autoOffers.map((offer) => (
                  <OfferChip
                    key={offer.id}
                    offer={offer}
                    onCopy={setCopiedCode}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
