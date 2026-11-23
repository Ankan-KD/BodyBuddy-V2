"use client";

// ════════════════════════════════════════════════════════════════════════
// Trend chart — themed SVG area chart with previous-period overlay and a
// hover tooltip. Measures its own width so nothing gets stretched.
// ════════════════════════════════════════════════════════════════════════

import { useEffect, useRef, useState } from "react";

interface Point {
  label: string;
  value: number;
  prevValue?: number;
  fullLabel?: string;
}

interface Props {
  points: Point[];
  formatValue: (n: number) => string;
  height?: number;
  emptyText?: string;
  seriesName?: string;
}

function pickLabelIndices(count: number, maxLabels: number): number[] {
  if (count <= maxLabels) return Array.from({ length: count }, (_, i) => i);
  const step = Math.ceil(count / maxLabels);
  const idx: number[] = [];
  for (let i = 0; i < count; i += step) idx.push(i);
  if (idx[idx.length - 1] !== count - 1) idx.push(count - 1);
  return idx;
}

function niceMax(v: number): number {
  if (v <= 0) return 10;
  const magnitude = Math.pow(10, Math.floor(Math.log10(v)));
  const norm = v / magnitude;
  const step = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10;
  return step * magnitude;
}

function smoothPath(pts: [number, number][]): string {
  if (pts.length === 0) return "";
  if (pts.length === 1) return `M ${pts[0][0]},${pts[0][1]}`;
  let d = `M ${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] || p2;
    const cp1x = p1[0] + (p2[0] - p0[0]) / 6;
    const cp1y = p1[1] + (p2[1] - p0[1]) / 6;
    const cp2x = p2[0] - (p3[0] - p1[0]) / 6;
    const cp2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${p2[0]},${p2[1]}`;
  }
  return d;
}

