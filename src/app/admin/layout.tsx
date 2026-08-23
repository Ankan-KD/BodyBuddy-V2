"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { useAdminAuth, AdminAuthProvider } from "@/lib/adminAuth";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { Loader2, ShieldX } from "lucide-react";
import "./admin.css";

function AdminSplash({ message }: { message: string }) {
  return (
    <div className="admin-shell a-splash">
      <Loader2 className="w-5 h-5 animate-spin" style={{ color: "var(--a-primary)" }} />
      <p>{message}</p>
    </div>
  );
}

function AdminAccessDenied() {
  return (
    <div className="admin-shell a-splash">
      <div style={{
        width: 44, height: 44, borderRadius: 8,
        background: "var(--a-danger-bg)", border: "1px solid var(--a-danger-border)",
        display: "flex", alignItems: "center", justifyContent: "center"
      }}>
        <ShieldX style={{ width: 22, height: 22, color: "var(--a-danger)" }} />
      </div>
      <div style={{ textAlign: "center" }}>
        <p style={{ fontWeight: 600, color: "var(--a-text)", fontSize: 15, marginBottom: 4 }}>Access Denied</p>
        <p style={{ fontSize: 13, color: "var(--a-text-3)", maxWidth: 280 }}>
          You don&apos;t have administrator access. Contact the site owner if this is a mistake.
        </p>
      </div>
      <a href="/" style={{ fontSize: 13, color: "var(--a-primary)", textDecoration: "none", fontWeight: 500 }}>
        ← Back to BB Health
      </a>
    </div>
  );
}

function AdminShell({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, adminLoading } = useAdminAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const isLoginPage = pathname === "/admin/login";

  useEffect(() => {
    if (isLoginPage) return;
    if (!authLoading && !user) {
      router.replace("/admin/login");
    }
  }, [authLoading, user, router, isLoginPage]);

  if (isLoginPage) return <>{children}</>;

  if (authLoading || adminLoading) return <AdminSplash message="Loading admin console…" />;
  if (!user) return <AdminSplash message="Redirecting to login…" />;
  if (!isAdmin) return <AdminAccessDenied />;

  return (
    <div className="admin-shell" style={{ display: "flex", minHeight: "100dvh", background: "var(--a-bg)" }}>
      <AdminSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, overflow: "hidden" }}>
        <AdminHeader onMenuClick={() => setSidebarOpen(true)} />
        <main className="a-main">
          {children}
        </main>
      </div>
    </div>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminAuthProvider>
      <AdminShell>{children}</AdminShell>
    </AdminAuthProvider>
  );
}
