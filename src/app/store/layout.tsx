"use client";

import { useAuth } from "@/lib/auth";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { StoreNav } from "@/components/store/StoreNav";
import { StoreHeader } from "@/components/store/StoreHeader";
import { CartProvider } from "@/lib/cartContext";
import { WishlistProvider } from "@/lib/wishlistContext";
import { Loader2, Megaphone } from "lucide-react";
import { AppIcon } from "@/components/AppIcon";
import { useStoreSettings } from "@/lib/useStoreData";
import { StoreProvider } from "@/lib/store";

function StoreSplash() {
  return (
    <div className="min-h-dvh flex flex-col items-center justify-center gap-3">
      <AppIcon className="h-14 w-14 rounded-2xl shadow-glow-nova animate-pulse-glow" />
      <Loader2 className="w-5 h-5 text-amber-400 animate-spin" />
    </div>
  );
}

function AnnouncementBanner() {
  const { data: settings } = useStoreSettings();
  if (!settings?.storeAnnouncementActive || !settings?.storeAnnouncement) return null;
  return (
    <div
      style={{
        background: "linear-gradient(90deg, #1D4ED8, #7C3AED)",
        color: "#fff",
        fontSize: 12,
        fontWeight: 600,
        padding: "7px 12px",
        textAlign: "center",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        letterSpacing: "0.01em",
      }}
    >
      <Megaphone style={{ width: 13, height: 13, flexShrink: 0 }} />
      {settings.storeAnnouncement}
    </div>
  );
}

export default function StoreLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.replace("/landing");
  }, [loading, user, router]);

  if (loading) return <StoreSplash />;
  if (!user) return <StoreSplash />;

  return (
    <StoreProvider>
      <CartProvider>
        <WishlistProvider>
          <div className="mx-auto max-w-md min-h-dvh flex flex-col store-theme">
            <AnnouncementBanner />
            <StoreHeader />
            <main className="flex-1 pb-24">{children}</main>
            <StoreNav />
          </div>
        </WishlistProvider>
      </CartProvider>
    </StoreProvider>
  );
}
