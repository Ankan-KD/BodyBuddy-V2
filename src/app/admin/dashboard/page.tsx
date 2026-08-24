"use client";

// ════════════════════════════════════════════════════════════════════════
// BB Store Admin — Dashboard (Phase 12: polished UI)
// ════════════════════════════════════════════════════════════════════════

import { useEffect, useState } from "react";
import {
  Package, ShoppingBag, Warehouse,
  Plus, ArrowRight, CheckCircle2,
  Clock, AlertTriangle, TrendingUp,
  Users, BarChart3,
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import {
  adminFetchProducts,
  adminFetchOrders,
  adminFetchInventory,
  adminFetchTopProducts,
  adminFetchCustomers,
  TopProduct,
} from "@/lib/storeAdminApi";
import { formatPriceINR } from "@/lib/cartContext";

interface DashStats {
  totalProducts: number;
  publishedProducts: number;
  draftProducts: number;
  pendingOrders: number;
  todayOrders: number;
  totalRevenuePaise: number;
  lowStockCount: number;
  outOfStockCount: number;
  totalCustomers: number;
  recentOrders: Array<{
    id: string;
    orderNumber: string;
    customerName: string;
    totalPaise: number;
    status: string;
    createdAt: string;
  }>;
  topProducts: TopProduct[];
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<DashStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [
        allProds, pubProds, draftProds,
        recentOrders, pendingOrders, todayOrdersRes, allOrdersForRevenue,
        inventory, customers, topProducts,
      ] = await Promise.all([
        adminFetchProducts({ limit: 1 }),
        adminFetchProducts({ published: true, limit: 1 }),
        adminFetchProducts({ published: false, limit: 1 }),
        adminFetchOrders({ limit: 5 }),
        adminFetchOrders({ status: "placed", limit: 1 }),
        // Today's orders — fetch last 200; any store doing >200 orders/day needs a server route
        adminFetchOrders({ limit: 200 }),
        // All orders for revenue — fetch a large set; for accuracy a DB aggregate would be better
        adminFetchOrders({ limit: 1000 }),
        adminFetchInventory({ limit: 200 }),
        adminFetchCustomers({ limit: 1 }),
        adminFetchTopProducts(5),
      ]);

      const today = new Date().toDateString();
      const todayOrders = todayOrdersRes.orders.filter(
        (o) => new Date(o.createdAt).toDateString() === today
      ).length;

      const revenue = allOrdersForRevenue.orders
        .filter((o) => o.status !== "cancelled")
        .reduce((s, o) => s + o.totalPaise, 0);

      const lowStock = inventory.rows.filter(
        (r) => r.stockQuantity > 0 && r.stockQuantity <= r.lowStockThreshold
      ).length;
      const outOfStock = inventory.rows.filter((r) => r.stockQuantity === 0).length;

      setStats({
        totalProducts: allProds.total,
        publishedProducts: pubProds.total,
        draftProducts: draftProds.total,
        pendingOrders: pendingOrders.total,
        todayOrders,
        totalRevenuePaise: revenue,
        lowStockCount: lowStock,
        outOfStockCount: outOfStock,
        totalCustomers: customers.total,
        recentOrders: recentOrders.orders.slice(0, 5).map((o) => ({
          id: o.id,
          orderNumber: o.orderNumber,
          customerName: o.customerName,
          totalPaise: o.totalPaise,
          status: o.status,
          createdAt: o.createdAt,
        })),
        topProducts,
      });
      setLoading(false);
    }
    load();
  }, []);

  const v = (n: number) => (loading ? "—" : n.toLocaleString("en-IN"));

  const STATUS_BADGE: Record<string, string> = {
    placed:     "a-badge-orange",
    confirmed:  "a-badge-blue",
    processing: "a-badge-purple",
    shipped:    "a-badge-indigo",
    delivered:  "a-badge-green",
    cancelled:  "a-badge-red",
  };
  const STATUS_LABEL: Record<string, string> = {
    placed: "Placed", confirmed: "Confirmed", processing: "Processing",
    shipped: "Shipped", delivered: "Delivered", cancelled: "Cancelled",
  };

  const STATS = [
    {
      label: "Total Products",
      value: v(stats?.totalProducts ?? 0),
      sub: "in your store",
      href: "/admin/products",
      accent: "blue" as const,
      Icon: Package,
    },
    {
      label: "Pending Orders",
      value: loading ? "—" : String(stats?.pendingOrders ?? 0),
      sub: "awaiting confirmation",
      href: "/admin/orders?status=placed",
      accent: "amber" as const,
      Icon: ShoppingBag,
    },
    {
      label: "Today's Orders",
      value: loading ? "—" : String(stats?.todayOrders ?? 0),
      sub: "orders placed today",
      href: "/admin/orders",
      accent: "green" as const,
      Icon: TrendingUp,
    },
    {
      label: "Customers",
      value: loading ? "—" : String(stats?.totalCustomers ?? 0),
      sub: "total buyers",
      href: "/admin/customers",
      accent: "blue" as const,
      Icon: Users,
    },
    {
      label: "Low Stock",
      value: loading ? "—" : String(stats?.lowStockCount ?? 0),
      sub: stats?.outOfStockCount ? `${stats.outOfStockCount} out of stock` : "variants at threshold",
      href: "/admin/inventory",
      accent: stats?.outOfStockCount ? "red" as const : "amber" as const,
      Icon: AlertTriangle,
    },
  ];

  const QUICK_ACTIONS = [
    { href: "/admin/products/new", label: "Add New Product",   Icon: Plus        },
    { href: "/admin/products",     label: "Manage Products",   Icon: Package     },
    { href: "/admin/orders",       label: "View Orders",       Icon: ShoppingBag },
    { href: "/admin/customers",    label: "Customers",         Icon: Users       },
    { href: "/admin/inventory",    label: "Inventory",         Icon: Warehouse   },
  ];

  const STATUS_ROWS = [
    {
      label: "Published products",
      value: v(stats?.publishedProducts ?? 0),
      Icon: CheckCircle2,
      color: "var(--a-success)",
    },
    {
      label: "Draft products",
      value: v(stats?.draftProducts ?? 0),
      Icon: Clock,
      color: "var(--a-warning)",
    },
    {
      label: "Pending orders",
      value: loading ? "—" : String(stats?.pendingOrders ?? 0),
      Icon: ShoppingBag,
      color: "var(--a-stat-blue)",
    },
    {
      label: "Low stock items",
      value: loading ? "—" : String(stats?.lowStockCount ?? 0),
      Icon: AlertTriangle,
      color: "var(--a-orange)",
    },
    {
      label: "Total customers",
      value: loading ? "—" : String(stats?.totalCustomers ?? 0),
      Icon: Users,
      color: "var(--a-stat-green)",
    },
  ];

  const maxRevenue = Math.max(...(stats?.topProducts ?? []).map((p) => p.revenuePaise), 1);

  return (
    <div className="a-page">
      {/* ── Header ── */}
      <div className="a-page-header">
        <div className="a-page-title-group">
          <h1 className="a-page-title">Dashboard</h1>
          <p className="a-page-subtitle">BB Store Admin overview</p>
        </div>
      </div>

      {/* ── Revenue banner ── */}
      {!loading && (stats?.totalRevenuePaise ?? 0) > 0 && (
        <div className="a-revenue-banner mb-4">
          <div>
            <p className="a-revenue-banner-label">Total Revenue</p>
            <p className="a-revenue-banner-value">
              {formatPriceINR(stats?.totalRevenuePaise ?? 0)}
            </p>
          </div>
          <TrendingUp className="a-revenue-banner-icon" />
        </div>
      )}

      {/* ── Stat cards ── */}
      <div className="a-stats-grid">
        {STATS.map(({ label, value, sub, href, accent, Icon }) => (
          <Link key={label} href={href} className="a-stat-card">
            <div className={`a-stat-icon a-stat-icon-${accent}`}>
              <Icon style={{ width: 16, height: 16 }} />
            </div>
            <div>
              <div className="a-stat-value">{value}</div>
              <div className="a-stat-label">{label}</div>
              <div className="a-stat-sub">{sub}</div>
            </div>
          </Link>
        ))}
      </div>

      <div className="a-dash-grid">
        {/* ── Quick actions ── */}
        <div className="a-card">
          <div className="a-card-header">
            <h2 className="a-card-title">Quick Actions</h2>
          </div>
          <div className="a-card-body" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {QUICK_ACTIONS.map(({ href, label, Icon }) => (
              <Link key={href} href={href} className="a-quick-action">
                <Icon style={{ width: 15, height: 15 }} />
                {label}
                <ArrowRight style={{ width: 13, height: 13, marginLeft: "auto" }} />
              </Link>
            ))}
          </div>
        </div>

        {/* ── Status summary ── */}
        <div className="a-card">
          <div className="a-card-header">
            <h2 className="a-card-title">Store Summary</h2>
          </div>
          <div className="a-card-body" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {STATUS_ROWS.map(({ label, value, Icon, color }) => (
              <div key={label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Icon style={{ width: 14, height: 14, color }} />
                  <span style={{ fontSize: 13, color: "var(--a-text-muted)" }}>{label}</span>
                </div>
                <span style={{ fontSize: 14, fontWeight: 700, color }}>{value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Top Products ── */}
        <div className="a-card" style={{ gridColumn: "1 / -1" }}>
          <div className="a-card-header">
            <h2 className="a-card-title">
              <BarChart3 style={{ width: 16, height: 16 }} />
              Top Products by Revenue
            </h2>
            <Link href="/admin/products" className="a-btn a-btn-ghost a-btn-sm">
              All products <ArrowRight style={{ width: 12, height: 12 }} />
            </Link>
          </div>
          <div className="a-card-body">
            {loading && (
              <p style={{ textAlign: "center", color: "var(--a-text-muted)", fontSize: 13, padding: "24px 0" }}>
                Loading…
              </p>
            )}
            {!loading && (stats?.topProducts ?? []).length === 0 && (
              <p style={{ textAlign: "center", color: "var(--a-text-muted)", fontSize: 13, padding: "24px 0" }}>
                No sales yet. Top products will appear once orders are placed.
              </p>
            )}
            {!loading && (stats?.topProducts ?? []).length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {(stats?.topProducts ?? []).map((p, i) => {
                  const barWidth = Math.round((p.revenuePaise / maxRevenue) * 100);
                  return (
                    <div key={p.productId || i} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      {/* Rank */}
                      <span style={{
                        width: 24, height: 24, borderRadius: "50%",
                        background: i === 0 ? "var(--a-primary)" : "var(--a-surface-2)",
                        color: i === 0 ? "#fff" : "var(--a-text-muted)",
                        border: i === 0 ? "none" : "1px solid var(--a-border)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 11, fontWeight: 700, flexShrink: 0,
                      }}>
                        {i + 1}
                      </span>
                      {/* Thumbnail */}
                      <div style={{
                        width: 38, height: 38, borderRadius: "var(--a-radius)",
                        background: "var(--a-surface-2)", flexShrink: 0, overflow: "hidden",
                        border: "1px solid var(--a-border)",
                      }}>
                        {p.imageUrl ? (
                          <Image
                            src={p.imageUrl}
                            alt={p.productName}
                            width={38}
                            height={38}
                            style={{ objectFit: "cover", width: "100%", height: "100%" }}
                          />
                        ) : (
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>
                            <Package style={{ width: 16, height: 16, color: "var(--a-text-muted)" }} />
                          </div>
                        )}
                      </div>
                      {/* Info + bar */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--a-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {p.productName}
                          </span>
                          <span style={{ fontSize: 13, fontWeight: 700, color: "var(--a-primary)", marginLeft: 12, flexShrink: 0 }}>
                            {formatPriceINR(p.revenuePaise)}
                          </span>
                        </div>
                        <div style={{ height: 5, borderRadius: 99, background: "var(--a-surface-2)", overflow: "hidden" }}>
                          <div style={{
                            height: "100%", borderRadius: 99,
                            width: `${barWidth}%`,
                            background: i === 0 ? "var(--a-primary)" : "var(--a-border-strong)",
                            transition: "width 0.4s ease",
                          }} />
                        </div>
                        <span style={{ fontSize: 11, color: "var(--a-text-muted)", marginTop: 3, display: "block" }}>
                          {p.unitsSold} unit{p.unitsSold !== 1 ? "s" : ""} sold
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ── Recent orders ── */}
        <div className="a-card" style={{ gridColumn: "1 / -1" }}>
          <div className="a-card-header">
            <h2 className="a-card-title">Recent Orders</h2>
            <Link href="/admin/orders" className="a-btn a-btn-ghost a-btn-sm">
              View all <ArrowRight style={{ width: 12, height: 12 }} />
            </Link>
          </div>
          <div className="a-table-wrap">
            <table className="a-table">
              <thead>
                <tr>
                  <th>Order #</th>
                  <th>Customer</th>
                  <th>Date</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th className="col-actions">Action</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={6} style={{ textAlign: "center", padding: "32px 0", color: "var(--a-text-muted)", fontSize: 13 }}>
                      Loading…
                    </td>
                  </tr>
                )}
                {!loading && (stats?.recentOrders ?? []).length === 0 && (
                  <tr>
                    <td colSpan={6} style={{ textAlign: "center", padding: "32px 0", color: "var(--a-text-muted)", fontSize: 13 }}>
                      No orders yet. Orders will appear here once customers start purchasing.
                    </td>
                  </tr>
                )}
                {!loading && (stats?.recentOrders ?? []).map((o) => (
                  <tr key={o.id}>
                    <td style={{ fontFamily: "monospace", fontSize: 12, fontWeight: 600 }}>{o.orderNumber}</td>
                    <td style={{ fontSize: 13 }}>{o.customerName}</td>
                    <td style={{ fontSize: 12, color: "var(--a-text-muted)" }}>
                      {new Date(o.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                    </td>
                    <td style={{ fontSize: 13, fontWeight: 600 }}>{formatPriceINR(o.totalPaise)}</td>
                    <td>
                      <span className={`a-badge ${STATUS_BADGE[o.status] ?? "a-badge-neutral"}`}>
                        {STATUS_LABEL[o.status] ?? o.status}
                      </span>
                    </td>
                    <td className="col-actions">
                      <Link href={`/admin/orders/${o.id}`} className="a-btn a-btn-ghost a-btn-sm">
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}