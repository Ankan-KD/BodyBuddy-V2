"use client";

// ════════════════════════════════════════════════════════════════════════
// BB Store Admin — Dashboard (Phase 14: BB Store Admin Console mockup)
// ════════════════════════════════════════════════════════════════════════

import { useEffect, useMemo, useState } from "react";
import {
  Package, ShoppingBag,
  ArrowRight, IndianRupee,
  AlertTriangle, TrendingUp, TrendingDown, Minus,
  Users, BarChart3, PieChart, Boxes, CheckCircle2,
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
  InventoryVariantRow,
} from "@/lib/storeAdminApi";
import { formatPriceINR } from "@/lib/cartContext";
import type { StoreOrder } from "@/lib/orderTypes";
import { DateRangeSelect, DashboardRange } from "@/components/admin/dashboard/DateRangeSelect";
import { RevenueTrendChart } from "@/components/admin/dashboard/RevenueTrendChart";
import { SalesOverviewDonut, DonutSegment } from "@/components/admin/dashboard/SalesOverviewDonut";
import {
  splitByRange,
  sumRevenuePaise,
  percentDelta,
  buildRevenueTrend,
  buildOrderCountTrend,
} from "@/lib/dashboardMetrics";
import "./dashboard.css";

interface DashData {
  totalProducts: number;
  publishedProducts: number;
  draftProducts: number;
  pendingOrders: number;
  totalCustomers: number;
  allOrders: StoreOrder[];
  recentOrders: StoreOrder[];
  inventory: InventoryVariantRow[];
  topProducts: TopProduct[];
}

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
const PAYMENT_BADGE: Record<string, string> = {
  paid: "a-badge-green",
  pending: "a-badge-yellow",
  failed: "a-badge-red",
  refunded: "a-badge-neutral",
};
const PAYMENT_LABEL: Record<string, string> = {
  paid: "Paid", pending: "Pending", failed: "Failed", refunded: "Refunded",
};
const STATUS_COLORS: Record<string, string> = {
  placed: "#ffb72d",
  confirmed: "#2785f5",
  processing: "#a78bfa",
  shipped: "#818cf8",
  delivered: "#18df8b",
  cancelled: "#ff4e5a",
};

