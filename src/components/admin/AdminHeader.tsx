"use client";

import { usePathname } from "next/navigation";
import { Menu, Bell, ExternalLink, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/lib/auth";

const ROUTE_LABELS: Record<string, string> = {
  "/admin/dashboard":  "Dashboard",
  "/admin/products":   "Products",
  "/admin/catalog":    "Product Catalog",
  "/admin/categories": "Categories",
  "/admin/orders":     "Orders",
  "/admin/customers":  "Customers",
  "/admin/offers":     "Offers",
  "/admin/inventory":  "Inventory",
  "/admin/settings":   "Settings",
};

interface Props { onMenuClick: () => void; }

export function AdminHeader({ onMenuClick }: Props) {
  const pathname = usePathname();
  const { user }  = useAuth();

  /* Resolve current page label */
  let section = "Admin";
  for (const [route, label] of Object.entries(ROUTE_LABELS)) {
    if (pathname === route || (route !== "/admin/dashboard" && pathname.startsWith(route))) {
      section = label;
      break;
    }
  }

  /* Detect sub-pages, e.g. /admin/products/new */
  const isNew  = pathname.endsWith("/new");
  const isEdit = pathname.includes("/edit");
  const subLabel = isNew ? "New" : isEdit ? "Edit" : null;

  const initials = (
    user?.user_metadata?.name
      ? user.user_metadata.name.slice(0, 2)
      : user?.email?.slice(0, 2) ?? "AD"
  ).toUpperCase();

  return (
    <header className="a-header">

      {/* Hamburger (mobile) */}
      <button
        onClick={onMenuClick}
        className="a-header-icon-btn lg:hidden"
        aria-label="Open navigation"
      >
        <Menu style={{ width: 18, height: 18 }} />
      </button>

      {/* Breadcrumb title */}
      <div className="a-header-breadcrumb" style={{ flex: 1 }}>
        <span style={{ color: "var(--a-header-muted)", fontSize: 13, fontWeight: 500 }}>
          BB Store
        </span>
        <ChevronRight style={{ width: 12, height: 12, color: "var(--a-header-muted)", flexShrink: 0 }} />
        <span style={{ color: "var(--a-header-text)", fontSize: 14, fontWeight: 600, letterSpacing: "-0.01em" }}>
          {section}
        </span>
        {subLabel && (
          <>
            <ChevronRight style={{ width: 12, height: 12, color: "var(--a-header-muted)", flexShrink: 0 }} />
            <span style={{ color: "var(--a-header-muted)", fontSize: 13, fontWeight: 500 }}>
              {subLabel}
            </span>
          </>
        )}
      </div>

      {/* Right controls */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>

        <Link
          href="/store"
          target="_blank"
          rel="noopener noreferrer"
          className="a-header-action"
        >
          <ExternalLink style={{ width: 12, height: 12 }} />
          View Store
        </Link>

        <button className="a-header-icon-btn" aria-label="Notifications">
          <Bell style={{ width: 16, height: 16 }} />
        </button>

        <div
          className="a-avatar"
          title={user?.email}
          role="img"
          aria-label={`Signed in as ${user?.email ?? "admin"}`}
        >
          {initials}
        </div>

      </div>
    </header>
  );
}
