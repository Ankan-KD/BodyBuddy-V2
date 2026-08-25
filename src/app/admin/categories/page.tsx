"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Plus, Search, Tag, Edit2, Trash2, RefreshCw,
  ChevronRight, Eye, EyeOff, Star, StarOff,
  ArrowUp, ArrowDown, X, AlertTriangle,
} from "lucide-react";
import {
  adminFetchAllCategories,
  adminCreateCategory,
  adminUpdateCategory,
  adminDeleteCategory,
  adminReorderCategories,
  type CategoryUpsertPayload,
} from "@/lib/storeAdminApi";
import type { StoreCategory } from "@/lib/storeTypes";

const ICON_OPTIONS = [
  "Tag", "Dumbbell", "Flame", "Leaf", "Pill", "Zap",
  "Apple", "Heart", "Droplets", "Moon", "Activity", "ShoppingBag",
  "Star", "Award", "Coffee", "Wind", "Layers", "Box",
  "Shield", "Truck", "Globe", "Cpu", "Scale",
];

const EMPTY_FORM: CategoryUpsertPayload = {
  parent_id: null,
  slug: "",
  name: "",
  description: "",
  icon_key: "Tag",
  image_url: null,
  sort_order: 0,
  is_active: true,
  is_featured: false,
};

function slugify(str: string): string {
  return str.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function CategoryFormModal({
  initial,
  topLevel,
  onSave,
  onCancel,
  saving,
  error,
  isEdit,
  editingId,
}: {
  initial: Partial<CategoryUpsertPayload>;
  topLevel: StoreCategory[];
  onSave: (p: CategoryUpsertPayload) => Promise<void>;
  onCancel: () => void;
  saving: boolean;
  error: string | null;
  isEdit?: boolean;
  editingId?: string;
}) {
  const [form, setForm] = useState<CategoryUpsertPayload>({ ...EMPTY_FORM, ...initial });
  const [slugManual, setSlugManual] = useState(!!initial.slug);

  function set(k: keyof CategoryUpsertPayload, v: unknown) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  return (
    <div style={{ position:"fixed",inset:0,zIndex:60,background:"rgba(15,23,42,0.50)",display:"flex",alignItems:"center",justifyContent:"center",padding:16 }}>
      <div className="admin-shell" style={{ background:"var(--a-surface)",borderRadius:"var(--a-radius-lg)",border:"1px solid var(--a-border)",boxShadow:"var(--a-shadow-md)",width:"100%",maxWidth:540,maxHeight:"90vh",display:"flex",flexDirection:"column",overflow:"hidden" }}>
        {/* Modal header */}
        <div style={{ padding:"16px 20px",borderBottom:"1px solid var(--a-border)",display:"flex",alignItems:"center",justifyContent:"space-between",background:"var(--a-surface-2)" }}>
          <div style={{ fontWeight:700,fontSize:15,color:"var(--a-text)" }}>{isEdit ? "Edit Category" : "New Category"}</div>
          <button className="a-btn a-btn-ghost a-btn-icon a-btn-sm" onClick={onCancel}><X style={{width:15,height:15}} /></button>
        </div>

        {/* Modal body */}
        <div style={{ flex:1,overflowY:"auto",padding:"20px 20px 8px",display:"flex",flexDirection:"column",gap:14 }}>
          {error && (
            <div className="a-alert a-alert-error">
              <AlertTriangle style={{width:14,height:14,flexShrink:0}} />{error}
            </div>
          )}

          <div className="a-form-field">
            <label className="a-form-label">Belongs Under</label>
            <select className="a-form-input" value={form.parent_id??""} onChange={e=>set("parent_id",e.target.value||null)}>
              <option value="">— Standalone Category —</option>
              {topLevel.filter(c=>c.id!==editingId).map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          <div className="a-form-field">
            <label className="a-form-label">Name *</label>
            <input required className="a-form-input" placeholder="e.g. Protein Supplements" value={form.name}
              onChange={e=>{set("name",e.target.value);if(!slugManual)set("slug",slugify(e.target.value));}} />
          </div>

          <div className="a-form-field">
            <label className="a-form-label">Slug *</label>
            <input required className="a-form-input" placeholder="protein-supplements" value={form.slug}
              onChange={e=>{setSlugManual(true);set("slug",slugify(e.target.value));}} />
            <span className="a-form-hint">URL-safe identifier. Auto-generated from name.</span>
          </div>

          <div className="a-form-field">
            <label className="a-form-label">Description</label>
            <textarea className="a-form-input" rows={2} placeholder="Short description" value={form.description} onChange={e=>set("description",e.target.value)} />
          </div>

          <div className="a-form-field">
            <label className="a-form-label">Icon</label>
            <select className="a-form-input" value={form.icon_key} onChange={e=>set("icon_key",e.target.value)}>
              {ICON_OPTIONS.map(k=><option key={k} value={k}>{k}</option>)}
            </select>
          </div>

          <div className="a-form-field">
            <label className="a-form-label">Image URL</label>
            <input className="a-form-input" placeholder="https://…" value={form.image_url??""} onChange={e=>set("image_url",e.target.value||null)} />
          </div>

          <div className="a-form-field">
            <label className="a-form-label">Sort Order</label>
            <input type="number" className="a-form-input" value={form.sort_order} onChange={e=>set("sort_order",Number(e.target.value))} min={0} />
            <span className="a-form-hint">Lower = displayed first.</span>
          </div>

          <div style={{ display:"flex",gap:24,flexWrap:"wrap",paddingBottom:4 }}>
            <label style={{ display:"flex",alignItems:"center",gap:8,cursor:"pointer",fontSize:13 }}>
              <input type="checkbox" checked={form.is_active} onChange={e=>set("is_active",e.target.checked)} />
              <span style={{color:"var(--a-text-2)",fontWeight:500}}>Active (visible to customers)</span>
            </label>
            <label style={{ display:"flex",alignItems:"center",gap:8,cursor:"pointer",fontSize:13 }}>
              <input type="checkbox" checked={form.is_featured??false} onChange={e=>set("is_featured",e.target.checked)} />
              <span style={{color:"var(--a-text-2)",fontWeight:500}}>Featured on Store Home</span>
            </label>
          </div>
        </div>

        {/* Modal footer */}
        <div style={{ padding:"14px 20px",borderTop:"1px solid var(--a-border)",display:"flex",justifyContent:"flex-end",gap:8,background:"var(--a-surface-2)" }}>
          <button className="a-btn a-btn-secondary" onClick={onCancel}>Cancel</button>
          <button className="a-btn a-btn-primary" disabled={saving||!form.name||!form.slug} onClick={()=>onSave(form)}>
            {saving?"Saving…":isEdit?"Save Changes":"Create Category"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AdminCategoriesPage() {
  const [categories, setCategories] = useState<StoreCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingCategory, setEditingCategory] = useState<StoreCategory|null>(null);
  const [formSaving, setFormSaving] = useState(false);
  const [formError, setFormError] = useState<string|null>(null);
  const [deleteId, setDeleteId] = useState<string|null>(null);
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState<{msg:string;type:"success"|"error"}|null>(null);

  const load = useCallback(async()=>{
    setLoading(true);
    const data = await adminFetchAllCategories();
    setCategories(data);
    setLoading(false);
  },[]);

  useEffect(()=>{load();},[load]);

  function showToast(msg:string,type:"success"|"error"="success"){
    setToast({msg,type});
    setTimeout(()=>setToast(null),3000);
  }

  const topLevel = categories.filter(c=>!c.parentId);

  const filtered = categories.filter(c=>
    !search||c.name.toLowerCase().includes(search.toLowerCase())||c.slug.includes(search.toLowerCase())
  );

  const tree = topLevel
    .sort((a,b)=>a.sortOrder-b.sortOrder)
    .map(parent=>({
      ...parent,
      children: categories.filter(c=>c.parentId===parent.id).sort((a,b)=>a.sortOrder-b.sortOrder),
    }));

  async function handleSave(payload: CategoryUpsertPayload){
    setFormSaving(true);setFormError(null);
    if(editingCategory){
      const{error}=await adminUpdateCategory(editingCategory.id,payload);
      if(error){setFormError(error);setFormSaving(false);return;}
      showToast("Category updated");
    } else {
      const{error}=await adminCreateCategory(payload);
      if(error){setFormError(error);setFormSaving(false);return;}
      showToast("Category created");
    }
    setFormSaving(false);setShowForm(false);setEditingCategory(null);load();
  }

  async function handleToggleActive(cat:StoreCategory){
    await adminUpdateCategory(cat.id,{is_active:!cat.isActive});
    showToast(cat.isActive?"Category hidden":"Category activated");
    load();
  }

  async function handleToggleFeatured(cat:StoreCategory){
    const current=(cat as any).isFeatured??false;
    await adminUpdateCategory(cat.id,{is_featured:!current});
    showToast(!current?"Marked as featured":"Removed from featured");
    load();
  }

  async function handleMove(cat:StoreCategory,dir:"up"|"down",siblings:StoreCategory[]){
    const sorted=[...siblings].sort((a,b)=>a.sortOrder-b.sortOrder);
    const idx=sorted.findIndex(c=>c.id===cat.id);
    const swapIdx=dir==="up"?idx-1:idx+1;
    if(swapIdx<0||swapIdx>=sorted.length)return;
    const swap=sorted[swapIdx];
    await adminReorderCategories([{id:cat.id,sort_order:swap.sortOrder},{id:swap.id,sort_order:cat.sortOrder}]);
    load();
  }

  async function handleDelete(){
    if(!deleteId)return;
    setDeleting(true);
    const err=await adminDeleteCategory(deleteId);
    setDeleting(false);setDeleteId(null);
    if(err){showToast(err,"error");return;}
    showToast("Category deleted");load();
  }

  function openEdit(cat:StoreCategory){setEditingCategory(cat);setFormError(null);setShowForm(true);}
  function openNew(){setEditingCategory(null);setFormError(null);setShowForm(true);}

  return (
    <div className="a-page">
      {/* Toast */}
      {toast&&(
        <div style={{position:"fixed",top:16,right:16,zIndex:100,padding:"10px 16px",borderRadius:"var(--a-radius-md)",fontSize:13,fontWeight:500,background:toast.type==="success"?"var(--a-success-bg)":"var(--a-danger-bg)",color:toast.type==="success"?"var(--a-success-text)":"var(--a-danger-text)",border:`1px solid ${toast.type==="success"?"var(--a-success-border)":"var(--a-danger-border)"}`,boxShadow:"var(--a-shadow-md)"}}>
          {toast.msg}
        </div>
      )}

      {showForm&&(
        <CategoryFormModal
          initial={editingCategory?{parent_id:editingCategory.parentId,slug:editingCategory.slug,name:editingCategory.name,description:editingCategory.description,icon_key:editingCategory.iconKey,image_url:editingCategory.imageUrl,sort_order:editingCategory.sortOrder,is_active:editingCategory.isActive,is_featured:(editingCategory as any).isFeatured??false}:{}}
          topLevel={topLevel}
          onSave={handleSave}
          onCancel={()=>{setShowForm(false);setEditingCategory(null);setFormError(null);}}
          saving={formSaving}
          error={formError}
          isEdit={!!editingCategory}
          editingId={editingCategory?.id}
        />
      )}

      {deleteId&&(
        <div style={{position:"fixed",inset:0,zIndex:60,background:"rgba(15,23,42,0.50)",display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
          <div className="admin-shell" style={{background:"var(--a-surface)",borderRadius:"var(--a-radius-lg)",border:"1px solid var(--a-border)",padding:"24px 28px",maxWidth:400,width:"100%",boxShadow:"var(--a-shadow-md)"}}>
            <div style={{fontSize:15,fontWeight:700,marginBottom:8,color:"var(--a-text)"}}>Delete category?</div>
            <p style={{fontSize:13,color:"var(--a-text-3)",marginBottom:24,lineHeight:1.6}}>Products in this Category will become uncategorised. Any Sub-Categories under it will also be affected.</p>
            <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
              <button className="a-btn a-btn-secondary" onClick={()=>setDeleteId(null)}>Cancel</button>
              <button className="a-btn a-btn-danger-solid" onClick={handleDelete} disabled={deleting}>{deleting?"Deleting…":"Delete"}</button>
            </div>
          </div>
        </div>
      )}

      {/* Page header */}
      <div className="a-page-header">
        <div>
          <div className="a-page-title">Categories</div>
          <div className="a-page-subtitle">
            Manage the Categories customers browse on the storefront — {categories.length} total. For fine-grained product types (e.g. &quot;Whey Protein&quot;), use the <strong>Type</strong> field on each product.
          </div>
        </div>
        <button className="a-btn a-btn-primary" onClick={openNew}>
          <Plus style={{width:15,height:15}} /> New Category
        </button>
      </div>

      {/* Filter bar */}
      <div className="a-filter-bar">
        <div className="a-search-wrap" style={{maxWidth:300}}>
          <Search />
          <input className="a-search-input" placeholder="Search categories…" value={search} onChange={e=>setSearch(e.target.value)} />
        </div>
        <button className="a-btn a-btn-secondary a-btn-sm" onClick={load} title="Refresh">
          <RefreshCw style={{width:13,height:13}} /> Refresh
        </button>
      </div>

      {/* Table card */}
      <div className="a-card">
        {loading?(
          <div className="a-loading"><RefreshCw style={{width:16,height:16,animation:"spin 1s linear infinite"}} />Loading…</div>
        ):filtered.length===0?(
          <div className="a-empty">
            <div className="a-empty-icon"><Tag /></div>
            <div className="a-empty-title">No categories found</div>
            <div className="a-empty-sub">{search?"Try a different search.":"Create your first category."}</div>
            {!search&&<button className="a-btn a-btn-primary" onClick={openNew}><Plus style={{width:14,height:14}} /> New Category</button>}
          </div>
        ):(
          <div className="a-table-wrap">
            <table className="a-table">
              <thead>
                <tr>
                  <th style={{minWidth:200}}>Category</th>
                  <th>Slug</th>
                  <th>Icon</th>
                  <th>Status</th>
                  <th>Featured</th>
                  <th style={{textAlign:"center"}}>Order</th>
                  {/* Actions column — fixed width, never squishes */}
                  <th className="col-actions">Actions</th>
                </tr>
              </thead>
              <tbody>
                {tree.map(parent=>(
                  <React.Fragment key={parent.id}>
                    {/* ── Parent row ── */}
                    <tr style={{background:"var(--a-surface-2)"}}>
                      <td>
                        <div style={{display:"flex",alignItems:"center",gap:10}}>
                          <div style={{width:32,height:32,borderRadius:"var(--a-radius)",background:"var(--a-primary-mid)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                            <Tag style={{width:14,height:14,color:"var(--a-primary)"}} />
                          </div>
                          <div>
                            <div style={{fontWeight:600,fontSize:13,color:"var(--a-text)"}}>{parent.name}</div>
                            {parent.description&&<div style={{fontSize:11,color:"var(--a-text-3)",maxWidth:220,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{parent.description}</div>}
                          </div>
                        </div>
                      </td>
                      <td><span className="a-badge a-badge-neutral" style={{fontSize:10,fontFamily:"monospace"}}>{parent.slug}</span></td>
                      <td><span style={{fontSize:12,color:"var(--a-text-3)"}}>{parent.iconKey}</span></td>
                      <td>
                        {parent.isActive
                          ? <span className="a-badge a-badge-green">Active</span>
                          : <span className="a-badge a-badge-neutral">Hidden</span>}
                      </td>
                      <td>
                        {(parent as any).isFeatured
                          ? <span className="a-badge a-badge-yellow">⭐ Featured</span>
                          : <span style={{color:"var(--a-text-4)",fontSize:12}}>—</span>}
                      </td>
                      <td style={{textAlign:"center"}}>
                        <span style={{fontSize:12,color:"var(--a-text-3)",fontWeight:500}}>{parent.sortOrder}</span>
                      </td>
                      <td className="col-actions">
                        <div className="a-row-actions">
                          {/* Reorder group */}
                          <button className="a-row-btn" onClick={()=>handleMove(parent,"up",topLevel)} title="Move up">
                            <ArrowUp style={{width:13,height:13}} />
                          </button>
                          <button className="a-row-btn" onClick={()=>handleMove(parent,"down",topLevel)} title="Move down">
                            <ArrowDown style={{width:13,height:13}} />
                          </button>

                          <span className="a-row-actions-sep" />

                          {/* Visibility */}
                          <button className="a-row-btn" onClick={()=>handleToggleActive(parent)} title={parent.isActive?"Hide":"Show"}>
                            {parent.isActive ? <EyeOff style={{width:13,height:13}} /> : <Eye style={{width:13,height:13}} />}
                          </button>
                          {/* Featured */}
                          <button className="a-row-btn" onClick={()=>handleToggleFeatured(parent)} title="Toggle featured">
                            {(parent as any).isFeatured ? <StarOff style={{width:13,height:13}} /> : <Star style={{width:13,height:13}} />}
                          </button>

                          <span className="a-row-actions-sep" />

                          {/* Edit */}
                          <button className="a-row-btn" onClick={()=>openEdit(parent)} title="Edit">
                            <Edit2 style={{width:13,height:13}} />
                          </button>
                          {/* Delete */}
                          <button className="a-row-btn a-row-btn-danger" onClick={()=>setDeleteId(parent.id)} title="Delete">
                            <Trash2 style={{width:13,height:13}} />
                          </button>
                        </div>
                      </td>
                    </tr>

                    {/* ── Child rows ── */}
                    {parent.children.map(child=>(
                      <tr key={child.id}>
                        <td>
                          <div style={{display:"flex",alignItems:"center",gap:8,paddingLeft:28}}>
                            <ChevronRight style={{width:12,height:12,color:"var(--a-text-4)",flexShrink:0}} />
                            <div>
                              <div style={{fontWeight:500,fontSize:13,color:"var(--a-text)"}}>{child.name}</div>
                              {child.description&&<div style={{fontSize:11,color:"var(--a-text-3)",maxWidth:200,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{child.description}</div>}
                            </div>
                          </div>
                        </td>
                        <td><span className="a-badge a-badge-neutral" style={{fontSize:10,fontFamily:"monospace"}}>{child.slug}</span></td>
                        <td><span style={{fontSize:12,color:"var(--a-text-3)"}}>{child.iconKey}</span></td>
                        <td>
                          {child.isActive
                            ? <span className="a-badge a-badge-green">Active</span>
                            : <span className="a-badge a-badge-neutral">Hidden</span>}
                        </td>
                        <td><span style={{color:"var(--a-text-4)",fontSize:12}}>—</span></td>
                        <td style={{textAlign:"center"}}>
                          <span style={{fontSize:12,color:"var(--a-text-3)",fontWeight:500}}>{child.sortOrder}</span>
                        </td>
                        <td className="col-actions">
                          <div className="a-row-actions">
                            <button className="a-row-btn" onClick={()=>handleMove(child,"up",parent.children)} title="Move up">
                              <ArrowUp style={{width:13,height:13}} />
                            </button>
                            <button className="a-row-btn" onClick={()=>handleMove(child,"down",parent.children)} title="Move down">
                              <ArrowDown style={{width:13,height:13}} />
                            </button>

                            <span className="a-row-actions-sep" />

                            <button className="a-row-btn" onClick={()=>handleToggleActive(child)} title={child.isActive?"Hide":"Show"}>
                              {child.isActive ? <EyeOff style={{width:13,height:13}} /> : <Eye style={{width:13,height:13}} />}
                            </button>
                            {/* No "featured" for children — stub keeps columns aligned */}
                            <button className="a-row-btn" disabled style={{opacity:0.25,cursor:"default"}}>
                              <Star style={{width:13,height:13}} />
                            </button>

                            <span className="a-row-actions-sep" />

                            <button className="a-row-btn" onClick={()=>openEdit(child)} title="Edit">
                              <Edit2 style={{width:13,height:13}} />
                            </button>
                            <button className="a-row-btn a-row-btn-danger" onClick={()=>setDeleteId(child.id)} title="Delete">
                              <Trash2 style={{width:13,height:13}} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}