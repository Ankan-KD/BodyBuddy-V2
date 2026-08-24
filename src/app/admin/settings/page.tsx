"use client";

import { useState, useEffect } from "react";
import {
  Settings, Save, RefreshCw, AlertTriangle, Check,
  Store, Bell, Shield, Star, Eye, EyeOff,
} from "lucide-react";
import {
  adminFetchSettings,
  adminSaveSettings,
  adminFetchAllCategories,
} from "@/lib/storeAdminApi";
import type { StoreSettings } from "@/lib/offerTypes";
import type { StoreCategory } from "@/lib/storeTypes";

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<StoreSettings | null>(null);
  const [categories, setCategories] = useState<StoreCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  // Local form state
  const [storeName, setStoreName] = useState("");
  const [storeTagline, setStoreTagline] = useState("");
  const [announcement, setAnnouncement] = useState("");
  const [announcementActive, setAnnouncementActive] = useState(false);
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [featuredCategoryIds, setFeaturedCategoryIds] = useState<string[]>([]);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const [s, cats] = await Promise.all([adminFetchSettings(), adminFetchAllCategories()]);
      setSettings(s);
      setCategories(cats);
      setStoreName(s.storeName);
      setStoreTagline(s.storeTagline);
      setAnnouncement(s.storeAnnouncement);
      setAnnouncementActive(s.storeAnnouncementActive);
      setMaintenanceMode(s.maintenanceMode);
      setFeaturedCategoryIds(s.featuredCategoryIds);
      setLoading(false);
    }
    load();
  }, []);

  function showToast(msg: string, type: "success" | "error" = "success") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    const err = await adminSaveSettings({
      store_name: storeName,
      store_tagline: storeTagline,
      store_announcement: announcement,
      store_announcement_active: String(announcementActive),
      maintenance_mode: String(maintenanceMode),
      featured_category_ids: JSON.stringify(featuredCategoryIds),
    });
    setSaving(false);
    if (err) { setError(err); showToast(err, "error"); return; }
    showToast("Settings saved");
  }

  function toggleFeaturedCategory(id: string) {
    setFeaturedCategoryIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  }

  const topLevel = categories.filter(c => !c.parentId);

  if (loading) {
    return (
      <div className="admin-shell" style={{ minHeight: "100%", background: "var(--a-bg)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div className="a-loading"><RefreshCw style={{ width: 16, height: 16, animation: "spin 1s linear infinite" }} />Loading settings…</div>
      </div>
    );
  }

  return (
    <div className="admin-shell" style={{ minHeight: "100%", background: "var(--a-bg)" }}>
      {toast && (
        <div style={{ position: "fixed", top: 16, right: 16, zIndex: 100, padding: "10px 16px", borderRadius: "var(--a-radius-md)", fontSize: 13, fontWeight: 500, background: toast.type === "success" ? "var(--a-success-bg)" : "var(--a-danger-bg)", color: toast.type === "success" ? "var(--a-success-text)" : "var(--a-danger-text)", border: `1px solid ${toast.type === "success" ? "var(--a-success-border)" : "var(--a-danger-border)"}`, boxShadow: "var(--a-shadow-md)" }}>
          {toast.msg}
        </div>
      )}

      <div style={{ padding: 24, maxWidth: 720 }}>
        <div className="a-page-header">
          <div>
            <div className="a-page-title">Store Settings</div>
            <div className="a-page-subtitle">Control store-wide configuration and behaviour</div>
          </div>
          <button className="a-btn a-btn-primary" onClick={handleSave} disabled={saving}>
            <Save style={{ width: 14, height: 14 }} />
            {saving ? "Saving…" : "Save Settings"}
          </button>
        </div>

        {error && (
          <div className="a-alert a-alert-error" style={{ marginBottom: 16 }}>
            <AlertTriangle style={{ width: 14, height: 14, flexShrink: 0 }} />{error}
          </div>
        )}

        {/* Store Identity */}
        <div className="a-card" style={{ marginBottom: 16 }}>
          <div className="a-card-header">
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div className="a-section-heading-icon"><Store style={{ width: 14, height: 14 }} /></div>
              <span className="a-card-header-title">Store Identity</span>
            </div>
          </div>
          <div style={{ padding: "18px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
            <div className="a-form-field">
              <label className="a-form-label">Store Name</label>
              <input className="a-form-input" value={storeName} onChange={e => setStoreName(e.target.value)} placeholder="BB Store" />
              <span className="a-form-hint">Displayed in the store header and browser tab.</span>
            </div>
            <div className="a-form-field">
              <label className="a-form-label">Tagline</label>
              <input className="a-form-input" value={storeTagline} onChange={e => setStoreTagline(e.target.value)} placeholder="Fuel Your Goals" />
              <span className="a-form-hint">Short motivational line shown on the store home.</span>
            </div>
          </div>
        </div>

        {/* Announcement Banner */}
        <div className="a-card" style={{ marginBottom: 16 }}>
          <div className="a-card-header">
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div className="a-section-heading-icon"><Bell style={{ width: 14, height: 14 }} /></div>
              <span className="a-card-header-title">Announcement Banner</span>
            </div>
            <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13 }}>
              <input type="checkbox" checked={announcementActive} onChange={e => setAnnouncementActive(e.target.checked)} />
              <span style={{ fontWeight: 500, color: "var(--a-text-2)" }}>Show banner</span>
            </label>
          </div>
          <div style={{ padding: "18px 20px" }}>
            <div className="a-form-field">
              <label className="a-form-label">Banner Message</label>
              <input
                className="a-form-input"
                value={announcement}
                onChange={e => setAnnouncement(e.target.value)}
                placeholder="🚀 Free shipping on orders above ₹999!"
                disabled={!announcementActive}
                style={{ opacity: announcementActive ? 1 : 0.5 }}
              />
              <span className="a-form-hint">Shown as a top banner across the entire store when enabled.</span>
            </div>
            {announcementActive && announcement && (
              <div style={{ marginTop: 12, padding: "10px 14px", background: "var(--a-primary-mid)", borderRadius: "var(--a-radius)", fontSize: 13, color: "var(--a-primary-text)", fontWeight: 500 }}>
                Preview: {announcement}
              </div>
            )}
          </div>
        </div>

        {/* Featured Categories */}
        <div className="a-card" style={{ marginBottom: 16 }}>
          <div className="a-card-header">
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div className="a-section-heading-icon"><Star style={{ width: 14, height: 14 }} /></div>
              <span className="a-card-header-title">Featured Categories on Store Home</span>
            </div>
            {featuredCategoryIds.length > 0 && (
              <span className="a-badge a-badge-blue">{featuredCategoryIds.length} selected</span>
            )}
          </div>
          <div style={{ padding: "18px 20px" }}>
            <p style={{ fontSize: 13, color: "var(--a-text-3)", marginBottom: 14 }}>
              Select which top-level categories appear in the featured section on the store home page.
              You can also mark categories as featured from the Categories page.
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 8 }}>
              {topLevel.map(cat => (
                <label
                  key={cat.id}
                  style={{
                    display: "flex", alignItems: "center", gap: 10,
                    padding: "10px 12px", borderRadius: "var(--a-radius)",
                    border: `1px solid ${featuredCategoryIds.includes(cat.id) ? "var(--a-primary)" : "var(--a-border)"}`,
                    background: featuredCategoryIds.includes(cat.id) ? "var(--a-primary-light)" : "var(--a-surface)",
                    cursor: "pointer", fontSize: 13, fontWeight: 500,
                    transition: "all 0.1s",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={featuredCategoryIds.includes(cat.id)}
                    onChange={() => toggleFeaturedCategory(cat.id)}
                  />
                  <span>{cat.name}</span>
                  {!cat.isActive && <span className="a-badge a-badge-neutral" style={{ fontSize: 9, marginLeft: "auto" }}>Hidden</span>}
                </label>
              ))}
              {topLevel.length === 0 && (
                <div style={{ fontSize: 13, color: "var(--a-text-3)" }}>No categories yet. Create categories first.</div>
              )}
            </div>
          </div>
        </div>

        {/* Maintenance Mode */}
        <div className="a-card" style={{ marginBottom: 16 }}>
          <div className="a-card-header">
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div className="a-section-heading-icon" style={{ background: maintenanceMode ? "var(--a-danger-bg)" : "var(--a-primary-mid)" }}>
                <Shield style={{ width: 14, height: 14, color: maintenanceMode ? "var(--a-danger)" : "var(--a-primary)" }} />
              </div>
              <span className="a-card-header-title">Maintenance Mode</span>
            </div>
          </div>
          <div style={{ padding: "18px 20px", display: "flex", alignItems: "flex-start", gap: 16 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={maintenanceMode}
                onChange={e => setMaintenanceMode(e.target.checked)}
              />
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: maintenanceMode ? "var(--a-danger-text)" : "var(--a-text-2)" }}>
                  {maintenanceMode ? "Store is in maintenance mode" : "Store is live"}
                </div>
                <div style={{ fontSize: 12, color: "var(--a-text-3)", marginTop: 3 }}>
                  When enabled, customers see a maintenance page instead of the store. Admin access is unaffected.
                </div>
              </div>
            </label>
            {maintenanceMode && (
              <div className="a-badge a-badge-red" style={{ marginLeft: "auto", flexShrink: 0 }}>⚠ Store offline</div>
            )}
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button className="a-btn a-btn-primary a-btn-lg" onClick={handleSave} disabled={saving}>
            <Save style={{ width: 15, height: 15 }} />
            {saving ? "Saving…" : "Save All Settings"}
          </button>
        </div>
      </div>
    </div>
  );
}
