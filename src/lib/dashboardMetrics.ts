// ════════════════════════════════════════════════════════════════════════
// Admin Dashboard — date-range filtering, growth comparison & bucketing.
// Pure functions, no I/O — operate on orders already fetched by the page.
// ════════════════════════════════════════════════════════════════════════

import type { StoreOrder } from "./orderTypes";
import type { DashboardRange } from "@/components/admin/dashboard/DateRangeSelect";

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfDay(d: Date): Date {
  const c = new Date(d);
  c.setHours(0, 0, 0, 0);
  return c;
}

/** Number of days a range covers, or null for "all time". */
export function rangeDays(range: DashboardRange): number | null {
  if (range === "7d") return 7;
  if (range === "30d") return 30;
  if (range === "90d") return 90;
  return null;
}

function inWindow(orders: StoreOrder[], start: Date, end: Date): StoreOrder[] {
  const s = start.getTime();
  const e = end.getTime();
  return orders.filter((o) => {
    const t = new Date(o.createdAt).getTime();
    return t >= s && t <= e;
  });
}

export interface RangeWindow {
  current: StoreOrder[];
  previous: StoreOrder[];
  /** Window bounds (null for "all time"). */
  currentStart: Date | null;
  previousStart: Date | null;
  previousEnd: Date | null;
}

/**
 * Splits orders into the selected window and the immediately preceding
 * window of equal length, for period-over-period comparison.
 */
export function splitByRange(orders: StoreOrder[], range: DashboardRange): RangeWindow {
  const days = rangeDays(range);
  const now = new Date();
  const todayEnd = new Date(now);
  todayEnd.setHours(23, 59, 59, 999);

  if (days === null) {
    return { current: orders, previous: [], currentStart: null, previousStart: null, previousEnd: null };
  }

  const currentStart = startOfDay(new Date(now.getTime() - (days - 1) * DAY_MS));
  const previousEnd = new Date(currentStart.getTime() - 1);
  const previousStart = startOfDay(new Date(previousEnd.getTime() - (days - 1) * DAY_MS));

  return {
    current: inWindow(orders, currentStart, todayEnd),
    previous: inWindow(orders, previousStart, previousEnd),
    currentStart,
    previousStart,
    previousEnd,
  };
}

// ── Revenue definition ────────────────────────────────────────────────────
// Counts an order's value unless it was cancelled, or its payment failed /
// was refunded. (Pending COD orders still count — that money is expected.)

export function isRevenueOrder(o: StoreOrder): boolean {
  return o.status !== "cancelled" && o.paymentStatus !== "failed" && o.paymentStatus !== "refunded";
}

export function sumRevenuePaise(orders: StoreOrder[]): number {
  return orders.filter(isRevenueOrder).reduce((s, o) => s + o.totalPaise, 0);
}

/** Money actually received (payment_status = paid, not cancelled). */
export function sumCollectedPaise(orders: StoreOrder[]): number {
  return orders
    .filter((o) => o.status !== "cancelled" && o.paymentStatus === "paid")
    .reduce((s, o) => s + o.totalPaise, 0);
}

/** Average order value over revenue-eligible orders (paise), 0 if none. */
export function avgOrderValuePaise(orders: StoreOrder[]): number {
  const eligible = orders.filter(isRevenueOrder);
  if (eligible.length === 0) return 0;
  return Math.round(eligible.reduce((s, o) => s + o.totalPaise, 0) / eligible.length);
}

// ── Growth comparison ─────────────────────────────────────────────────────

export type ChangeState = "up" | "down" | "flat" | "new" | "none" | "alltime";

export interface Change {
  state: ChangeState;
  /** Rounded % change; null when it can't be expressed as a % (new / none / alltime). */
  pct: number | null;
  /** Absolute change (curr − prev), in the metric's own unit. */
  diff: number;
  curr: number;
  prev: number;
}

/**
 * Compares a metric against the previous period.
 * Unlike a bare percentage, this keeps the *reason* a % is missing, so the UI
 * can say "new" (nothing before, something now) instead of a blank/"all time".
 */
