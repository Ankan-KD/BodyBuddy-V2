"use client";

import { useState, useEffect } from "react";
import { Search, X, SlidersHorizontal, ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { useProducts } from "@/lib/useStoreData";
import { searchProductNames } from "@/lib/storeApi";
import { ProductGrid } from "@/components/store/ProductCard";

const TRENDING = ["Whey Protein", "Creatine", "Multivitamin", "BCAA", "Pre-workout", "Omega-3"];

export default function StoreSearchPage() {
  const [query, setQuery] = useState("");
  const [committed, setCommitted] = useState("");
  const [suggestions, setSuggestions] = useState<{ id: string; name: string; slug: string }[]>([]);

  // Autocomplete suggestions (debounced)
  useEffect(() => {
    if (!query.trim() || query.length < 2) { setSuggestions([]); return; }
    const t = setTimeout(async () => {
      const results = await searchProductNames(query, 6);
      setSuggestions(results);
    }, 250);
    return () => clearTimeout(t);
  }, [query]);

  // Full product search (only when user commits via Enter or suggestion tap)
  const { data: results, loading } = useProducts({
    search: committed,
    limit: 40,
  });

  function commit(q: string) {
    setQuery(q);
    setCommitted(q);
    setSuggestions([]);
  }

  return (
    <div className="px-4 pt-4">
      {/* Search input */}
      <div className="flex items-center gap-2 mb-5">
        <div className="flex-1 flex items-center gap-3 glass-panel border border-[var(--border)] rounded-2xl px-4 py-3 shadow-soft">
          <Search className="w-4 h-4 text-[var(--text-muted)] shrink-0" />
          <input
            autoFocus
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-[var(--text-muted)]"
            placeholder="Search supplements, proteins…"
            value={query}
            onChange={(e) => { setQuery(e.target.value); if (!e.target.value) setCommitted(""); }}
            onKeyDown={(e) => { if (e.key === "Enter") commit(query); }}
          />
          {query && (
            <button onClick={() => { setQuery(""); setCommitted(""); setSuggestions([]); }}>
              <X className="w-4 h-4 text-[var(--text-muted)]" />
            </button>
          )}
        </div>
        <button className="h-11 w-11 flex items-center justify-center glass-panel border border-[var(--border)] rounded-2xl shadow-soft">
          <SlidersHorizontal className="w-4 h-4 text-[var(--text-muted)]" />
        </button>
      </div>

      {/* Autocomplete suggestions */}
      {suggestions.length > 0 && (
        <div className="glass-panel border border-[var(--border)] rounded-2xl overflow-hidden mb-4 shadow-soft">
          {suggestions.map((s) => (
            <Link
              key={s.id}
              href={`/store/products/${s.slug}`}
              className="flex items-center gap-3 px-4 py-3 border-b border-[var(--border)] last:border-0 active:bg-amber-500/5"
            >
              <Search className="w-3.5 h-3.5 text-[var(--text-muted)] shrink-0" />
              <span className="text-sm flex-1">{s.name}</span>
              <ArrowUpRight className="w-3.5 h-3.5 text-[var(--text-muted)]" />
            </Link>
          ))}
        </div>
      )}

      {/* Trending (empty query state) */}
      {!query && (
        <div>
          <h2 className="font-display text-base font-semibold mb-3 text-[var(--text-muted)]">Trending</h2>
          <div className="flex flex-wrap gap-2">
            {TRENDING.map((term) => (
              <button
                key={term}
                onClick={() => commit(term)}
                className="text-sm px-3.5 py-1.5 rounded-full glass-panel border border-[var(--border)] hover:border-amber-500/40 transition-colors"
              >
                {term}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Results */}
      {committed && (
        <div>
          {!loading && (
            <p className="text-xs text-[var(--text-muted)] mb-3">
              {results.length > 0
                ? `${results.length} results for "${committed}"`
                : `No results for "${committed}"`}
            </p>
          )}
          <ProductGrid
            products={results}
            loading={loading}
            emptyMessage={`No products found for "${committed}".`}
          />
        </div>
      )}
    </div>
  );
}
