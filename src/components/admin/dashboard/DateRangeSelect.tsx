"use client";

export type DashboardRange = "7d" | "30d" | "90d" | "all";

const OPTIONS: { key: DashboardRange; label: string }[] = [
  { key: "7d", label: "7 days" },
  { key: "30d", label: "30 days" },
  { key: "90d", label: "90 days" },
  { key: "all", label: "All time" },
];

interface Props {
  value: DashboardRange;
  onChange: (v: DashboardRange) => void;
}

export function DateRangeSelect({ value, onChange }: Props) {
  return (
    <div className="a-range-select" role="tablist" aria-label="Date range">
      {OPTIONS.map((opt) => (
        <button
          key={opt.key}
          type="button"
          role="tab"
          aria-selected={value === opt.key}
          className={`a-range-option${value === opt.key ? " active" : ""}`}
          onClick={() => onChange(opt.key)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
