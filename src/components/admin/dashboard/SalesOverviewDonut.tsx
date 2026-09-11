"use client";

// ════════════════════════════════════════════════════════════════════════
// Sales Overview — themed SVG donut chart with a side legend.
// ════════════════════════════════════════════════════════════════════════

export interface DonutSegment {
  label: string;
  value: number;
  color: string;
}

interface Props {
  segments: DonutSegment[];
  centerLabel: string;
  centerValue: string;
}

const SIZE = 168;
const STROKE = 22;
const R = (SIZE - STROKE) / 2;
const CIRC = 2 * Math.PI * R;

export function SalesOverviewDonut({ segments, centerLabel, centerValue }: Props) {
  const total = segments.reduce((s, seg) => s + seg.value, 0);
  let offset = 0;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 22, flexWrap: "wrap" }}>
      <div style={{ position: "relative", width: SIZE, height: SIZE, flexShrink: 0 }}>
        <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} role="img" aria-label="Sales overview donut chart">
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={R}
            fill="none"
            stroke="var(--a-surface-2)"
            strokeWidth={STROKE}
          />
          {total > 0 &&
            segments
              .filter((s) => s.value > 0)
              .map((seg) => {
                const fraction = seg.value / total;
                const dash = fraction * CIRC;
                const dashArray = `${dash} ${CIRC - dash}`;
                const dashOffset = CIRC * 0.25 - offset; // start at 12 o'clock, clockwise
                offset += dash;
                return (
                  <circle
                    key={seg.label}
                    cx={SIZE / 2}
                    cy={SIZE / 2}
                    r={R}
                    fill="none"
                    stroke={seg.color}
                    strokeWidth={STROKE}
                    strokeDasharray={dashArray}
                    strokeDashoffset={dashOffset}
                    transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
                  />
                );
              })}
        </svg>
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <span style={{ fontSize: 18, fontWeight: 700, color: "var(--a-text)", letterSpacing: "-0.02em" }}>
            {centerValue}
          </span>
          <span style={{ fontSize: 11, color: "var(--a-text-3)" }}>{centerLabel}</span>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10, flex: 1, minWidth: 140 }}>
        {segments.map((seg) => {
          const pct = total > 0 ? Math.round((seg.value / total) * 100) : 0;
          return (
            <div key={seg.label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: seg.color,
                  flexShrink: 0,
                }}
              />
              <span style={{ fontSize: 12.5, color: "var(--a-text-2)", flex: 1 }}>{seg.label}</span>
              <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--a-text)" }}>{pct}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
