"use client";

import { useAuth } from "@/lib/auth";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { StoreNav } from "@/components/store/StoreNav";
import { StoreHeader } from "@/components/store/StoreHeader";
import { Loader2 } from "lucide-react";
import { AppIcon } from "@/components/AppIcon";

function StoreSplash() {
  return (
    <div className="min-h-dvh flex flex-col items-center justify-center gap-3">
      <AppIcon className="h-14 w-14 rounded-2xl shadow-glow-nova animate-pulse-glow" />
      <Loader2 className="w-5 h-5 text-amber-400 animate-spin" />
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
    <div className="mx-auto max-w-md min-h-dvh flex flex-col store-theme">
      <StoreHeader />
      <main className="flex-1 pb-24">{children}</main>
      <StoreNav />
    </div>
  );
}