export function compareChange(curr: number, prev: number, range: DashboardRange): Change {
  const diff = curr - prev;
  if (range === "all") return { state: "alltime", pct: null, diff, curr, prev };
  if (curr === 0 && prev === 0) return { state: "none", pct: null, diff: 0, curr, prev };
  if (prev === 0) return { state: "new", pct: null, diff, curr, prev };
  const pct = Math.round(((curr - prev) / prev) * 100);
  if (pct === 0) return { state: "flat", pct: 0, diff, curr, prev };
  return { state: pct > 0 ? "up" : "down", pct, diff, curr, prev };
}

/** Kept for backwards compatibility. Returns null when prev is 0. */
export function percentDelta(curr: number, prev: number): number | null {
  if (prev <= 0) return curr > 0 ? null : 0;
  return Math.round(((curr - prev) / prev) * 100);
}

// ── Customers ─────────────────────────────────────────────────────────────

/** Distinct customers (by userId, falling back to email) across the given orders. */
export function distinctCustomers(orders: StoreOrder[]): Set<string> {
  const s = new Set<string>();
  for (const o of orders) s.add(o.userId || o.customerEmail);
  return s;
}

/**
 * Customers whose FIRST order ever falls inside [start, end] — i.e. truly new
 * customers, not just returning ones who ordered again.
 */
export function newCustomersIn(allOrders: StoreOrder[], start: Date | null, end: Date | null): number {
  const first = new Map<string, number>();
  for (const o of allOrders) {
    const key = o.userId || o.customerEmail;
    const t = new Date(o.createdAt).getTime();
    const cur = first.get(key);
    if (cur === undefined || t < cur) first.set(key, t);
  }
  const s = start ? start.getTime() : -Infinity;
  const e = end ? end.getTime() : Infinity;
  let n = 0;
  first.forEach((t) => {
    if (t >= s && t <= e) n += 1;
  });
  return n;
}

/** Share of customers (in the given orders) who ordered 2+ times overall. */
export function repeatCustomerRate(allOrders: StoreOrder[]): number {
  const counts = new Map<string, number>();
  for (const o of allOrders) {
    const key = o.userId || o.customerEmail;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  if (counts.size === 0) return 0;
  let repeat = 0;
  counts.forEach((c) => {
    if (c >= 2) repeat += 1;
  });
  return Math.round((repeat / counts.size) * 100);
}

// ── Trend bucketing ───────────────────────────────────────────────────────

export interface TrendPoint {
  label: string;
  value: number;
  /** Same bucket in the previous period (undefined for "all time"). */
  prevValue?: number;
  /** Full label for tooltips. */
  fullLabel?: string;
}

export type TrendMeasure = "revenue" | "orders";

interface Bucket {
  start: Date;
  end: Date;
  label: string;
  fullLabel: string;
}

function resolveSpan(orders: StoreOrder[], range: DashboardRange): number {
  const days = rangeDays(range);
  if (days !== null) return days;
  const now = startOfDay(new Date());
  if (orders.length === 0) return 30;
  const earliest = orders.reduce(
    (min, o) => Math.min(min, startOfDay(new Date(o.createdAt)).getTime()),
    now.getTime()
  );
  return Math.max(1, Math.round((now.getTime() - earliest) / DAY_MS) + 1);
}

function makeBuckets(spanDays: number): { buckets: Bucket[]; granularity: "day" | "week" | "month" } {
  const now = startOfDay(new Date());
  const granularity: "day" | "week" | "month" =
    spanDays <= 45 ? "day" : spanDays <= 200 ? "week" : "month";
  const start = new Date(now.getTime() - (spanDays - 1) * DAY_MS);
  const buckets: Bucket[] = [];
  const short = (d: Date) => d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });

  if (granularity === "day") {
    for (let d = new Date(start); d <= now; d = new Date(d.getTime() + DAY_MS)) {
      const bStart = startOfDay(d);
      buckets.push({
        start: bStart,
        end: new Date(bStart.getTime() + DAY_MS - 1),
        label: short(bStart),
        fullLabel: bStart.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" }),
      });
    }
  } else if (granularity === "week") {
    for (let d = new Date(start); d <= now; d = new Date(d.getTime() + 7 * DAY_MS)) {
      const bStart = startOfDay(d);
      const bEnd = new Date(bStart.getTime() + 7 * DAY_MS - 1);
      const lastDay = new Date(Math.min(bEnd.getTime(), now.getTime()));
      buckets.push({
        start: bStart,
        end: bEnd,
        label: short(bStart),
        fullLabel: `${short(bStart)} – ${short(lastDay)}`,
      });
    }
  } else {
    const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
    const last = new Date(now.getFullYear(), now.getMonth(), 1);
    while (cursor <= last) {
      const bStart = new Date(cursor);
      buckets.push({
        start: bStart,
        end: new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0, 23, 59, 59, 999),
        label: bStart.toLocaleDateString("en-IN", { month: "short" }),
        fullLabel: bStart.toLocaleDateString("en-IN", { month: "long", year: "numeric" }),
      });
      cursor.setMonth(cursor.getMonth() + 1);
    }
  }
  return { buckets, granularity };
}

