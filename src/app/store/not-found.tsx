import Link from "next/link";
import { ShoppingBag, Home } from "lucide-react";

export default function StoreNotFound() {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center px-6 text-center gap-4">
      <div className="w-16 h-16 rounded-2xl bg-amber-500/10 flex items-center justify-center">
        <ShoppingBag className="w-8 h-8 text-amber-500/50" />
      </div>
      <div>
        <h1 className="font-display text-xl font-semibold mb-1">Page not found</h1>
        <p className="text-sm text-[var(--text-muted)]">
          This store page doesn&apos;t exist or may have moved.
        </p>
      </div>
      <div className="flex flex-col gap-2 w-full max-w-xs">
        <Link
          href="/store"
          className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 text-white text-sm font-semibold shadow-soft active:scale-95 transition-transform"
        >
          <ShoppingBag className="w-4 h-4" />
          Back to Store
        </Link>
        <Link
          href="/"
          className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-[var(--border)] text-sm font-medium text-[var(--text-muted)] active:scale-95 transition-transform"
        >
          <Home className="w-4 h-4" />
          BB Health
        </Link>
      </div>
    </div>
  );
}
