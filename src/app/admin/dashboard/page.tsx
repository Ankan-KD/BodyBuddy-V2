"use client";

import { useEffect, useState } from "react";
import {
  Package, Eye, BookOpen, ShoppingBag,
  Warehouse, Plus, ArrowRight, CheckCircle2,
  Clock, TrendingUp, AlertTriangle,
} from "lucide-react";
import Link from "next/link";
import { adminFetchProducts } from "@/lib/storeAdminApi";

export default function AdminDashboardPage() {
  const [stats, setStats]   = useState({ total: 0, published: 0, drafts: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      adminFetchProducts({ limit: 1 }),
      adminFetchProducts({ published: true,  limit: 1 }),
      adminFetchProducts({ published: false, limit: 1 }),
    ]).then(([all, pub, draft]) => {
      setStats({ total: all.total, published: pub.total, drafts: draft.total });
      setLoading(false);
    });
  }, []);

  const val = (n: number) => (loading ? "—" : n.toLocaleString("en-IN"));

  /* ── Stat card definitions ── */
  const STATS = [
    {
      label: "Total Products",
      value: val(stats.total),
      sub:   "in your store",
      href:  "/admin/products",
      accent:  "blue"  as const,
      Icon:  Package,
    },
    {
      label: "Published",
      value: val(stats.published),
      sub:   "live to customers",
      href:  "/admin/products?published=true",
      accent:  "green" as const,
      Icon:  CheckCircle2,
    },
    {
      label: "Drafts",
      value: val(stats.drafts),
      sub:   "unpublished",
      href:  "/admin/products?published=false",
      accent:  "amber" as const,
      Icon:  Clock,
    },
    {
      label: "Orders",
      value: "—",
      sub:   "coming soon",
      href:  "/admin/orders",
      accent:  "red"   as const,
      Icon:  ShoppingBag,
    },
  ];

  /* ── Quick actions ── */
  const QUICK_ACTIONS = [
    { href: "/admin/products/new", label: "Add New Product",   Icon: Plus        },
    { href: "/admin/products",     label: "Manage Products",   Icon: Package     },
    { href: "/admin/catalog",      label: "Browse Catalog",    Icon: BookOpen    },
    { href: "/admin/orders",       label: "View Orders",       Icon: ShoppingBag },
    { href: "/admin/inventory",    label: "Inventory",         Icon: Warehouse   },
  ];

  /* ── Status summary rows ── */
  const STATUS_ROWS = [
    {
      label: "Published products",
      value: val(stats.published),
      Icon:  CheckCircle2,
      color: "var(--a-success)",
    },
    {
      label: "Draft products",
      value: val(stats.drafts),
      Icon:  Clock,
      color: "var(--a-warning)",
    },
    {
      label: "Pending orders",
      value: "—",
      Icon:  ShoppingBag,
      color: "var(--a-stat-blue)",
    },
    {
      label: "Low stock items",
      value: "—",
      Icon:  AlertTriangle,
      color: "var(--a-orange)",
    },
  ];

  return (
    <div style={{ maxWidth: 960 }}>

      {/* ── Page header ────────────────────────────────────────── */}
      <div className="a-page-header">
        <div>
          <h2 className="a-page-title">Dashboard</h2>
          <p className="a-page-subtitle">Welcome back — here&apos;s your store overview</p>
        </div>
        <Link href="/admin/products/new" className="a-btn a-btn-primary">
          <Plus style={{ width: 14, height: 14 }} />
          Add Product
        </Link>
      </div>

      {/* ── Stat cards ─────────────────────────────────────────── */}
      <div className="a-stat-grid" style={{ marginBottom: 22 }}>
        {STATS.map(({ label, value, sub, href, accent, Icon }) => (
          <Link key={label} href={href} className={`a-stat a-stat-${accent}`}>
            <div className={`a-stat-icon a-stat-icon-${accent}`}>
              <Icon style={{ width: 15, height: 15 }} />
            </div>
            <div className="a-stat-value">{value}</div>
            <div className="a-stat-label">{label}</div>
            <div className="a-stat-sub">{sub}</div>
          </Link>
        ))}
      </div>

      {/* ── Two-column section ──────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>

        {/* Quick Actions */}
        <div className="a-card">
          <div className="a-card-header">
            <span className="a-card-header-title">Quick Actions</span>
            <TrendingUp style={{ width: 14, height: 14, color: "var(--a-text-3)" }} />
          </div>
          <div style={{ padding: "6px 8px" }}>
            {QUICK_ACTIONS.map(({ href, label, Icon }) => (
              <Link
                key={href + label}
                href={href}
                className="a-nav-item"
                style={{ display: "flex" }}
              >
                <Icon style={{ width: 14, height: 14 }} />
                <span style={{ flex: 1 }}>{label}</span>
                <ArrowRight style={{ width: 12, height: 12, opacity: 0.35 }} />
              </Link>
            ))}
          </div>
        </div>

        {/* Status summary */}
        <div className="a-card">
          <div className="a-card-header">
            <span className="a-card-header-title">Status Summary</span>
            <Eye style={{ width: 14, height: 14, color: "var(--a-text-3)" }} />
          </div>
          <div style={{ padding: "4px 18px 8px" }}>
            {STATUS_ROWS.map(({ label, value, Icon, color }) => (
              <div
                key={label}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "11px 0",
                  borderBottom: "1px solid var(--a-border)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 13, color: "var(--a-text-2)" }}>
                  <Icon style={{ width: 14, height: 14, color, flexShrink: 0 }} />
                  {label}
                </div>
                <span style={{ fontSize: 14, fontWeight: 700, color: "var(--a-text)", letterSpacing: "-0.01em" }}>
                  {value}
                </span>
              </div>
            ))}
            <p style={{ fontSize: 11, color: "var(--a-text-3)", marginTop: 12, lineHeight: 1.5 }}>
              Revenue and order metrics will be available in a future release.
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}