function measureOf(orders: StoreOrder[], measure: TrendMeasure): number {
  return measure === "revenue" ? sumRevenuePaise(orders) : orders.filter((o) => o.status !== "cancelled").length;
}

/**
 * Chart-ready series for either revenue or order count. For 7/30/90-day
 * ranges each point also carries `prevValue` — the same slot in the previous
 * period — so the chart can overlay "this period vs last period" (the actual
 * growth picture).
 */
export function buildTrend(
  orders: StoreOrder[],
  range: DashboardRange,
  measure: TrendMeasure
): TrendPoint[] {
  const span = resolveSpan(orders, range);
  const { buckets } = makeBuckets(span);
  const days = rangeDays(range);
  const shift = days !== null ? days * DAY_MS : 0;
  const curStart = buckets.length ? buckets[0].start.getTime() : 0;

  return buckets.map((b) => {
    const value = measureOf(inWindow(orders, b.start, b.end), measure);
    let prevValue: number | undefined;
    if (days !== null) {
      const ps = new Date(b.start.getTime() - shift);
      // clamp so the last (wider) week bucket never reaches into the current window
      const pe = new Date(Math.min(b.end.getTime() - shift, curStart - 1));
      prevValue = measureOf(inWindow(orders, ps, pe), measure);
    }
    return { label: b.label, fullLabel: b.fullLabel, value, prevValue };
  });
}

/** Backwards-compatible wrappers. */
export function buildRevenueTrend(orders: StoreOrder[], range: DashboardRange): TrendPoint[] {
  return buildTrend(orders, range, "revenue");
}
export function buildOrderCountTrend(orders: StoreOrder[], range: DashboardRange): TrendPoint[] {
  return buildTrend(orders, range, "orders");
}

// ── Top products (range-aware, derived from already-fetched order items) ──

export interface RangeTopProduct {
  key: string;
  productName: string;
  imageUrl: string | null;
  unitsSold: number;
  revenuePaise: number;
}

export function topProductsFrom(orders: StoreOrder[], limit = 5): RangeTopProduct[] {
  const map = new Map<string, RangeTopProduct>();
  for (const o of orders) {
    if (!isRevenueOrder(o)) continue;
    for (const it of o.items ?? []) {
      const key = it.productId ?? it.productName;
      let p = map.get(key);
      if (!p) {
        p = { key, productName: it.productName, imageUrl: it.imageUrl, unitsSold: 0, revenuePaise: 0 };
        map.set(key, p);
      }
      p.unitsSold += it.quantity;
      p.revenuePaise += it.lineTotalPaise;
    }
  }
  return Array.from(map.values())
    .sort((a, b) => b.revenuePaise - a.revenuePaise)
    .slice(0, limit);
}
