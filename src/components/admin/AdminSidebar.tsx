"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard, Package, BookOpen, Tag,
  ShoppingBag, Users, Percent, Warehouse,
  Settings, LogOut, ShieldCheck, X,
} from "lucide-react";
import { useAuth } from "@/lib/auth";

const NAV_ITEMS = [
  { href: "/admin/dashboard",  label: "Dashboard",       Icon: LayoutDashboard },
  { href: "/admin/products",   label: "Store Products",  Icon: Package         },
  { href: "/admin/catalog",    label: "Product Catalogue", Icon: BookOpen        },
  { href: "/admin/categories", label: "Product Groups & Types",      Icon: Tag             },
  { href: "/admin/orders",     label: "Orders",          Icon: ShoppingBag     },
  { href: "/admin/customers",  label: "Customers",       Icon: Users           },
  { href: "/admin/offers",     label: "Offers",          Icon: Percent         },
  { href: "/admin/inventory",  label: "Inventory",       Icon: Warehouse       },
  { href: "/admin/settings",   label: "Settings",        Icon: Settings        },
];

interface Props { open: boolean; onClose: () => void; }

export function AdminSidebar({ open, onClose }: Props) {
  const pathname = usePathname();
  const router   = useRouter();
  const { signOut } = useAuth();

  async function handleSignOut() {
    await signOut();
    router.replace("/admin/login");
  }

  return (
    <>
      {open && (
        <div
          className="a-sidebar-overlay lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside className={`a-sidebar${open ? " open" : ""}`}>

        {/* ── Logo ───────────────────────────────────────────────── */}
        <div className="a-sidebar-logo">
          <div className="a-sidebar-logo-icon">
            <ShieldCheck style={{ width: 15, height: 15, color: "white" }} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="a-sidebar-logo-text">BB Store</div>
            <div className="a-sidebar-logo-sub">Admin Console</div>
          </div>
          <button
            onClick={onClose}
            className="a-btn a-btn-ghost a-btn-icon a-btn-sm lg:hidden"
            aria-label="Close sidebar"
          >
            <X style={{ width: 14, height: 14 }} />
          </button>
        </div>

        {/* ── Nav ────────────────────────────────────────────────── */}
        <nav className="a-nav" aria-label="Admin navigation">
          <div className="a-nav-section">Navigation</div>

          {NAV_ITEMS.map(({ href, label, Icon }) => {
            const active =
              pathname === href ||
              (href !== "/admin/dashboard" && pathname.startsWith(href));
            return (
              <Link
                key={href}
                href={href}
                onClick={onClose}
                className={`a-nav-item${active ? " active" : ""}`}
              >
                <Icon style={{ width: 15, height: 15 }} />
                {label}
              </Link>
            );
          })}
        </nav>

        {/* ── Footer ─────────────────────────────────────────────── */}
        <div className="a-sidebar-footer">
          <button onClick={handleSignOut} className="a-sidebar-signout">
            <LogOut style={{ width: 14, height: 14 }} />
            Sign out
          </button>
        </div>

      </aside>
    </>
  );
}
