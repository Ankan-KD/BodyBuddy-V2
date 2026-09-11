"use client";

// ════════════════════════════════════════════════════════════════════════
// Admin — Product Groups & Product Types
//
// Replaces the old "Categories" page.
//   user_category → Product Group   (broad: "Protein", "Vitamins")
//   category      → Product Type    (fine-grained: "Whey Protein", "Creatine")
//
// Both are fetched from the database. Renaming either cascades to all
// products using that classification. No deletion (would orphan products).
// ════════════════════════════════════════════════════════════════════════

import React, { useState, useEffect, useCallback } from "react";
import {
  Plus, Search, RefreshCw, Edit2, X, Check,
  ChevronRight, AlertTriangle, Info, Layers, Tag,
} from "lucide-react";
import {
  fetchAllProductGroups,
  fetchAllProductTypes,
  createProductGroup,
  updateProductGroup,
  createProductType,
  updateProductType,
  type ProductGroup,
  type ProductType,
} from "@/lib/catalogueAdminApi";

// ── Toast ─────────────────────────────────────────────────────────────────

function Toast({ msg, type }: { msg: string; type: "success" | "error" }) {
  return (
    <div style={{
      position: "fixed", top: 16, right: 16, zIndex: 100, padding: "10px 16px",
      borderRadius: "var(--a-radius-md)", fontSize: 13, fontWeight: 500,
      maxWidth: "calc(100vw - 32px)",
      background: type === "success" ? "var(--a-success-bg)" : "var(--a-danger-bg)",
      color: type === "success" ? "var(--a-success-text)" : "var(--a-danger-text)",
      border: `1px solid ${type === "success" ? "var(--a-success-border)" : "var(--a-danger-border)"}`,
      boxShadow: "var(--a-shadow-md)",
    }}>
      {msg}
    </div>
  );
}

// ── Inline rename form ────────────────────────────────────────────────────

