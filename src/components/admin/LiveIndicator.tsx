// ════════════════════════════════════════════════════════════════════════
// LiveIndicator — small pulsing badge shown in admin pages when
// Supabase Realtime is connected. Shows "LIVE" with a green dot.
// When disconnected, shows "Connecting…" in amber.
// ════════════════════════════════════════════════════════════════════════
"use client";

import React from "react";

interface Props {
  connected: boolean;
  style?: React.CSSProperties;
}

export function LiveIndicator({ connected, style }: Props) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: "0.04em",
        padding: "2px 8px",
        borderRadius: 20,
        userSelect: "none",
        background: connected ? "var(--a-badge-green-bg, #d1fae5)" : "var(--a-badge-orange-bg, #fff3cd)",
        color: connected ? "var(--a-badge-green-fg, #065f46)" : "var(--a-badge-orange-fg, #92400e)",
        border: `1px solid ${connected ? "var(--a-badge-green-border, #6ee7b7)" : "var(--a-badge-orange-border, #fbbf24)"}`,
        ...style,
      }}
      title={connected ? "Real-time updates active" : "Connecting to real-time…"}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: connected ? "#10b981" : "#f59e0b",
          display: "inline-block",
          animation: connected ? "live-pulse 2s ease-in-out infinite" : undefined,
        }}
      />
      {connected ? "LIVE" : "Connecting…"}
      <style>{`
        @keyframes live-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(0.85); }
        }
      `}</style>
    </span>
  );
}
