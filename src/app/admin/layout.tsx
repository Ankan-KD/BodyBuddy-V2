"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { useAdminAuth, AdminAuthProvider } from "@/lib/adminAuth";
import { AdminThemeProvider, useAdminTheme } from "@/lib/adminTheme";
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
      <a href="/dashboard" style={{ fontSize: 13, color: "var(--a-primary)", textDecoration: "none", fontWeight: 500 }}>
        ← Back to BB Health
      </a>
    </div>
  );
}

function AdminShell({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, adminLoading } = useAdminAuth();
  const { theme } = useAdminTheme();
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

  // Login page — still apply theme data-attribute so the toggle works there too
  if (isLoginPage) {
    return (
      <div className="admin-shell" data-admin-theme={theme} style={{ minHeight: "100dvh" }}>
        {children}
      </div>
    );
  }

  if (authLoading || adminLoading) return <AdminSplash message="Loading admin console…" />;
  if (!user) return <AdminSplash message="Redirecting to login…" />;
  if (!isAdmin) return <AdminAccessDenied />;

  return (
    <div
      className="admin-shell"
      data-admin-theme={theme}
      // Fixed to the viewport height (not just a minimum) and clipped, so the
      // sidebar and header stay pinned in place while <main> (the only
      // scrollable region below) scrolls independently. Using minHeight here
      // let this container grow past 100dvh with tall page content, which
      // pushed the whole shell into document scroll and dragged the sidebar
      // off-screen along with it.
      style={{ display: "flex", height: "100dvh", overflow: "hidden", background: "var(--a-bg)" }}
    >
      <AdminSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, height: "100%", overflow: "hidden" }}>
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
      <AdminThemeProvider>
        <AdminShell>{children}</AdminShell>
      </AdminThemeProvider>
    </AdminAuthProvider>
  );
}