/** Small decorative sparkline built from real trend values — no fabricated data. */
function Sparkline({ values, tone = "blue" }: { values: number[]; tone?: "blue" | "green" | "purple" | "red" | "gray" }) {
  if (values.length < 2) return null;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  const w = 108, h = 44, pad = 3;
  const pts = values.map((val, i) => {
    const x = pad + (i / (values.length - 1)) * (w - pad * 2);
    const y = pad + (1 - (val - min) / range) * (h - pad * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  return (
    <svg className={`bbd-spark bbd-spark-${tone}`} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
      <path d={`M${pts.join(" L ")}`} />
    </svg>
  );
}

/** Two-segment horizontal ratio bar — used where we have a real split (e.g. published/draft) but no time series. */
function SplitBar({ a, b, colorA, colorB }: { a: number; b: number; colorA: string; colorB: string }) {
  const total = a + b || 1;
  return (
    <div className="bbd-splitbar">
      <div style={{ width: `${(a / total) * 100}%`, background: colorA }} />
      <div style={{ width: `${(b / total) * 100}%`, background: colorB }} />
    </div>
  );
}

function ChangeRow({ pct, positiveIsGood = true, flatLabel }: { pct: number | null | undefined; positiveIsGood?: boolean; flatLabel?: string }) {
  if (pct === null || pct === undefined) return null;
  const good = positiveIsGood ? pct >= 0 : pct <= 0;
  const cls = pct === 0 ? "flat" : good ? "green" : "red";
  const Icon = pct > 0 ? TrendingUp : pct < 0 ? TrendingDown : Minus;
  return (
    <div className={`bbd-stat-change ${cls}`}>
      <Icon />
      {pct > 0 ? "+" : ""}{pct}%
      <span className="bbd-stat-vs">{flatLabel ?? "vs previous period"}</span>
    </div>
  );
}

export default function AdminDashboardPage() {
  const [data, setData] = useState<DashData | null>(null);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<DashboardRange>("30d");

  useEffect(() => {
    async function load() {
      const [
        allProds, pubProds, draftProds,
        recentOrders, pendingOrders, allOrdersRes,
        inventory, customers, topProducts,
      ] = await Promise.all([
        adminFetchProducts({ limit: 1 }),
        adminFetchProducts({ published: true, limit: 1 }),
        adminFetchProducts({ published: false, limit: 1 }),
        adminFetchOrders({ limit: 6 }),
        adminFetchOrders({ status: "placed", limit: 1 }),
        // Full order set powers the revenue trend, period deltas, and sales
        // overview — a server-side aggregate would scale better past ~1000
        // orders, but this keeps everything driven by real store data.
        adminFetchOrders({ limit: 1000 }),
        adminFetchInventory({ limit: 200 }),
        adminFetchCustomers({ limit: 1 }),
        adminFetchTopProducts(5),
      ]);

      setData({
        totalProducts: allProds.total,
        publishedProducts: pubProds.total,
        draftProducts: draftProds.total,
        pendingOrders: pendingOrders.total,
        totalCustomers: customers.total,
        allOrders: allOrdersRes.orders,
        recentOrders: recentOrders.orders.slice(0, 6),
        inventory: inventory.rows,
        topProducts,
      });
      setLoading(false);
    }
    load();
  }, []);

  const v = (n: number) => (loading ? "—" : n.toLocaleString("en-IN"));

  // ── Range-aware metrics, recomputed client-side from the fetched order set ──
  const metrics = useMemo(() => {
    const orders = data?.allOrders ?? [];
    const { current, previous } = splitByRange(orders, range);

    const currentRevenue = sumRevenuePaise(current);
    const previousRevenue = sumRevenuePaise(previous);
    const revenueDelta = range === "all" ? null : percentDelta(currentRevenue, previousRevenue);
    const ordersDelta = range === "all" ? null : percentDelta(current.length, previous.length);

    const trend = buildRevenueTrend(orders, range);
    const orderCountTrend = buildOrderCountTrend(orders, range);

    const donutSegments: DonutSegment[] = (
      ["delivered", "shipped", "processing", "confirmed", "placed", "cancelled"] as const
    )
      .map((status) => ({
        label: STATUS_LABEL[status],
        value: current.filter((o) => o.status === status).length,
        color: STATUS_COLORS[status],
      }))
      .filter((s) => s.value > 0);

    return { current, currentRevenue, revenueDelta, ordersDelta, trend, orderCountTrend, donutSegments };
  }, [data, range]);

  const lowStockCount = (data?.inventory ?? []).filter(
    (r) => r.stockQuantity > 0 && r.stockQuantity <= r.lowStockThreshold
  ).length;
  const outOfStockCount = (data?.inventory ?? []).filter((r) => r.stockQuantity === 0).length;

  const STORE_SUMMARY: Array<{ label: string; value: string; cls: "green" | "yellow" | "blue" | "red" }> = [
    { label: "Published products", value: v(data?.publishedProducts ?? 0), cls: "green" },
    { label: "Draft products", value: v(data?.draftProducts ?? 0), cls: "yellow" },
    { label: "Pending orders", value: loading ? "—" : String(data?.pendingOrders ?? 0), cls: "blue" },
    { label: "Low stock items", value: loading ? "—" : String(lowStockCount), cls: "red" },
    { label: "Total customers", value: v(data?.totalCustomers ?? 0), cls: "blue" },
  ];

  const maxTopProductRevenue = Math.max(...(data?.topProducts ?? []).map((p) => p.revenuePaise), 1);
  const inventoryStatusRows = (data?.inventory ?? []).slice(0, 6);

  function stockBadge(r: InventoryVariantRow) {
    if (r.stockQuantity === 0) return { label: "Out of Stock", low: true };
    if (r.stockQuantity <= r.lowStockThreshold) return { label: "Low Stock", low: true };
    return { label: "In Stock", low: false };
  }

  function initials(name: string) {
    return name
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w.slice(0, 4).toUpperCase())
      .join("\n");
  }

  const sparkValues = metrics.trend.map((p) => p.value);
  const orderSparkValues = metrics.orderCountTrend.map((p) => p.value);
  const dotColor = (cls: string) =>
    cls === "yellow" ? "var(--a-stat-amber)" : cls === "red" ? "var(--a-stat-red)" : cls === "green" ? "var(--a-stat-green)" : "var(--a-stat-blue)";

  return (
    <div className="bbd-dash">
      <div className="a-page">
        {/* ── Header ── */}
        <div className="a-page-header">
          <div className="a-page-title-group">
            <h1 className="a-page-title">Dashboard</h1>
            <p className="a-page-subtitle">Sales performance, inventory status and key insights.</p>
          </div>
          <DateRangeSelect value={range} onChange={setRange} />
        </div>

        {/* ── 5-up stats — Total Revenue is the hero, everything else is secondary ── */}
        <section className="bbd-stats">
          <Link href="/admin/orders" className="bbd-stat bbd-stat-hero selected">
            <div className="bbd-stat-icon"><IndianRupee /></div>
            <div className="bbd-stat-num">{loading ? "—" : formatPriceINR(metrics.currentRevenue)}</div>
            <div className="bbd-stat-label">Total Revenue</div>
            <ChangeRow pct={metrics.revenueDelta} />
            <Sparkline values={sparkValues} tone="blue" />
          </Link>

          <Link href="/admin/orders" className="bbd-stat">
            <div className="bbd-stat-icon gray"><ShoppingBag /></div>
            <div className="bbd-stat-num">{v(metrics.current.length)}</div>
            <div className="bbd-stat-label">Total Orders</div>
            <ChangeRow pct={metrics.ordersDelta} />
            <Sparkline values={orderSparkValues} tone="gray" />
          </Link>

          <Link href="/admin/customers" className="bbd-stat">
            <div className="bbd-stat-icon green"><Users /></div>
            <div className="bbd-stat-num">{v(data?.totalCustomers ?? 0)}</div>
            <div className="bbd-stat-label">Total Customers</div>
            <div className="bbd-stat-change flat">all-time buyers</div>
          </Link>

          <Link href="/admin/products" className="bbd-stat">
            <div className="bbd-stat-icon green"><Package /></div>
            <div className="bbd-stat-num">{v(data?.totalProducts ?? 0)}</div>
            <div className="bbd-stat-label">Total Products</div>
            <div className="bbd-stat-change green">
              <CheckCircle2 /> {loading ? "—" : (data?.publishedProducts ?? 0)} published
            </div>
            {!loading && (
              <SplitBar
                a={data?.publishedProducts ?? 0}
                b={data?.draftProducts ?? 0}
                colorA="#20d992"
                colorB="#2c4256"
              />
            )}
          </Link>

          <Link href="/admin/inventory" className="bbd-stat">
            <div className="bbd-stat-icon red"><AlertTriangle /></div>
            <div className="bbd-stat-num">{loading ? "—" : lowStockCount}</div>
            <div className="bbd-stat-label">Low Stock Item{lowStockCount === 1 ? "" : "s"}</div>
            <div className={`bbd-stat-change ${outOfStockCount ? "red" : "flat"}`}>
              <AlertTriangle /> {loading ? "—" : outOfStockCount ? `${outOfStockCount} out of stock` : "at or below threshold"}
            </div>
            {!loading && (
              <SplitBar
                a={Math.max(lowStockCount - outOfStockCount, 0)}
                b={outOfStockCount}
                colorA="#ffb72d"
                colorB="#ff6873"
              />
            )}
          </Link>
        </section>

        {/* ── Row 1: Revenue trend / Top products / Inventory ── */}
        <section className="bbd-row1">
          <div className="a-card">
            <div className="a-card-header">
              <h2 className="a-card-title"><TrendingUp style={{ width: 18, height: 18 }} /> Revenue Trend</h2>
              <span style={{ fontSize: 12, color: "var(--a-text-3)" }}>
                {range === "all" ? "All time" : `Last ${range.replace("d", " days")}`}
              </span>
            </div>
            <div className="a-card-body bbd-chart-body">
              <RevenueTrendChart points={metrics.trend} formatValue={(n) => formatPriceINR(n)} height={190} />
            </div>
          </div>

          <div className="a-card">
            <div className="a-card-header">
              <h2 className="a-card-title"><BarChart3 style={{ width: 18, height: 18 }} /> Top Products</h2>
              <Link href="/admin/products" className="a-btn a-btn-ghost a-btn-sm">View all →</Link>
            </div>
            <div className="a-card-body">
              <div className="bbd-list-body">
                {loading && <p className="bbd-empty">Loading…</p>}
                {!loading && (data?.topProducts ?? []).length === 0 && (
                  <p className="bbd-empty">No sales yet.</p>
                )}
                {!loading && (data?.topProducts ?? []).map((p, i) => {
                  const barWidth = Math.round((p.revenuePaise / maxTopProductRevenue) * 100);
                  return (
                    <div key={p.productId || i} className="bbd-product-row">
                      <div className={`bbd-rank${i === 0 ? " one" : ""}`}>{i + 1}</div>
                      <div className="bbd-thumb">
                        {p.imageUrl ? (
                          <Image src={p.imageUrl} alt={p.productName} width={40} height={40} />
                        ) : (
                          initials(p.productName)
                        )}
                      </div>
                      <div className="bbd-p-info">
                        <div className="bbd-p-name">{p.productName}</div>
                        <div className="bbd-p-meta">{p.unitsSold} unit{p.unitsSold !== 1 ? "s" : ""} sold</div>
                        <div className="bbd-p-bar"><i style={{ width: `${barWidth}%` }} /></div>
                      </div>
                      <div className="bbd-p-amount">{formatPriceINR(p.revenuePaise)}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="a-card">
            <div className="a-card-header">
              <h2 className="a-card-title"><Boxes style={{ width: 18, height: 18 }} /> Inventory Status</h2>
              <Link href="/admin/inventory" className="a-btn a-btn-ghost a-btn-sm">View all →</Link>
            </div>
            <div className="a-card-body">
              <div className="bbd-list-body">
                {loading && <p className="bbd-empty">Loading…</p>}
                {!loading && inventoryStatusRows.length === 0 && (
                  <p className="bbd-empty">No inventory yet.</p>
                )}
                {!loading && inventoryStatusRows.map((r) => {
                  const badge = stockBadge(r);
                  return (
                    <div key={r.variantId} className="bbd-inv-row">
                      <div className={`bbd-thumb${r.imageUrl ? "" : " bbd-thumb-icon"}`}>
                        {r.imageUrl ? (
                          <Image src={r.imageUrl} alt={r.productName} width={40} height={40} />
                        ) : (
                          <Package style={{ width: 16, height: 16 }} />
                        )}
                      </div>
                      <div className="bbd-p-info">
                        <div className="bbd-p-name">{r.productName}</div>
                        <div className="bbd-p-meta">{r.variantName}</div>
                      </div>
                      <span className={`bbd-inv-status${badge.low ? " low" : ""}`}>{badge.label}</span>
                      {badge.low && <span className="bbd-inv-count">{r.stockQuantity}</span>}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        {/* ── Row 2: Orders / Sales overview / Store summary ── */}
        <section className="bbd-row2">
          <div className="a-card">
            <div className="a-card-header">
              <h2 className="a-card-title">Recent Orders</h2>
              <Link href="/admin/orders" className="a-btn a-btn-ghost a-btn-sm">
                View all orders <ArrowRight style={{ width: 12, height: 12 }} />
              </Link>
            </div>
            <div className="a-card-body" style={{ paddingTop: 0 }}>
              <div className="a-table-wrap">
                <table className="a-table">
                  <thead>
                    <tr>
                      <th>Order #</th>
                      <th>Customer</th>
                      <th>Date</th>
                      <th>Amount</th>
                      <th>Payment</th>
                      <th>Status</th>
                      <th className="col-actions">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading && (
                      <tr><td colSpan={7} className="bbd-empty">Loading…</td></tr>
                    )}
                    {!loading && (data?.recentOrders ?? []).length === 0 && (
                      <tr><td colSpan={7} className="bbd-empty">No orders yet.</td></tr>
                    )}
                    {!loading && (data?.recentOrders ?? []).map((o) => (
                      <tr key={o.id}>
                        <td style={{ fontFamily: "monospace", fontSize: 12, fontWeight: 600 }}>{o.orderNumber}</td>
                        <td style={{ fontSize: 13 }}>{o.customerName}</td>
                        <td style={{ fontSize: 12, color: "var(--a-text-3)" }}>
                          {new Date(o.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                        </td>
                        <td style={{ fontSize: 13, fontWeight: 600 }}>{formatPriceINR(o.totalPaise)}</td>
                        <td>
                          <span className={`a-badge ${PAYMENT_BADGE[o.paymentStatus] ?? "a-badge-neutral"}`}>
                            {PAYMENT_LABEL[o.paymentStatus] ?? o.paymentStatus}
                          </span>
                        </td>
                        <td>
                          <span className={`a-badge ${STATUS_BADGE[o.status] ?? "a-badge-neutral"}`}>
                            {STATUS_LABEL[o.status] ?? o.status}
                          </span>
                        </td>
                        <td className="col-actions">
                          <Link href={`/admin/orders/${o.id}`} className="a-btn a-btn-ghost a-btn-sm">View</Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="a-card">
            <div className="a-card-header">
              <h2 className="a-card-title"><PieChart style={{ width: 18, height: 18 }} /> Sales Overview</h2>
            </div>
            <div className="a-card-body">
              {metrics.donutSegments.length === 0 ? (
                <p className="bbd-empty">No orders in this period yet.</p>
              ) : (
                <div className="bbd-donut-area">
                  <SalesOverviewDonut
                    segments={metrics.donutSegments}
                    centerValue={String(metrics.current.length)}
                    centerLabel="Orders"
                  />
                </div>
              )}
            </div>
          </div>

          <div className="a-card">
            <div className="a-card-header">
              <h2 className="a-card-title">Store Summary</h2>
            </div>
            <div className="a-card-body">
              <div className="bbd-summary-list">
                {STORE_SUMMARY.map((row) => (
                  <div key={row.label} className={`bbd-summary-row ${row.cls}`}>
                    <span><i className="dot" style={{ background: dotColor(row.cls) }} />{row.label}</span>
                    <b>{row.value}</b>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}