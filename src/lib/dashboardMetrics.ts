// ════════════════════════════════════════════════════════════════════════
// Admin Dashboard — date-range filtering & bucketing helpers.
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

/** Number of days back a range covers, or null for "all time". */
export function rangeDays(range: DashboardRange): number | null {
  if (range === "7d") return 7;
  if (range === "30d") return 30;
  if (range === "90d") return 90;
  return null;
}

/** Orders with createdAt within [start, end] inclusive, revenue-eligible only if excludeCancelled. */
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
}

/**
 * Splits orders into the current selected window and the immediately
 * preceding window of equal length, for period-over-period comparison.
 * Returns previous = [] for "all time" (no meaningful prior period).
 */
export function splitByRange(orders: StoreOrder[], range: DashboardRange): RangeWindow {
  const days = rangeDays(range);
  const now = new Date();
  const todayEnd = new Date(now);
  todayEnd.setHours(23, 59, 59, 999);

  if (days === null) {
    return { current: orders, previous: [] };
  }

  const currentStart = startOfDay(new Date(now.getTime() - (days - 1) * DAY_MS));
  const previousEnd = new Date(currentStart.getTime() - 1);
  const previousStart = startOfDay(new Date(previousEnd.getTime() - (days - 1) * DAY_MS));

  return {
    current: inWindow(orders, currentStart, todayEnd),
    previous: inWindow(orders, previousStart, previousEnd),
  };
}

export function sumRevenuePaise(orders: StoreOrder[]): number {
  return orders.filter((o) => o.status !== "cancelled").reduce((s, o) => s + o.totalPaise, 0);
}

/** Percent change from `prev` to `curr`, or null if `prev` is 0 (undefined growth). */
export function percentDelta(curr: number, prev: number): number | null {
  if (prev <= 0) return curr > 0 ? null : 0;
  return Math.round(((curr - prev) / prev) * 100);
}

export interface TrendPoint {
  label: string;
  value: number;
}

/** Buckets revenue into a chart-ready series, choosing granularity by range span. */
export function buildRevenueTrend(orders: StoreOrder[], range: DashboardRange): TrendPoint[] {
  const now = startOfDay(new Date());
  const eligible = orders.filter((o) => o.status !== "cancelled");

  let spanDays = rangeDays(range);
  if (spanDays === null) {
    if (eligible.length === 0) {
      spanDays = 30;
    } else {
      const earliest = eligible.reduce(
        (min, o) => Math.min(min, startOfDay(new Date(o.createdAt)).getTime()),
        now.getTime()
      );
      spanDays = Math.max(1, Math.round((now.getTime() - earliest) / DAY_MS) + 1);
    }
  }

  const granularity: "day" | "week" | "month" =
    spanDays <= 45 ? "day" : spanDays <= 200 ? "week" : "month";

  const start =
    granularity === "day"
      ? new Date(now.getTime() - (spanDays - 1) * DAY_MS)
      : granularity === "week"
      ? new Date(now.getTime() - (spanDays - 1) * DAY_MS)
      : new Date(now.getTime() - (spanDays - 1) * DAY_MS);

  // Build bucket boundaries.
  const buckets: { start: Date; end: Date; label: string }[] = [];
  if (granularity === "day") {
    for (let d = new Date(start); d <= now; d = new Date(d.getTime() + DAY_MS)) {
      const bStart = startOfDay(d);
      const bEnd = new Date(bStart.getTime() + DAY_MS - 1);
      buckets.push({
        start: bStart,
        end: bEnd,
        label: bStart.toLocaleDateString("en-IN", { day: "numeric", month: "short" }),
      });
    }
  } else if (granularity === "week") {
    for (let d = new Date(start); d <= now; d = new Date(d.getTime() + 7 * DAY_MS)) {
      const bStart = startOfDay(d);
      const bEnd = new Date(Math.min(bStart.getTime() + 7 * DAY_MS - 1, now.getTime() + DAY_MS - 1));
      buckets.push({
        start: bStart,
        end: bEnd,
        label: bStart.toLocaleDateString("en-IN", { day: "numeric", month: "short" }),
      });
    }
  } else {
    const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
    const last = new Date(now.getFullYear(), now.getMonth(), 1);
    while (cursor <= last) {
      const bStart = new Date(cursor);
      const bEnd = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0, 23, 59, 59, 999);
      buckets.push({
        start: bStart,
        end: bEnd,
        label: bStart.toLocaleDateString("en-IN", { month: "short" }),
      });
      cursor.setMonth(cursor.getMonth() + 1);
    }
  }

  return buckets.map((b) => ({
    label: b.label,
    value: eligible
      .filter((o) => {
        const t = new Date(o.createdAt).getTime();
        return t >= b.start.getTime() && t <= b.end.getTime();
      })
      .reduce((s, o) => s + o.totalPaise, 0),
  }));
}

/** Same bucketing as buildRevenueTrend, but counts orders placed per bucket instead of revenue — real data, no fabrication. */
export function buildOrderCountTrend(orders: StoreOrder[], range: DashboardRange): TrendPoint[] {
  const now = startOfDay(new Date());

  let spanDays = rangeDays(range);
  if (spanDays === null) {
    if (orders.length === 0) {
      spanDays = 30;
    } else {
      const earliest = orders.reduce(
        (min, o) => Math.min(min, startOfDay(new Date(o.createdAt)).getTime()),
        now.getTime()
      );
      spanDays = Math.max(1, Math.round((now.getTime() - earliest) / DAY_MS) + 1);
    }
  }

  const granularity: "day" | "week" | "month" =
    spanDays <= 45 ? "day" : spanDays <= 200 ? "week" : "month";

  const start = new Date(now.getTime() - (spanDays - 1) * DAY_MS);

  const buckets: { start: Date; end: Date; label: string }[] = [];
  if (granularity === "day") {
    for (let d = new Date(start); d <= now; d = new Date(d.getTime() + DAY_MS)) {
      const bStart = startOfDay(d);
      const bEnd = new Date(bStart.getTime() + DAY_MS - 1);
      buckets.push({ start: bStart, end: bEnd, label: "" });
    }
  } else if (granularity === "week") {
    for (let d = new Date(start); d <= now; d = new Date(d.getTime() + 7 * DAY_MS)) {
      const bStart = startOfDay(d);
      const bEnd = new Date(Math.min(bStart.getTime() + 7 * DAY_MS - 1, now.getTime() + DAY_MS - 1));
      buckets.push({ start: bStart, end: bEnd, label: "" });
    }
  } else {
    const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
    const last = new Date(now.getFullYear(), now.getMonth(), 1);
    while (cursor <= last) {
      const bStart = new Date(cursor);
      const bEnd = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0, 23, 59, 59, 999);
      buckets.push({ start: bStart, end: bEnd, label: "" });
      cursor.setMonth(cursor.getMonth() + 1);
    }
  }

  return buckets.map((b) => ({
    label: b.label,
    value: orders.filter((o) => {
      const t = new Date(o.createdAt).getTime();
      return t >= b.start.getTime() && t <= b.end.getTime();
    }).length,
  }));
}