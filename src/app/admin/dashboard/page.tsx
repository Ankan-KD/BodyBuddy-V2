"use client";

// ════════════════════════════════════════════════════════════════════════
// BB Store Admin — Dashboard v7
// Real period-over-period growth on every headline KPI, previous-period
// overlay on the trend chart, range-aware top products, store-health strip.
// ════════════════════════════════════════════════════════════════════════

import { useEffect, useMemo, useState } from "react";
import {
  Package, ShoppingBag, ArrowRight, IndianRupee, AlertTriangle,
  TrendingUp, TrendingDown, Minus, Users, BarChart3, PieChart, Boxes,
  CheckCircle2, Wallet, Receipt, XCircle, Repeat, Clock, Truck, CreditCard, Store,
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import {
  adminFetchProducts,
  adminFetchOrders,
  adminFetchInventory,
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
  sumCollectedPaise,
  avgOrderValuePaise,
  compareChange,
  buildTrend,
  distinctCustomers,
  newCustomersIn,
  repeatCustomerRate,
  topProductsFrom,
  type Change,
  type TrendMeasure,
} from "@/lib/dashboardMetrics";
import "./dashboard.css";
import { useAdminRealtime } from "@/lib/useAdminRealtime";
import { orderFromRow, type OrderRow } from "@/lib/orderTypes";
import { LiveIndicator } from "@/components/admin/LiveIndicator";

interface DashData {
  totalProducts: number;
  publishedProducts: number;
  draftProducts: number;
  allOrders: StoreOrder[];
  inventory: InventoryVariantRow[];
  inventoryTotal: number;
}

const ORDER_PAGE = 1000;
const ORDER_MAX_PAGES = 10;

/** Pulls every order (paged) so figures never silently cap at 1000. */
async function fetchAllOrders(): Promise<StoreOrder[]> {
  const first = await adminFetchOrders({ limit: ORDER_PAGE, offset: 0 });
  let all = first.orders;
  const pages = Math.min(ORDER_MAX_PAGES, Math.ceil(first.total / ORDER_PAGE));
  if (pages > 1) {
    const rest = await Promise.all(
      Array.from({ length: pages - 1 }, (_, i) =>
        adminFetchOrders({ limit: ORDER_PAGE, offset: (i + 1) * ORDER_PAGE })
      )
    );
    all = all.concat(...rest.map((r) => r.orders));
  }
  return all;
}

const STATUS_BADGE: Record<string, string> = {
  placed: "a-badge-orange", confirmed: "a-badge-blue", processing: "a-badge-purple",
  shipped: "a-badge-indigo", delivered: "a-badge-green", cancelled: "a-badge-red",
};
const STATUS_LABEL: Record<string, string> = {
  placed: "Placed", confirmed: "Confirmed", processing: "Processing",
  shipped: "Shipped", delivered: "Delivered", cancelled: "Cancelled",
};
const PAYMENT_BADGE: Record<string, string> = {
  paid: "a-badge-green", pending: "a-badge-yellow", failed: "a-badge-red", refunded: "a-badge-neutral",
};
const PAYMENT_LABEL: Record<string, string> = {
  paid: "Paid", pending: "Pending", failed: "Failed", refunded: "Refunded",
};
const STATUS_COLORS: Record<string, string> = {
  placed: "#ffb72d", confirmed: "#2785f5", processing: "#a78bfa",
  shipped: "#818cf8", delivered: "#18df8b", cancelled: "#ff4e5a",
};

/** Sparkline — compact inline chart */
function Sparkline({ values, tone = "blue" }: { values: number[]; tone?: "blue" | "green" | "amber" | "red" | "gray" }) {
  if (values.length < 2 || values.every((x) => x === 0)) return null;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  const w = 80, h = 36, pad = 2;
  const pts = values.map((val, i) => {
    const x = pad + (i / (values.length - 1)) * (w - pad * 2);
    const y = pad + (1 - (val - min) / range) * (h - pad * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  return (
    <svg className={`bbd-kpi-spark bbd-spark bbd-spark-${tone}`} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
      <path d={`M${pts.join(" L ")}`} />
    </svg>
  );
}

/**
 * Growth badge. Always says something meaningful:
 *   up/down  → "▲ 24% · +₹3,200 vs previous 30 days"
 *   new      → "▲ New · +₹3,200 (none in previous 30 days)"
 *   flat     → "– No change vs previous 30 days"
 *   none     → "– No activity yet"
 *   alltime  → "All-time total"
 */
function Delta({
  change, fmt, prevLabel, loading,
}: {
  change: Change;
  fmt: (n: number) => string;
  prevLabel: string;
  loading?: boolean;
}) {
  if (loading) return <span className="bbd-kpi-delta flat">&nbsp;</span>;
  const signed = (n: number) => `${n >= 0 ? "+" : "−"}${fmt(Math.abs(n))}`;
  switch (change.state) {
    case "alltime":
      return <span className="bbd-kpi-delta flat"><Minus /> All-time total</span>;
    case "none":
      return <span className="bbd-kpi-delta flat"><Minus /> No activity in this or the {prevLabel}</span>;
    case "new":
      return (
        <span className="bbd-kpi-delta up">
          <TrendingUp /> New · {signed(change.diff)} <span className="bbd-delta-mute">(none in {prevLabel})</span>
        </span>
      );
    case "flat":
      return <span className="bbd-kpi-delta flat"><Minus /> No change vs {prevLabel}</span>;
    default: {
      const up = change.state === "up";
      return (
        <span className={`bbd-kpi-delta ${up ? "up" : "down"}`}>
          {up ? <TrendingUp /> : <TrendingDown />}
          {up ? "+" : ""}{change.pct}% · {signed(change.diff)} <span className="bbd-delta-mute">vs {prevLabel}</span>
        </span>
      );
    }
  }
}

function SplitBar({ a, b, colorA, colorB }: { a: number; b: number; colorA: string; colorB: string }) {
  const total = a + b || 1;
  return (
    <div className="bbd-splitbar">
      <div style={{ width: `${(a / total) * 100}%`, background: colorA }} />
      <div style={{ width: `${(b / total) * 100}%`, background: colorB }} />
    </div>
  );
}

function initials(name: string) {
  return name.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}

function stockBadge(r: InventoryVariantRow): { label: string; cls: "ok" | "warn" | "crit" } {
  if (r.stockQuantity === 0) return { label: "Out of stock", cls: "crit" };
  if (r.stockQuantity <= r.lowStockThreshold) return { label: `Low — ${r.stockQuantity}`, cls: "warn" };
  return { label: "In stock", cls: "ok" };
}

const INV_LIMIT = 25;
const ORDER_LIMIT = 25;

export default function AdminDashboard() {
  const [range, setRange] = useState<DashboardRange>("30d");
  const [measure, setMeasure] = useState<TrendMeasure>("revenue");
  const [data, setData] = useState<DashData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [invTab, setInvTab] = useState<"attention" | "all">("attention");



  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([
      adminFetchProducts({ limit: 1 }),
      adminFetchProducts({ published: true, limit: 1 }),
      adminFetchProducts({ published: false, limit: 1 }),
      fetchAllOrders(),
      adminFetchInventory({ limit: 200 }),
    ])
      .then(([allProds, pubProds, draftProds, allOrders, inventory]) => {
        if (cancelled) return;
        setData({
          totalProducts: allProds.total,
          publishedProducts: pubProds.total,
          draftProducts: draftProds.total,
          allOrders,
          inventory: inventory.rows,
          inventoryTotal: inventory.total,
        });
      })
      .catch((e) => {
        console.error("[AdminDashboard] load failed:", e);
        if (!cancelled) setError("Couldn't load dashboard data. Check your connection and refresh.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  // ── Realtime — patch state in-place, zero page reload ──────────────
  // New order arrives → prepend to allOrders array → metrics recompute via useMemo
  // Order updated  → patch the matching element in allOrders → badge/count updates
  const { connected: rtConnected } = useAdminRealtime<OrderRow>({
    table: "store_orders",
    onInsert: (row) => {
      const order = orderFromRow(row);
      setData((prev) => {
        if (!prev) return prev;
        return { ...prev, allOrders: [order, ...prev.allOrders] };
      });
    },
    onUpdate: (row) => {
      const updated = orderFromRow(row);
      setData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          allOrders: prev.allOrders.map((o) =>
            o.id === updated.id ? { ...o, ...updated } : o
          ),
        };
      });
    },
  });

  // ── Range-aware metrics ─────────────────────────────────────────────
  const m = useMemo(() => {
    const allOrders = data?.allOrders ?? [];
    const win = splitByRange(allOrders, range);
    const { current, previous } = win;

    const revenue = sumRevenuePaise(current);
    const prevRevenue = sumRevenuePaise(previous);
    const aov = avgOrderValuePaise(current);
    const prevAov = avgOrderValuePaise(previous);
    const newCust = newCustomersIn(allOrders, win.currentStart, null);
    const prevNewCust = win.previousStart ? newCustomersIn(allOrders, win.previousStart, win.previousEnd) : 0;

    // Orders KPI counts non-cancelled orders so it matches the chart.
    const live = (os: StoreOrder[]) => os.filter((o) => o.status !== "cancelled").length;
    const ordersCount = live(current);
    const prevOrdersCount = live(previous);

    const cancelled = current.filter((o) => o.status === "cancelled").length;
    const delivered = current.filter((o) => o.status === "delivered").length;

    const donutSegments: DonutSegment[] = (
      ["delivered", "shipped", "processing", "confirmed", "placed", "cancelled"] as const
    )
      .map((status) => ({
        label: STATUS_LABEL[status],
        value: current.filter((o) => o.status === status).length,
        color: STATUS_COLORS[status],
      }))
      .filter((s) => s.value > 0);

    return {
      current, previous,
      revenue, prevRevenue,
      collected: sumCollectedPaise(current),
      revenueChange: compareChange(revenue, prevRevenue, range),
      ordersCount,
      ordersChange: compareChange(ordersCount, prevOrdersCount, range),
      aov,
      aovChange: compareChange(aov, prevAov, range),
      newCust,
      newCustChange: compareChange(newCust, prevNewCust, range),
      revenueTrend: buildTrend(allOrders, range, "revenue"),
      ordersTrend: buildTrend(allOrders, range, "orders"),
      cancelRate: current.length ? Math.round((cancelled / current.length) * 100) : 0,
      fulfilRate: current.length ? Math.round((delivered / current.length) * 100) : 0,
      donutSegments,
      topProducts: topProductsFrom(current, 10),
      pipeline: {
        placed: allOrders.filter((o) => o.status === "placed").length,
        confirmed: allOrders.filter((o) => o.status === "confirmed").length,
        processing: allOrders.filter((o) => o.status === "processing").length,
        shipped: allOrders.filter((o) => o.status === "shipped").length,
        delivered: allOrders.filter((o) => o.status === "delivered").length,
        cancelled: allOrders.filter((o) => o.status === "cancelled").length,
      },
      pendingPaymentPaise: allOrders
        .filter((o) => o.status !== "cancelled" && o.paymentStatus === "pending")
        .reduce((sum, o) => sum + o.totalPaise, 0),
      refundedCount: allOrders.filter((o) => o.paymentStatus === "refunded").length,
      totalCustomers: distinctCustomers(allOrders).size,
      repeatRate: repeatCustomerRate(allOrders),
      awaitingAction: allOrders.filter((o) => o.status === "placed").length,
      paymentIssues: allOrders.filter(
        (o) => o.status !== "cancelled" && (o.paymentStatus === "failed")
      ).length,
    };
  }, [data, range]);

  const inventory = data?.inventory ?? [];
  const lowStockCount = inventory.filter((r) => r.stockQuantity > 0 && r.stockQuantity <= r.lowStockThreshold).length;
  const outOfStockCount = inventory.filter((r) => r.stockQuantity === 0).length;
  const maxTopRev = Math.max(...m.topProducts.map((p) => p.revenuePaise), 1);

  const prevLabel =
    range === "7d" ? "previous 7 days" :
    range === "30d" ? "previous 30 days" :
    range === "90d" ? "previous 90 days" : "previous period";
  const rangeLabel =
    range === "all" ? "all time" :
    range === "7d" ? "last 7 days" :
    range === "30d" ? "last 30 days" : "last 90 days";

  const num = (n: number) => (loading ? "—" : n.toLocaleString("en-IN"));
  const money = (p: number) => (loading ? "—" : formatPriceINR(p));
  const count = (n: number) => n.toLocaleString("en-IN");

  const trendPoints = measure === "revenue" ? m.revenueTrend : m.ordersTrend;
  const chartFmt = measure === "revenue" ? (n: number) => formatPriceINR(n) : (n: number) => String(Math.round(n));

  // Inventory table rows: worst stock first (API sorts ascending by stock).
  const attentionRows = inventory.filter((r) => r.stockQuantity <= r.lowStockThreshold);
  const invRows = (invTab === "attention" ? attentionRows : inventory).slice(0, INV_LIMIT);
  const invRowsTotal = invTab === "attention" ? attentionRows.length : (data?.inventoryTotal ?? inventory.length);
  const healthyCount = inventory.length - attentionRows.length;

  return (
    <div className="bbd-dash">

      {/* ── Top bar ─────────────────────────────────────────────── */}
      <div className="bbd-topbar">
        <div className="bbd-topbar-left">
          <span className="bbd-dash-title">Store Overview</span>
          <span className="bbd-dash-sub">
            {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <LiveIndicator connected={rtConnected} />
          <DateRangeSelect value={range} onChange={setRange} />
        </div>
      </div>

      {error && <div className="bbd-error">{error}</div>}

      {/* ── Primary KPI rail ────────────────────────────────────── */}
      <div className="bbd-kpi-rail">

        <Link href="/admin/orders" className="bbd-kpi hero" style={{ textDecoration: "none" }}>
          <span className="bbd-kpi-eyebrow"><IndianRupee /> Revenue · {rangeLabel}</span>
          <span className="bbd-kpi-num">{money(m.revenue)}</span>
          <Delta change={m.revenueChange} fmt={formatPriceINR} prevLabel={prevLabel} loading={loading} />
          {range !== "all" && !loading && (
            <span className="bbd-kpi-sub">{prevLabel}: {formatPriceINR(m.prevRevenue)}</span>
          )}
          <Sparkline values={m.revenueTrend.map((t) => t.value)} tone="blue" />
        </Link>

        <Link href="/admin/orders" className="bbd-kpi" style={{ textDecoration: "none" }}>
          <span className="bbd-kpi-eyebrow"><ShoppingBag /> Orders</span>
          <span className="bbd-kpi-num">{num(m.ordersCount)}</span>
          <Delta change={m.ordersChange} fmt={count} prevLabel={prevLabel} loading={loading} />
          {range !== "all" && !loading && (
            <span className="bbd-kpi-sub">Before: {count(m.ordersChange.prev)}</span>
          )}
          <Sparkline values={m.ordersTrend.map((t) => t.value)} tone="blue" />
        </Link>

        <Link href="/admin/orders" className="bbd-kpi" style={{ textDecoration: "none" }}>
          <span className="bbd-kpi-eyebrow"><Receipt /> Avg order value</span>
          <span className="bbd-kpi-num">{money(m.aov)}</span>
          <Delta change={m.aovChange} fmt={formatPriceINR} prevLabel={prevLabel} loading={loading} />
          {range !== "all" && !loading && (
            <span className="bbd-kpi-sub">Before: {formatPriceINR(m.aovChange.prev)}</span>
          )}
        </Link>

        <Link href="/admin/customers" className="bbd-kpi" style={{ textDecoration: "none" }}>
          <span className="bbd-kpi-eyebrow"><Users /> New customers</span>
          <span className="bbd-kpi-num">{num(m.newCust)}</span>
          <Delta change={m.newCustChange} fmt={count} prevLabel={prevLabel} loading={loading} />
          {!loading && <span className="bbd-kpi-sub">{count(m.totalCustomers)} customers in total</span>}
        </Link>
      </div>

      {/* ── Secondary health strip ──────────────────────────────── */}
      <div className="bbd-health">
        <Link href="/admin/orders" className={`bbd-health-tile${m.awaitingAction > 0 ? " attn" : ""}`}>
          <Clock />
          <div><b>{num(m.awaitingAction)}</b><span>Orders to confirm</span></div>
        </Link>
        <Link href="/admin/orders" className="bbd-health-tile">
          <Wallet />
          <div><b>{money(m.collected)}</b><span>Payments received</span></div>
        </Link>
        <Link href="/admin/orders" className={`bbd-health-tile${m.cancelRate >= 15 ? " warn" : ""}`}>
          <XCircle />
          <div><b>{loading ? "—" : `${m.cancelRate}%`}</b><span>Cancellation rate</span></div>
        </Link>
        <div className="bbd-health-tile">
          <Repeat />
          <div><b>{loading ? "—" : `${m.repeatRate}%`}</b><span>Repeat customers</span></div>
        </div>
        <Link href="/admin/products" className="bbd-health-tile">
          <Package />
          <div>
            <b>{num(data?.totalProducts ?? 0)}</b>
            <span>
              <CheckCircle2 style={{ width: 11, height: 11, display: "inline", verticalAlign: "-1px", marginRight: 3, color: "var(--a-stat-green)" }} />
              {loading ? "" : `${data?.publishedProducts ?? 0} live · ${data?.draftProducts ?? 0} draft`}
            </span>
          </div>
        </Link>
        <Link href="/admin/inventory" className={`bbd-health-tile${outOfStockCount > 0 ? " warn" : lowStockCount > 0 ? " attn" : ""}`}>
          <AlertTriangle />
          <div>
            <b>{loading ? "—" : lowStockCount + outOfStockCount}</b>
            <span>{loading ? "" : outOfStockCount + lowStockCount === 0 ? "Stock all good" : `${outOfStockCount} out · ${lowStockCount} low`}</span>
          </div>
          {!loading && <SplitBar a={lowStockCount} b={outOfStockCount} colorA="#ffb72d" colorB="#ff6873" />}
        </Link>
      </div>

      {/* ── Body ────────────────────────────────────────────────── */}
      {/*
        Layout: one CSS Grid, ~2fr / 1fr, three explicit rows (grid areas):
          trend    | top
          orders   | breakdown
          inventory| summary
        All six panels are direct children of .bbd-body — no nested columns.
      */}
      <div className="bbd-body">

        <div className="bbd-panel bbd-area-trend">
          <div className="bbd-panel-head">
            <span className="bbd-panel-title"><TrendingUp /> Growth trend</span>
            <div className="bbd-seg" role="tablist" aria-label="Chart measure">
              <button type="button" role="tab" aria-selected={measure === "revenue"}
                className={measure === "revenue" ? "active" : ""} onClick={() => setMeasure("revenue")}>Revenue</button>
              <button type="button" role="tab" aria-selected={measure === "orders"}
                className={measure === "orders" ? "active" : ""} onClick={() => setMeasure("orders")}>Orders</button>
            </div>
          </div>
          <div className="bbd-chart-body">
            <div className="bbd-chart-meta">
              <span className="bbd-chart-num">
                {loading ? "—" : measure === "revenue" ? formatPriceINR(m.revenue) : count(m.ordersCount)}
              </span>
              <Delta
                change={measure === "revenue" ? m.revenueChange : m.ordersChange}
                fmt={measure === "revenue" ? formatPriceINR : count}
                prevLabel={prevLabel}
                loading={loading}
              />
            </div>
            <RevenueTrendChart
              points={loading ? [] : trendPoints}
              formatValue={chartFmt}
              height={200}
              seriesName={rangeLabel.charAt(0).toUpperCase() + rangeLabel.slice(1)}
              emptyText={loading ? "Loading…" : measure === "revenue" ? "No revenue in this period yet." : "No orders in this period yet."}
            />
          </div>
        </div>

        <div className="bbd-panel bbd-area-top">
          <div className="bbd-panel-head">
            <span className="bbd-panel-title"><BarChart3 /> Top products</span>
            <span style={{ fontSize: 11, color: "var(--a-text-3)" }}>{rangeLabel}</span>
          </div>
          <div className="bbd-top-list bbd-scroll bbd-top-scroll">
            {loading && <p className="bbd-empty">Loading…</p>}
            {!loading && m.topProducts.length === 0 && <p className="bbd-empty">No sales in this period.</p>}
            {!loading && m.topProducts.map((p, i) => {
              const barW = Math.round((p.revenuePaise / maxTopRev) * 100);
              return (
                <div key={p.key} className="bbd-top-row">
                  <span className={`bbd-rank${i === 0 ? " one" : ""}`}>{i + 1}</span>
                  <div className="bbd-thumb">
                    {p.imageUrl
                      ? <Image src={p.imageUrl} alt={p.productName} width={36} height={36} />
                      : initials(p.productName)}
                  </div>
                  <div className="bbd-top-info">
                    <div className="bbd-top-name">{p.productName}</div>
                    <div className="bbd-top-units">{p.unitsSold} sold</div>
                    <div className="bbd-top-bar"><i style={{ width: `${barW}%` }} /></div>
                  </div>
                  <div className="bbd-top-amount">{formatPriceINR(p.revenuePaise)}</div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bbd-panel bbd-area-orders">
          <div className="bbd-panel-head">
            <span className="bbd-panel-title">Recent orders</span>
            <Link href="/admin/orders" className="bbd-panel-action">View all <ArrowRight /></Link>
          </div>
          <div className="bbd-orders-body">
            <div className="a-table-wrap bbd-scroll">
              <table className="a-table">
                <thead>
                  <tr>
                    <th>Order #</th><th>Customer</th><th>Date</th><th>Amount</th>
                    <th>Payment</th><th>Status</th><th style={{ width: 56 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {loading && <tr><td colSpan={7} className="bbd-empty">Loading…</td></tr>}
                  {!loading && (data?.allOrders ?? []).length === 0 && (
                    <tr><td colSpan={7} className="bbd-empty">No orders yet.</td></tr>
                  )}
                  {!loading && (data?.allOrders ?? []).slice(0, ORDER_LIMIT).map((o) => (
                    <tr key={o.id}>
                      <td className="td-num">{o.orderNumber}</td>
                      <td style={{ fontSize: 12.5, color: "var(--a-text)" }}>{o.customerName}</td>
                      <td className="td-date">
                        {new Date(o.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                      </td>
                      <td className="td-amount">{formatPriceINR(o.totalPaise)}</td>
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
                      <td style={{ textAlign: "right" }}>
                        <Link href={`/admin/orders/${o.id}`} className="a-btn a-btn-ghost a-btn-sm" style={{ fontSize: 11 }}>View</Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!loading && (data?.allOrders ?? []).length > 0 && (
              <div className="bbd-foot">
                <span>Showing {Math.min(ORDER_LIMIT, (data?.allOrders ?? []).length)} of {count((data?.allOrders ?? []).length)} orders</span>
                <Link href="/admin/orders" className="bbd-panel-action">See all orders <ArrowRight /></Link>
              </div>
            )}
          </div>
        </div>

        <div className="bbd-panel bbd-area-breakdown">
          <div className="bbd-panel-head">
            <span className="bbd-panel-title"><PieChart /> Order breakdown</span>
            <span style={{ fontSize: 11, color: "var(--a-text-3)" }}>{rangeLabel}</span>
          </div>
          <div className="bbd-donut-wrap">
            {loading && <p className="bbd-empty">Loading…</p>}
            {!loading && m.donutSegments.length === 0 && <p className="bbd-empty">No orders in this period.</p>}
            {!loading && m.donutSegments.length > 0 && (
              <SalesOverviewDonut
                segments={m.donutSegments}
                centerValue={String(m.current.length)}
                centerLabel="Orders"
              />
            )}
          </div>
        </div>

        <div className="bbd-panel bbd-area-inventory">
          <div className="bbd-panel-head">
            <span className="bbd-panel-title"><Boxes /> Inventory</span>
            <div className="bbd-seg" role="tablist" aria-label="Inventory filter">
              <button type="button" role="tab" aria-selected={invTab === "attention"}
                className={invTab === "attention" ? "active" : ""} onClick={() => setInvTab("attention")}>
                Needs restock{!loading && attentionRows.length > 0 ? ` (${attentionRows.length})` : ""}
              </button>
              <button type="button" role="tab" aria-selected={invTab === "all"}
                className={invTab === "all" ? "active" : ""} onClick={() => setInvTab("all")}>All</button>
            </div>
          </div>

          <div className="bbd-inv-stats">
            <div className="crit"><b>{num(outOfStockCount)}</b><span>Out of stock</span></div>
            <div className="warn"><b>{num(lowStockCount)}</b><span>Low stock</span></div>
            <div className="ok"><b>{num(healthyCount)}</b><span>Healthy</span></div>
            <div><b>{num(data?.inventoryTotal ?? 0)}</b><span>Variants tracked</span></div>
          </div>

          <div className="bbd-scroll bbd-inv-scroll">
            {loading && <p className="bbd-empty">Loading…</p>}
            {!loading && invRows.length === 0 && (
              <p className="bbd-empty">
                {invTab === "attention" ? "Everything is stocked above its reorder level. 🎉" : "No inventory yet."}
              </p>
            )}
            {!loading && invRows.length > 0 && (
              <table className="bbd-inv-table">
                <thead>
                  <tr><th>Product</th><th>SKU</th><th>Stock level</th><th style={{ textAlign: "right" }}>Status</th></tr>
                </thead>
                <tbody>
                  {invRows.map((r) => {
                    const badge = stockBadge(r);
                    const cap = Math.max(r.lowStockThreshold * 3, 1);
                    const pct = Math.min(100, Math.round((r.stockQuantity / cap) * 100));
                    return (
                      <tr key={r.variantId}>
                        <td>
                          <div className="bbd-inv-prod">
                            <div className="bbd-thumb">
                              {r.imageUrl
                                ? <Image src={r.imageUrl} alt={r.productName} width={32} height={32} />
                                : <Package style={{ width: 14, height: 14, color: "var(--a-text-4)" }} />}
                            </div>
                            <div className="bbd-inv-info">
                              <div className="bbd-inv-name">{r.productName}</div>
                              <div className="bbd-inv-variant">{r.variantName}</div>
                            </div>
                          </div>
                        </td>
                        <td className="bbd-inv-sku">{r.sku}</td>
                        <td>
                          <div className="bbd-lvl">
                            <div className="bbd-lvl-top">
                              <b>{r.stockQuantity}</b><span>reorder at {r.lowStockThreshold}</span>
                            </div>
                            <div className={`bbd-lvl-bar ${badge.cls}`}><i style={{ width: `${pct}%` }} /></div>
                          </div>
                        </td>
                        <td style={{ textAlign: "right" }}>
                          <span className={`bbd-inv-badge ${badge.cls}`}>{badge.label}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
          {!loading && invRowsTotal > 0 && (
            <div className="bbd-foot">
              <span>Showing {Math.min(INV_LIMIT, invRows.length)} of {count(invRowsTotal)} variants</span>
              <Link href="/admin/inventory" className="bbd-panel-action">See all inventory <ArrowRight /></Link>
            </div>
          )}
        </div>

        <div className="bbd-panel bbd-area-summary">
          <div className="bbd-panel-head">
            <span className="bbd-panel-title"><Store /> Store summary</span>
            <span style={{ fontSize: 11, color: "var(--a-text-3)" }}>live snapshot</span>
          </div>
          <div className="bbd-scroll bbd-sum-scroll">

            <div className="bbd-sum-group">
              <div className="bbd-sum-title"><Truck /> Order pipeline <em>all time</em></div>
              <div className="bbd-pipe-bar">
                {(["placed", "confirmed", "processing", "shipped", "delivered"] as const).map((k) => (
                  <i key={k} style={{ flexGrow: m.pipeline[k], background: STATUS_COLORS[k] }} />
                ))}
              </div>
              {(["placed", "confirmed", "processing", "shipped", "delivered"] as const).map((k) => (
                <Link key={k} href="/admin/orders" className="bbd-sum-row">
                  <span><i className="dot" style={{ background: STATUS_COLORS[k] }} />{STATUS_LABEL[k]}</span>
                  <b>{num(m.pipeline[k])}</b>
                </Link>
              ))}
              <Link href="/admin/orders" className="bbd-sum-row">
                <span><i className="dot" style={{ background: STATUS_COLORS.cancelled }} />Cancelled</span>
                <b>{num(m.pipeline.cancelled)}</b>
              </Link>
            </div>

            <div className="bbd-sum-group">
              <div className="bbd-sum-title"><CreditCard /> Payments</div>
              <div className="bbd-sum-row static"><span><i className="dot" style={{ background: "var(--a-stat-green)" }} />Received · {rangeLabel}</span><b>{money(m.collected)}</b></div>
              <div className="bbd-sum-row static"><span><i className="dot" style={{ background: "var(--a-stat-amber)" }} />Awaiting payment</span><b>{money(m.pendingPaymentPaise)}</b></div>
              <div className="bbd-sum-row static"><span><i className="dot" style={{ background: "var(--a-stat-red)" }} />Failed payments</span><b>{num(m.paymentIssues)}</b></div>
              <div className="bbd-sum-row static"><span><i className="dot" style={{ background: "var(--a-text-4)" }} />Refunded orders</span><b>{num(m.refundedCount)}</b></div>
            </div>

            <div className="bbd-sum-group">
              <div className="bbd-sum-title"><Package /> Catalog</div>
              <Link href="/admin/products" className="bbd-sum-row"><span><i className="dot" style={{ background: "var(--a-stat-green)" }} />Published</span><b>{num(data?.publishedProducts ?? 0)}</b></Link>
              <Link href="/admin/products" className="bbd-sum-row"><span><i className="dot" style={{ background: "var(--a-stat-amber)" }} />Drafts (not visible)</span><b>{num(data?.draftProducts ?? 0)}</b></Link>
              <Link href="/admin/inventory" className="bbd-sum-row"><span><i className="dot" style={{ background: "var(--a-stat-red)" }} />Out-of-stock variants</span><b>{num(outOfStockCount)}</b></Link>
            </div>

            <div className="bbd-sum-group">
              <div className="bbd-sum-title"><Users /> Customers</div>
              <Link href="/admin/customers" className="bbd-sum-row"><span><i className="dot" style={{ background: "var(--a-stat-blue)" }} />Total customers</span><b>{num(m.totalCustomers)}</b></Link>
              <Link href="/admin/customers" className="bbd-sum-row"><span><i className="dot" style={{ background: "var(--a-stat-green)" }} />New · {rangeLabel}</span><b>{num(m.newCust)}</b></Link>
              <div className="bbd-sum-row static"><span><i className="dot" style={{ background: "var(--a-stat-amber)" }} />Repeat buyers</span><b>{loading ? "—" : `${m.repeatRate}%`}</b></div>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}