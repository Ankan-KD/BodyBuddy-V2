"use client";

import { Clock } from "lucide-react";

interface Props {
  section: string;
  phaseNote?: string;
}

export function ComingSoon({ section, phaseNote }: Props) {
  const notes: Record<string, string> = {
    Products:   "Full product management (create, edit, images, pricing, health fields) arrives in Phase 4.",
    Categories: "Category management and visibility controls arrive in Phase 9.",
    Orders:     "Admin order listing, status lifecycle, and fulfillment arrive in Phase 8.",
    Customers:  "Customer management (purchase history, profiles) arrives in Phase 11.",
    Offers:     "Promotional pricing and featured product controls arrive in Phase 9.",
    Inventory:  "Inventory tracking, low-stock alerts, and restocking arrive in Phase 8.",
    Settings:   "Store-level settings and configuration arrive in Phase 9.",
  };

  const note = phaseNote ?? notes[section] ?? `${section} management is coming in a future phase.`;

  return (
    <div className="a-coming-soon" style={{ maxWidth: 400, margin: "0 auto" }}>
      <div style={{
        width: 44, height: 44, borderRadius: 10,
        background: "var(--a-surface-2)", border: "1px solid var(--a-border)",
        display: "flex", alignItems: "center", justifyContent: "center",
        marginBottom: 14,
      }}>
        <Clock style={{ width: 20, height: 20, color: "var(--a-text-3)" }} />
      </div>
      <div className="a-coming-soon-title">{section}</div>
      <p className="a-coming-soon-sub" style={{ marginBottom: 16, maxWidth: 320 }}>{note}</p>
      <div style={{
        width: "100%", maxWidth: 320,
        border: "1.5px dashed var(--a-border)",
        borderRadius: "var(--a-radius)",
        padding: "10px 14px",
        fontSize: 12,
        color: "var(--a-text-3)",
        textAlign: "center",
      }}>
        The admin shell, authentication, and access control are fully live. This section is next.
      </div>
    </div>
  );
}
