"use client";

// ════════════════════════════════════════════════════════════════════════
// Revenue Trend — lightweight themed SVG area chart.
// No charting library dependency; draws directly with CSS custom
// properties so it tracks the admin light/dark theme automatically.
// ════════════════════════════════════════════════════════════════════════

interface Point {
  label: string;
  value: number;
}

interface Props {
  points: Point[];
  formatValue: (n: number) => string;
  height?: number;
}

const W = 920;

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

/** Smooths a polyline into a cubic-bezier path (simple Catmull-Rom → Bezier). */
function smoothPath(pts: [number, number][]): string {
  if (pts.length < 2) return "";
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

export function RevenueTrendChart({ points, formatValue, height = 240 }: Props) {
  const padL = 8;
  const padR = 8;
  const padT = 14;
  const padB = 26;
  const H = height;

  const hasData = points.length > 0 && points.some((p) => p.value > 0);
  const max = niceMax(Math.max(...points.map((p) => p.value), 0));
  const n = Math.max(points.length, 1);

  const xAt = (i: number) =>
    n === 1 ? (W - padL - padR) / 2 + padL : padL + (i / (n - 1)) * (W - padL - padR);
  const yAt = (v: number) => padT + (1 - (max === 0 ? 0 : v / max)) * (H - padT - padB);

  const coords: [number, number][] = points.map((p, i) => [xAt(i), yAt(p.value)]);
  const linePath = smoothPath(coords);
  const areaPath =
    coords.length > 0
      ? `${linePath} L ${coords[coords.length - 1][0]},${H - padB} L ${coords[0][0]},${H - padB} Z`
      : "";

  const gridLines = [0, 0.25, 0.5, 0.75, 1];
  const labelIdx = new Set(pickLabelIndices(points.length, 7));
  const gradId = "a-revenue-grad";

  return (
    <div style={{ width: "100%", position: "relative" }}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        height={H}
        preserveAspectRatio="none"
        role="img"
        aria-label="Revenue trend chart"
      >
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--a-primary)" stopOpacity="0.28" />
            <stop offset="100%" stopColor="var(--a-primary)" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Gridlines + y labels */}
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
              <text
                x={padL}
                y={y - 5}
                fontSize={11}
                fill="var(--a-text-4)"
                fontFamily="inherit"
              >
                {g === 1 ? "" : formatValue(val)}
              </text>
            </g>
          );
        })}

        {hasData && (
          <>
            <path d={areaPath} fill={`url(#${gradId})`} stroke="none" />
            <path d={linePath} fill="none" stroke="var(--a-primary)" strokeWidth={2.5} strokeLinecap="round" />
            {coords.map(([x, y], i) => (
              <circle
                key={i}
                cx={x}
                cy={y}
                r={i === coords.length - 1 ? 4 : 2.5}
                fill="var(--a-surface)"
                stroke="var(--a-primary)"
                strokeWidth={2}
              />
            ))}
          </>
        )}

        {/* X labels */}
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
          <p style={{ color: "var(--a-text-muted)", fontSize: 13, margin: 0 }}>
            No revenue in this period yet.
          </p>
        </div>
      )}
    </div>
  );
}
