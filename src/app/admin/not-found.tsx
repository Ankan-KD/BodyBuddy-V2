import Link from "next/link";
import { LayoutDashboard, ShieldX } from "lucide-react";

export default function AdminNotFound() {
  return (
    <div
      style={{
        minHeight: "60vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 20,
        padding: "0 24px",
        textAlign: "center",
      }}
    >
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: 12,
          background: "var(--a-danger-bg)",
          border: "1px solid var(--a-danger-border)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <ShieldX style={{ width: 28, height: 28, color: "var(--a-danger)" }} />
      </div>
      <div>
        <p style={{ fontWeight: 600, fontSize: 17, color: "var(--a-text)", marginBottom: 6 }}>
          Page not found
        </p>
        <p style={{ fontSize: 13, color: "var(--a-text-3)", maxWidth: 280 }}>
          This admin page doesn&apos;t exist or may have been moved.
        </p>
      </div>
      <Link
        href="/admin/dashboard"
        className="a-btn a-btn-primary a-btn-sm"
        style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
      >
        <LayoutDashboard style={{ width: 14, height: 14 }} />
        Go to Dashboard
      </Link>
    </div>
  );
}