function InlineRenameForm({
  currentName,
  onSave,
  onCancel,
}: {
  currentName: string;
  onSave: (name: string) => Promise<void>;
  onCancel: () => void;
}) {
  const [name, setName] = useState(currentName);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    const trimmed = name.trim();
    if (!trimmed) { setError("Name cannot be empty"); return; }
    setSaving(true);
    setError(null);
    try {
      await onSave(trimmed);
    } catch (e) {
      setError((e as Error).message);
      setSaving(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {error && <div style={{ fontSize: 11, color: "var(--a-danger)" }}>{error}</div>}
      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") onCancel(); }}
          style={{ fontSize: 13, padding: "4px 8px", borderRadius: "var(--a-radius)", border: "1px solid var(--a-primary)", outline: "none", flex: 1 }}
        />
        <button onClick={handleSave} disabled={saving} className="a-btn a-btn-primary a-btn-sm">
          {saving ? <RefreshCw style={{ width: 11, height: 11 }} className="animate-spin" /> : <Check style={{ width: 11, height: 11 }} />}
          Save
        </button>
        <button onClick={onCancel} className="a-btn a-btn-ghost a-btn-icon a-btn-sm">
          <X style={{ width: 11, height: 11 }} />
        </button>
      </div>
    </div>
  );
}

// ── New item form ─────────────────────────────────────────────────────────

function AddForm({
  label,
  onAdd,
  onCancel,
  groupOptions,
}: {
  label: string;
  onAdd: (name: string, groupId?: string) => Promise<void>;
  onCancel: () => void;
  groupOptions?: ProductGroup[];
}) {
  const [name, setName] = useState("");
  const [groupId, setGroupId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAdd() {
    const trimmed = name.trim();
    if (!trimmed) { setError("Name is required"); return; }
    setSaving(true);
    setError(null);
    try {
      await onAdd(trimmed, groupId || undefined);
      onCancel();
    } catch (e) {
      setError((e as Error).message);
      setSaving(false);
    }
  }

  return (
    <div style={{ background: "var(--a-surface-2)", border: "1px solid var(--a-border)", borderRadius: "var(--a-radius)", padding: "12px 14px", marginTop: 8 }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: "var(--a-text)", marginBottom: 10 }}>Add {label}</div>
      {error && <div style={{ fontSize: 11, color: "var(--a-danger)", marginBottom: 8 }}>{error}</div>}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {groupOptions && (
          <select value={groupId} onChange={(e) => setGroupId(e.target.value)} className="a-filter-select" style={{ height: 32 }}>
            <option value="">No Product Group (standalone)</option>
            {groupOptions.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        )}
        <div style={{ display: "flex", gap: 6 }}>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); if (e.key === "Escape") onCancel(); }}
            placeholder={`${label} name…`}
            style={{ fontSize: 13, padding: "6px 10px", borderRadius: "var(--a-radius)", border: "1px solid var(--a-border)", outline: "none", flex: 1 }}
          />
          <button onClick={handleAdd} disabled={saving} className="a-btn a-btn-primary a-btn-sm">
            {saving ? <RefreshCw style={{ width: 11, height: 11 }} className="animate-spin" /> : <Plus style={{ width: 11, height: 11 }} />}
            Add
          </button>
          <button onClick={onCancel} className="a-btn a-btn-ghost a-btn-icon a-btn-sm">
            <X style={{ width: 11, height: 11 }} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────

export default function AdminCategoriesPage() {
  const [groups, setGroups] = useState<ProductGroup[]>([]);
  const [types, setTypes] = useState<ProductType[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  // Inline rename state
  const [renamingGroupId, setRenamingGroupId] = useState<string | null>(null);
  const [renamingTypeId, setRenamingTypeId] = useState<string | null>(null);

  // Add form state
  const [showAddGroup, setShowAddGroup] = useState(false);
  const [showAddType, setShowAddType] = useState(false);

  function showToast(msg: string, type: "success" | "error" = "success") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }

  const load = useCallback(async () => {
    setLoading(true);
    const [g, t] = await Promise.all([fetchAllProductGroups(), fetchAllProductTypes()]);
    setGroups(g);
    setTypes(t);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Group handlers ──────────────────────────────────────────────────────

  async function handleRenameGroup(id: string, name: string) {
    const { error } = await updateProductGroup(id, name);
    if (error) { showToast(error, "error"); throw new Error(error); }
    showToast("Product Group renamed — all products using it are updated");
    setRenamingGroupId(null);
    load();
  }

  async function handleAddGroup(name: string) {
    const { error } = await createProductGroup(name);
    if (error) { showToast(error, "error"); throw new Error(error); }
    showToast("Product Group added");
    setShowAddGroup(false);
    load();
  }

  // ── Type handlers ───────────────────────────────────────────────────────

  async function handleRenameType(id: string, name: string, groupId?: string | null) {
    const { error } = await updateProductType(id, name, groupId);
    if (error) { showToast(error, "error"); throw new Error(error); }
    showToast("Product Type renamed — all products using it are updated");
    setRenamingTypeId(null);
    load();
  }

  async function handleAddType(name: string, groupId?: string) {
    const { error } = await createProductType(name, groupId ?? null);
    if (error) { showToast(error, "error"); throw new Error(error); }
    showToast("Product Type added");
    setShowAddType(false);
    load();
  }

  // ── Filter ──────────────────────────────────────────────────────────────

  const q = search.toLowerCase();
  const filteredGroups = groups.filter((g) => !q || g.name.toLowerCase().includes(q));
  const filteredTypes  = types.filter((t)  => !q || t.name.toLowerCase().includes(q));

  // Build tree: group → its types
  const tree = filteredGroups.map((g) => ({
    ...g,
    types: types.filter((t) => t.productGroupId === g.id),
  }));
  const ungroupedTypes = filteredTypes.filter((t) => !t.productGroupId);

  // Product counts per group/type (derived from types for now)
  const typesPerGroup = (gid: string) => types.filter((t) => t.productGroupId === gid).length;

  return (
    <div className="a-page" style={{ maxWidth: 900 }}>
      {toast && <Toast msg={toast.msg} type={toast.type} />}

      {/* Header */}
      <div className="a-page-header">
        <div>
          <div className="a-page-title">Product Groups &amp; Types</div>
          <div className="a-page-subtitle">
            Manage the two classification levels used across the whole application.
            Renaming here updates all products that use that group or type.
          </div>
        </div>
        <button className="a-btn a-btn-secondary a-btn-icon" onClick={load} title="Refresh">
          <RefreshCw style={{ width: 13, height: 13 }} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      {/* Cascade-rename info */}
      <div className="a-alert a-alert-info" style={{ marginBottom: 16 }}>
        <Info style={{ width: 14, height: 14, flexShrink: 0, marginTop: 1 }} />
        <div style={{ fontSize: 12 }}>
          <strong>Global cascade:</strong> Renaming a Product Group or Product Type updates <em>all products</em> that use it — in the catalogue, in store products, and on the customer-facing storefront. No deletion is allowed to prevent orphaned products.
        </div>
      </div>

      {/* Hierarchy diagram */}
      <div style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 12, color: "var(--a-text-3)", marginBottom: 20, padding: "8px 12px", background: "var(--a-surface-2)", border: "1px solid var(--a-border)", borderRadius: "var(--a-radius)", width: "fit-content" }}>
        <span style={{ fontWeight: 600, color: "var(--a-text-2)" }}>Product Group</span>
        <ChevronRight style={{ width: 12, height: 12 }} />
        <span style={{ fontWeight: 600, color: "var(--a-text-2)" }}>Product Type</span>
        <ChevronRight style={{ width: 12, height: 12 }} />
        <span style={{ fontWeight: 600, color: "var(--a-text-2)" }}>Product</span>
        <span style={{ marginLeft: 8, color: "var(--a-text-4)" }}>e.g.</span>
        <span>Protein → Whey Protein → Maxx Recovery</span>
      </div>

      {/* Search */}
      <div className="a-filter-bar" style={{ marginBottom: 20 }}>
        <div className="a-search-wrap" style={{ maxWidth: 340 }}>
          <Search />
          <input className="a-search-input" placeholder="Search groups and types…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        {search && (
          <button onClick={() => setSearch("")} className="a-btn a-btn-ghost a-btn-sm" style={{ color: "var(--a-danger)" }}>
            <X style={{ width: 12, height: 12 }} /> Clear
          </button>
        )}
      </div>

      {loading ? (
        <div className="a-loading"><RefreshCw style={{ width: 16, height: 16 }} className="animate-spin" />Loading…</div>
      ) : (
        <div className="a-grid-2" style={{ gap: 20 }}>

          {/* ── Product Groups panel ─────────────────────────────────── */}
          <div className="a-card">
            <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--a-border)", display: "flex", alignItems: "center", justifyContent: "space-between", background: "var(--a-surface-2)" }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14, display: "flex", alignItems: "center", gap: 6 }}>
                  <Layers style={{ width: 15, height: 15, color: "var(--a-primary)" }} />
                  Product Groups
                </div>
                <div style={{ fontSize: 11, color: "var(--a-text-3)", marginTop: 2 }}>
                  Broad categories (was: user_category) · {groups.length} total
                </div>
              </div>
              <button onClick={() => setShowAddGroup(true)} className="a-btn a-btn-primary a-btn-sm">
                <Plus style={{ width: 12, height: 12 }} /> Add
              </button>
            </div>

            <div style={{ padding: "12px 16px" }}>
              {showAddGroup && (
                <AddForm label="Product Group" onAdd={handleAddGroup} onCancel={() => setShowAddGroup(false)} />
              )}

              {filteredGroups.length === 0 ? (
                <div className="a-empty" style={{ padding: "24px 0" }}>
                  <div className="a-empty-icon"><Layers style={{ width: 16, height: 16 }} /></div>
                  <div className="a-empty-title" style={{ fontSize: 13 }}>{search ? "No groups match" : "No product groups yet"}</div>
                  {!search && <div className="a-empty-sub" style={{ fontSize: 11 }}>Add groups or import the catalogue CSV to auto-create them.</div>}
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 2, marginTop: showAddGroup ? 12 : 0 }}>
                  {filteredGroups.map((g) => (
                    <div key={g.id} style={{ padding: "10px 12px", borderRadius: "var(--a-radius)", border: "1px solid var(--a-border)", background: renamingGroupId === g.id ? "var(--a-primary-light)" : "var(--a-surface)" }}>
                      {renamingGroupId === g.id ? (
                        <InlineRenameForm
                          currentName={g.name}
                          onSave={(name) => handleRenameGroup(g.id, name)}
                          onCancel={() => setRenamingGroupId(null)}
                        />
                      ) : (
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <div style={{ width: 28, height: 28, borderRadius: "var(--a-radius)", background: "var(--a-primary-mid)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                              <Layers style={{ width: 12, height: 12, color: "var(--a-primary)" }} />
                            </div>
                            <div>
                              <div style={{ fontWeight: 600, fontSize: 13 }}>{g.name}</div>
                              <div style={{ fontSize: 10, color: "var(--a-text-3)" }}>{typesPerGroup(g.id)} type{typesPerGroup(g.id) !== 1 ? "s" : ""}</div>
                            </div>
                          </div>
                          <button
                            onClick={() => setRenamingGroupId(g.id)}
                            className="a-btn a-btn-ghost a-btn-icon a-btn-sm"
                            title="Rename (cascades to all products)"
                          >
                            <Edit2 style={{ width: 12, height: 12 }} />
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ── Product Types panel ──────────────────────────────────── */}
          <div className="a-card">
            <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--a-border)", display: "flex", alignItems: "center", justifyContent: "space-between", background: "var(--a-surface-2)" }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14, display: "flex", alignItems: "center", gap: 6 }}>
                  <Tag style={{ width: 15, height: 15, color: "var(--a-accent)" }} />
                  Product Types
                </div>
                <div style={{ fontSize: 11, color: "var(--a-text-3)", marginTop: 2 }}>
                  Fine-grained types (was: category) · {types.length} total
                </div>
              </div>
              <button onClick={() => setShowAddType(true)} className="a-btn a-btn-primary a-btn-sm">
                <Plus style={{ width: 12, height: 12 }} /> Add
              </button>
            </div>

            <div style={{ padding: "12px 16px", maxHeight: 560, overflowY: "auto" }}>
              {showAddType && (
                <AddForm label="Product Type" onAdd={handleAddType} onCancel={() => setShowAddType(false)} groupOptions={groups} />
              )}

              {/* Grouped by product group */}
              {tree.filter((g) => g.types.length > 0 || filteredGroups.find((fg) => fg.id === g.id)).map((g) => (
                <div key={g.id} style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--a-text-3)", marginBottom: 6, paddingLeft: 4 }}>
                    {g.name}
                  </div>
                  {g.types.length === 0 ? (
                    <div style={{ fontSize: 11, color: "var(--a-text-4)", paddingLeft: 4 }}>No types yet</div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                      {g.types.filter((t) => !q || t.name.toLowerCase().includes(q)).map((t) => (
                        <div key={t.id} style={{ padding: "8px 10px", borderRadius: "var(--a-radius)", border: "1px solid var(--a-border)", background: renamingTypeId === t.id ? "var(--a-primary-light)" : "var(--a-surface)", marginLeft: 8 }}>
                          {renamingTypeId === t.id ? (
                            <InlineRenameForm
                              currentName={t.name}
                              onSave={(name) => handleRenameType(t.id, name, t.productGroupId)}
                              onCancel={() => setRenamingTypeId(null)}
                            />
                          ) : (
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                <ChevronRight style={{ width: 11, height: 11, color: "var(--a-text-4)" }} />
                                <span style={{ fontSize: 12, fontWeight: 500 }}>{t.name}</span>
                              </div>
                              <button
                                onClick={() => setRenamingTypeId(t.id)}
                                className="a-btn a-btn-ghost a-btn-icon a-btn-sm"
                                title="Rename (cascades to all products)"
                              >
                                <Edit2 style={{ width: 11, height: 11 }} />
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}

              {/* Ungrouped types */}
              {ungroupedTypes.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--a-text-3)", marginBottom: 6, paddingLeft: 4 }}>
                    Ungrouped
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    {ungroupedTypes.map((t) => (
                      <div key={t.id} style={{ padding: "8px 10px", borderRadius: "var(--a-radius)", border: "1px solid var(--a-border)", background: renamingTypeId === t.id ? "var(--a-primary-light)" : "var(--a-surface)" }}>
                        {renamingTypeId === t.id ? (
                          <InlineRenameForm
                            currentName={t.name}
                            onSave={(name) => handleRenameType(t.id, name, null)}
                            onCancel={() => setRenamingTypeId(null)}
                          />
                        ) : (
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              <Tag style={{ width: 11, height: 11, color: "var(--a-text-4)" }} />
                              <span style={{ fontSize: 12, fontWeight: 500 }}>{t.name}</span>
                            </div>
                            <button onClick={() => setRenamingTypeId(t.id)} className="a-btn a-btn-ghost a-btn-icon a-btn-sm" title="Rename">
                              <Edit2 style={{ width: 11, height: 11 }} />
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {filteredTypes.length === 0 && !showAddType && (
                <div className="a-empty" style={{ padding: "24px 0" }}>
                  <div className="a-empty-icon"><Tag style={{ width: 16, height: 16 }} /></div>
                  <div className="a-empty-title" style={{ fontSize: 13 }}>{search ? "No types match" : "No product types yet"}</div>
                  {!search && <div className="a-empty-sub" style={{ fontSize: 11 }}>Import the catalogue CSV or add manually.</div>}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* No-deletion notice */}
      <div className="a-alert a-alert-warning" style={{ marginTop: 20 }}>
        <AlertTriangle style={{ width: 14, height: 14, flexShrink: 0, marginTop: 1 }} />
        <div style={{ fontSize: 12 }}>
          <strong>Deletion is disabled</strong> for Product Groups and Product Types to prevent products from losing their classification. Rename instead — the change will propagate everywhere.
        </div>
      </div>
    </div>
  );
}