export function RevenueTrendChart({
  points,
  formatValue,
  height = 240,
  emptyText = "No data in this period yet.",
  seriesName = "This period",
}: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(800);
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const update = () => setW(Math.max(280, Math.floor(el.clientWidth)));
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const padL = 10;
  const padR = 12;
  const padT = 14;
  const padB = 26;
  const H = height;

  const hasPrev = points.some((p) => p.prevValue !== undefined);
  const hasData = points.some((p) => p.value > 0);
  const hasPrevData = points.some((p) => (p.prevValue ?? 0) > 0);
  const maxRaw = Math.max(0, ...points.map((p) => Math.max(p.value, p.prevValue ?? 0)));
  const max = niceMax(maxRaw);
  const n = Math.max(points.length, 1);

  const xAt = (i: number) =>
    n === 1 ? (W - padL - padR) / 2 + padL : padL + (i / (n - 1)) * (W - padL - padR);
  const yAt = (v: number) => padT + (1 - v / max) * (H - padT - padB);

  const coords: [number, number][] = points.map((p, i) => [xAt(i), yAt(p.value)]);
  const prevCoords: [number, number][] = points.map((p, i) => [xAt(i), yAt(p.prevValue ?? 0)]);
  const linePath = smoothPath(coords);
  const prevPath = smoothPath(prevCoords);
  const baseY = H - padB;
  const areaPath =
    coords.length > 1
      ? `${linePath} L ${coords[coords.length - 1][0]},${baseY} L ${coords[0][0]},${baseY} Z`
      : "";

  const gridLines = [0, 0.25, 0.5, 0.75, 1];
  const labelIdx = new Set(pickLabelIndices(points.length, Math.max(3, Math.floor(W / 90))));
  const gradId = "a-trend-grad";

  const onMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    if (points.length === 0) return;
    const ratio = (x - padL) / Math.max(1, W - padL - padR);
    const i = Math.round(ratio * (points.length - 1));
    setHover(Math.min(points.length - 1, Math.max(0, i)));
  };

  const hp = hover !== null ? points[hover] : null;
  const tipLeft = hover !== null ? Math.min(Math.max(xAt(hover), 90), W - 90) : 0;

  return (
    <div ref={wrapRef} style={{ width: "100%", position: "relative" }}>
      {hasPrev && (
        <div style={{ display: "flex", gap: 16, fontSize: 11, color: "var(--a-text-3)", marginBottom: 6 }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <i style={{ width: 14, height: 3, borderRadius: 2, background: "var(--a-primary)", display: "inline-block" }} />
            {seriesName}
          </span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <i
              style={{
                width: 14,
                height: 0,
                borderTop: "2px dashed var(--a-text-4)",
                display: "inline-block",
              }}
            />
            Previous period
          </span>
        </div>
      )}

      <svg
        width={W}
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label="Trend chart"
        style={{ display: "block", maxWidth: "100%" }}
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--a-primary)" stopOpacity="0.28" />
            <stop offset="100%" stopColor="var(--a-primary)" stopOpacity="0" />
          </linearGradient>
        </defs>

        {gridLines.map((g) => {
          const y = padT + g * (H - padT - padB);
          const val = max - g * max;
          return (
            <g key={g}>
              <line
                x1={padL}
                x2={W - padR}
                y1={y}
                y2={y}
                stroke="var(--a-border)"
                strokeWidth={1}
                strokeDasharray={g === 1 ? undefined : "3 4"}
              />
              {g !== 1 && (
                <text x={padL} y={y - 5} fontSize={11} fill="var(--a-text-4)" fontFamily="inherit">
                  {formatValue(val)}
                </text>
              )}
            </g>
          );
        })}

        {/* Previous period (dashed) */}
        {hasPrev && hasPrevData && (
          <path
            d={prevPath}
            fill="none"
            stroke="var(--a-text-4)"
            strokeWidth={1.8}
            strokeDasharray="5 4"
            strokeLinecap="round"
            opacity={0.8}
          />
        )}

        {hasData && (
          <>
            {areaPath && <path d={areaPath} fill={`url(#${gradId})`} stroke="none" />}
            <path d={linePath} fill="none" stroke="var(--a-primary)" strokeWidth={2.5} strokeLinecap="round" />
            {coords.map(([x, y], i) =>
              points[i].value > 0 || i === coords.length - 1 ? (
                <circle
                  key={i}
                  cx={x}
                  cy={y}
                  r={i === coords.length - 1 ? 4 : 2.5}
                  fill="var(--a-surface)"
                  stroke="var(--a-primary)"
                  strokeWidth={2}
                />
              ) : null
            )}
          </>
        )}

        {hover !== null && (
          <g>
            <line x1={xAt(hover)} x2={xAt(hover)} y1={padT} y2={baseY} stroke="var(--a-border-strong)" strokeWidth={1} />
            <circle cx={xAt(hover)} cy={yAt(points[hover].value)} r={5} fill="var(--a-primary)" stroke="var(--a-surface)" strokeWidth={2} />
          </g>
        )}

        {points.map((p, i) =>
          labelIdx.has(i) ? (
            <text
              key={i}
              x={xAt(i)}
              y={H - 8}
              fontSize={11}
              fill="var(--a-text-4)"
              textAnchor={i === 0 ? "start" : i === points.length - 1 ? "end" : "middle"}
              fontFamily="inherit"
            >
              {p.label}
            </text>
          ) : null
        )}
      </svg>

      {hp && (
        <div
          style={{
            position: "absolute",
            top: hasPrev ? 28 : 8,
            left: tipLeft,
            transform: "translateX(-50%)",
            background: "var(--a-surface-3)",
            border: "1px solid var(--a-border-strong)",
            borderRadius: 6,
            padding: "7px 10px",
            fontSize: 11.5,
            color: "var(--a-text)",
            pointerEvents: "none",
            whiteSpace: "nowrap",
            boxShadow: "var(--a-shadow-sm)",
            zIndex: 2,
          }}
        >
          <div style={{ color: "var(--a-text-3)", marginBottom: 3 }}>{hp.fullLabel ?? hp.label}</div>
          <div style={{ fontWeight: 700 }}>{formatValue(hp.value)}</div>
          {hp.prevValue !== undefined && (
            <div style={{ color: "var(--a-text-4)", marginTop: 2 }}>Previous: {formatValue(hp.prevValue)}</div>
          )}
        </div>
      )}

      {!hasData && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            pointerEvents: "none",
          }}
        >
          <p style={{ color: "var(--a-text-3)", fontSize: 13, margin: 0 }}>{emptyText}</p>
        </div>
      )}
    </div>
  );
}
