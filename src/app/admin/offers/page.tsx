"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Plus, Search, Percent, Edit2, Trash2, RefreshCw,
  ToggleLeft, ToggleRight, X, AlertTriangle, Check,
  Tag, Calendar, Users, ShoppingBag,
} from "lucide-react";
import {
  adminFetchAllOffers,
  adminCreateOffer,
  adminUpdateOffer,
  adminDeleteOffer,
  adminToggleOfferActive,
  adminFetchProducts,
  type OfferUpsertPayload,
} from "@/lib/storeAdminApi";
import type { StoreOffer } from "@/lib/offerTypes";
import { offerLabel, isOfferCurrentlyValid } from "@/lib/offerTypes";
import type { StoreProduct } from "@/lib/storeTypes";
import { formatPriceINR } from "@/lib/storeTypes";

const EMPTY_FORM: OfferUpsertPayload = {
  title: "",
  code: null,
  description: "",
  discount_type: "percentage",
  discount_value: 10,
  is_active: true,
  starts_at: null,
  ends_at: null,
  product_ids: [],
  min_order_paise: null,
  max_uses: null,
};

function OfferFormModal({
  initial,
  allProducts,
  onSave,
  onCancel,
  saving,
  error,
  isEdit,
}: {
  initial: Partial<OfferUpsertPayload>;
  allProducts: StoreProduct[];
  onSave: (p: OfferUpsertPayload) => Promise<void>;
  onCancel: () => void;
  saving: boolean;
  error: string | null;
  isEdit?: boolean;
}) {
  const [form, setForm] = useState<OfferUpsertPayload>({ ...EMPTY_FORM, ...initial });
  const [productSearch, setProductSearch] = useState("");

  function set(k: keyof OfferUpsertPayload, v: unknown) {
    setForm(f => ({ ...f, [k]: v }));
  }

  function toggleProduct(id: string) {
    set("product_ids", form.product_ids.includes(id)
      ? form.product_ids.filter(x => x !== id)
      : [...form.product_ids, id]);
  }

  const filteredProducts = allProducts.filter(p =>
    !productSearch || p.name.toLowerCase().includes(productSearch.toLowerCase())
  );

  const discountDisplay = form.discount_type === "percentage"
    ? `${form.discount_value}% off`
    : `₹${Math.round(Number(form.discount_value) / 100)} off`;

  return (
    <div style={{ position:"fixed",inset:0,zIndex:60,background:"rgba(15,23,42,0.55)",display:"flex",alignItems:"center",justifyContent:"center",padding:16 }}>
      <div style={{ background:"var(--a-surface)",borderRadius:"var(--a-radius-lg)",border:"1px solid var(--a-border)",boxShadow:"var(--a-shadow-md)",width:"100%",maxWidth:600,maxHeight:"92vh",display:"flex",flexDirection:"column",overflow:"hidden" }}>
        
        <div style={{ padding:"16px 20px",borderBottom:"1px solid var(--a-border)",display:"flex",alignItems:"center",justifyContent:"space-between" }}>
          <div style={{ fontWeight:700,fontSize:15 }}>{isEdit?"Edit Offer":"New Offer"}</div>
          <button className="a-btn a-btn-ghost a-btn-icon a-btn-sm" onClick={onCancel}><X style={{width:15,height:15}} /></button>
        </div>

        <div style={{ flex:1,overflowY:"auto",padding:20,display:"flex",flexDirection:"column",gap:16 }}>
          {error && <div className="a-alert a-alert-error"><AlertTriangle style={{width:14,height:14,flexShrink:0}} />{error}</div>}

          {/* Basic Info */}
          <div style={{ display:"flex",flexDirection:"column",gap:12 }}>
            <div style={{ fontSize:12,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.06em",color:"var(--a-text-3)",paddingBottom:8,borderBottom:"1px solid var(--a-border)" }}>
              Basic Info
            </div>

            <div className="a-form-field">
              <label className="a-form-label">Offer Title *</label>
              <input required className="a-form-input" placeholder="e.g. Summer Sale 20% Off" value={form.title} onChange={e=>set("title",e.target.value)} />
            </div>

            <div className="a-form-field">
              <label className="a-form-label">Promo Code <span style={{color:"var(--a-text-4)",fontWeight:400}}>(optional)</span></label>
              <input className="a-form-input" placeholder="e.g. SUMMER20 (leave blank for automatic)" value={form.code??""} onChange={e=>set("code",e.target.value.toUpperCase()||null)} />
              <span className="a-form-hint">Customers enter this code at checkout. Leave blank for auto-applied sitewide discount.</span>
            </div>

            <div className="a-form-field">
              <label className="a-form-label">Description</label>
              <textarea className="a-form-input" rows={2} placeholder="Internal note or customer-facing description" value={form.description} onChange={e=>set("description",e.target.value)} />
            </div>
          </div>

          {/* Discount */}
          <div style={{ display:"flex",flexDirection:"column",gap:12 }}>
            <div style={{ fontSize:12,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.06em",color:"var(--a-text-3)",paddingBottom:8,borderBottom:"1px solid var(--a-border)" }}>
              Discount
            </div>

            <div style={{ display:"flex",gap:12 }}>
              <div className="a-form-field" style={{ flex:1 }}>
                <label className="a-form-label">Discount Type</label>
                <select className="a-form-input" value={form.discount_type} onChange={e=>set("discount_type",e.target.value)}>
                  <option value="percentage">Percentage (%)</option>
                  <option value="fixed_paise">Fixed Amount (₹)</option>
                </select>
              </div>
              <div className="a-form-field" style={{ flex:1 }}>
                <label className="a-form-label">
                  {form.discount_type==="percentage" ? "Discount %" : "Discount Amount (₹)"}
                </label>
                <input
                  type="number" className="a-form-input" min={1}
                  max={form.discount_type==="percentage"?100:undefined}
                  value={form.discount_type==="percentage" ? form.discount_value : Math.round(Number(form.discount_value)/100)}
                  onChange={e=>{
                    const v=Number(e.target.value);
                    set("discount_value", form.discount_type==="percentage" ? v : v*100);
                  }}
                />
              </div>
            </div>
            <div className="a-alert a-alert-info" style={{ padding:"8px 12px" }}>
              Preview: <strong>{discountDisplay}</strong>
            </div>
          </div>

          {/* Validity */}
          <div style={{ display:"flex",flexDirection:"column",gap:12 }}>
            <div style={{ fontSize:12,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.06em",color:"var(--a-text-3)",paddingBottom:8,borderBottom:"1px solid var(--a-border)" }}>
              Validity
            </div>
            <div style={{ display:"flex",gap:12 }}>
              <div className="a-form-field" style={{ flex:1 }}>
                <label className="a-form-label">Start Date <span style={{color:"var(--a-text-4)",fontWeight:400}}>(optional)</span></label>
                <input type="datetime-local" className="a-form-input"
                  value={form.starts_at ? form.starts_at.slice(0,16) : ""}
                  onChange={e=>set("starts_at",e.target.value?new Date(e.target.value).toISOString():null)} />
              </div>
              <div className="a-form-field" style={{ flex:1 }}>
                <label className="a-form-label">End Date <span style={{color:"var(--a-text-4)",fontWeight:400}}>(optional)</span></label>
                <input type="datetime-local" className="a-form-input"
                  value={form.ends_at ? form.ends_at.slice(0,16) : ""}
                  onChange={e=>set("ends_at",e.target.value?new Date(e.target.value).toISOString():null)} />
              </div>
            </div>
            <div style={{ display:"flex",gap:12 }}>
              <div className="a-form-field" style={{ flex:1 }}>
                <label className="a-form-label">Min Order Value (₹) <span style={{color:"var(--a-text-4)",fontWeight:400}}>(optional)</span></label>
                <input type="number" className="a-form-input" min={0}
                  value={form.min_order_paise!=null ? Math.round(form.min_order_paise/100) : ""}
                  onChange={e=>set("min_order_paise",e.target.value?Number(e.target.value)*100:null)} />
              </div>
              <div className="a-form-field" style={{ flex:1 }}>
                <label className="a-form-label">Max Uses <span style={{color:"var(--a-text-4)",fontWeight:400}}>(optional)</span></label>
                <input type="number" className="a-form-input" min={1}
                  value={form.max_uses??""} onChange={e=>set("max_uses",e.target.value?Number(e.target.value):null)} />
              </div>
            </div>
          </div>

          {/* Product Scope */}
          <div style={{ display:"flex",flexDirection:"column",gap:12 }}>
            <div style={{ fontSize:12,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.06em",color:"var(--a-text-3)",paddingBottom:8,borderBottom:"1px solid var(--a-border)" }}>
              Product Scope
            </div>
            <span className="a-form-hint" style={{ marginTop:0 }}>
              Leave all unselected to apply to the entire store. Select specific products to limit scope.
            </span>
            {form.product_ids.length>0&&(
              <div style={{ display:"flex",gap:6,flexWrap:"wrap" }}>
                <span className="a-badge a-badge-blue">{form.product_ids.length} product{form.product_ids.length!==1?"s":""} selected</span>
                <button className="a-btn a-btn-ghost a-btn-sm" style={{height:22,fontSize:11}} onClick={()=>set("product_ids",[])}>Clear all</button>
              </div>
            )}
            <div style={{ border:"1px solid var(--a-border)",borderRadius:"var(--a-radius)",overflow:"hidden" }}>
              <div style={{ padding:"8px 10px",borderBottom:"1px solid var(--a-border)",background:"var(--a-surface-2)" }}>
                <div className="a-search-wrap">
                  <Search />
                  <input className="a-search-input" placeholder="Search products…" value={productSearch} onChange={e=>setProductSearch(e.target.value)} style={{height:30,fontSize:12}} />
                </div>
              </div>
              <div style={{ maxHeight:180,overflowY:"auto" }}>
                {filteredProducts.length===0?(
                  <div style={{ padding:16,textAlign:"center",fontSize:12,color:"var(--a-text-3)" }}>No products found</div>
                ):filteredProducts.map(p=>(
                  <label key={p.id} style={{ display:"flex",alignItems:"center",gap:10,padding:"7px 12px",cursor:"pointer",fontSize:13,borderBottom:"1px solid var(--a-border)",background:form.product_ids.includes(p.id)?"var(--a-primary-light)":"transparent" }}>
                    <input type="checkbox" checked={form.product_ids.includes(p.id)} onChange={()=>toggleProduct(p.id)} />
                    <div style={{ flex:1,minWidth:0 }}>
                      <div style={{ fontWeight:500,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{p.name}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* Active */}
          <label style={{ display:"flex",alignItems:"center",gap:10,cursor:"pointer",fontSize:13 }}>
            <input type="checkbox" checked={form.is_active} onChange={e=>set("is_active",e.target.checked)} />
            <span style={{ color:"var(--a-text-2)",fontWeight:500 }}>Offer is active</span>
          </label>
        </div>

        <div style={{ padding:"12px 20px",borderTop:"1px solid var(--a-border)",display:"flex",justifyContent:"flex-end",gap:8,background:"var(--a-surface-2)" }}>
          <button className="a-btn a-btn-secondary" onClick={onCancel}>Cancel</button>
          <button className="a-btn a-btn-primary" disabled={saving||!form.title||!form.discount_value} onClick={()=>onSave(form)}>
            {saving?"Saving…":isEdit?"Save Changes":"Create Offer"}
          </button>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ offer }: { offer: StoreOffer }) {
  if (!offer.isActive) return <span className="a-badge a-badge-neutral">Inactive</span>;
  if (!isOfferCurrentlyValid(offer)) return <span className="a-badge a-badge-orange">Expired</span>;
  return <span className="a-badge a-badge-green">Active</span>;
}

export default function AdminOffersPage() {
  const [offers, setOffers] = useState<StoreOffer[]>([]);
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingOffer, setEditingOffer] = useState<StoreOffer|null>(null);
  const [formSaving, setFormSaving] = useState(false);
  const [formError, setFormError] = useState<string|null>(null);
  const [deleteId, setDeleteId] = useState<string|null>(null);
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState<{msg:string;type:"success"|"error"}|null>(null);

  const load = useCallback(async()=>{
    setLoading(true);
    const [offersData, productsData] = await Promise.all([
      adminFetchAllOffers(),
      adminFetchProducts({ limit:500 }),
    ]);
    setOffers(offersData);
    setProducts(productsData.products);
    setLoading(false);
  },[]);

  useEffect(()=>{load();},[load]);

  function showToast(msg:string,type:"success"|"error"="success"){
    setToast({msg,type});setTimeout(()=>setToast(null),3000);
  }

  const filtered = offers.filter(o=>
    !search||o.title.toLowerCase().includes(search.toLowerCase())||(o.code&&o.code.toLowerCase().includes(search.toLowerCase()))
  );

  async function handleSave(payload:OfferUpsertPayload){
    setFormSaving(true);setFormError(null);
    if(editingOffer){
      const{error}=await adminUpdateOffer(editingOffer.id,payload);
      if(error){setFormError(error);setFormSaving(false);return;}
      showToast("Offer updated");
    } else {
      const{error}=await adminCreateOffer(payload);
      if(error){setFormError(error);setFormSaving(false);return;}
      showToast("Offer created");
    }
    setFormSaving(false);setShowForm(false);setEditingOffer(null);load();
  }

  async function handleToggle(offer:StoreOffer){
    await adminToggleOfferActive(offer.id,!offer.isActive);
    showToast(offer.isActive?"Offer deactivated":"Offer activated");
    load();
  }

  async function handleDelete(){
    if(!deleteId)return;
    setDeleting(true);
    const err=await adminDeleteOffer(deleteId);
    setDeleting(false);setDeleteId(null);
    if(err){showToast(err,"error");return;}
    showToast("Offer deleted");load();
  }

  function openEdit(o:StoreOffer){
    setEditingOffer(o);setFormError(null);setShowForm(true);
  }

  function initialFromOffer(o:StoreOffer):Partial<OfferUpsertPayload>{
    return {
      title:o.title,code:o.code,description:o.description,
      discount_type:o.discountType,discount_value:o.discountValue,
      is_active:o.isActive,starts_at:o.startsAt,ends_at:o.endsAt,
      product_ids:o.productIds,min_order_paise:o.minOrderPaise,max_uses:o.maxUses,
    };
  }

  const activeCount=offers.filter(o=>o.isActive&&isOfferCurrentlyValid(o)).length;

  return (
    <div style={{minHeight:"100%",background:"var(--a-bg)"}}>
      {toast&&(
        <div style={{position:"fixed",top:16,right:16,zIndex:100,padding:"10px 16px",borderRadius:"var(--a-radius-md)",fontSize:13,fontWeight:500,background:toast.type==="success"?"var(--a-success-bg)":"var(--a-danger-bg)",color:toast.type==="success"?"var(--a-success-text)":"var(--a-danger-text)",border:`1px solid ${toast.type==="success"?"var(--a-success-border)":"var(--a-danger-border)"}`,boxShadow:"var(--a-shadow-md)"}}>
          {toast.msg}
        </div>
      )}

      {showForm&&(
        <OfferFormModal
          initial={editingOffer?initialFromOffer(editingOffer):{}}
          allProducts={products}
          onSave={handleSave}
          onCancel={()=>{setShowForm(false);setEditingOffer(null);setFormError(null);}}
          saving={formSaving}
          error={formError}
          isEdit={!!editingOffer}
        />
      )}

      {deleteId&&(
        <div style={{position:"fixed",inset:0,zIndex:60,background:"rgba(15,23,42,0.55)",display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
          <div style={{background:"var(--a-surface)",borderRadius:"var(--a-radius-lg)",border:"1px solid var(--a-border)",padding:24,maxWidth:400,width:"100%"}}>
            <div style={{fontSize:15,fontWeight:700,marginBottom:8}}>Delete offer?</div>
            <p style={{fontSize:13,color:"var(--a-text-3)",marginBottom:20}}>This will permanently delete the offer. Customers currently using a promo code will lose access.</p>
            <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
              <button className="a-btn a-btn-secondary" onClick={()=>setDeleteId(null)}>Cancel</button>
              <button className="a-btn a-btn-danger-solid" onClick={handleDelete} disabled={deleting}>{deleting?"Deleting…":"Delete"}</button>
            </div>
          </div>
        </div>
      )}

      <div style={{padding:24}}>
        {/* Stats */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12,marginBottom:20}}>
          {[
            {label:"Total Offers",value:offers.length,icon:<Percent style={{width:16,height:16}} />,cls:"a-stat-blue",icls:"a-stat-icon-blue"},
            {label:"Active Now",value:activeCount,icon:<Check style={{width:16,height:16}} />,cls:"a-stat-green",icls:"a-stat-icon-green"},
            {label:"Inactive / Expired",value:offers.length-activeCount,icon:<Tag style={{width:16,height:16}} />,cls:"a-stat-amber",icls:"a-stat-icon-amber"},
          ].map(s=>(
            <div key={s.label} className={`a-stat ${s.cls}`}>
              <div className={`a-stat-icon ${s.icls}`}>{s.icon}</div>
              <div className="a-stat-value">{s.value}</div>
              <div className="a-stat-label">{s.label}</div>
            </div>
          ))}
        </div>

        <div className="a-page-header">
          <div>
            <div className="a-page-title">Offers</div>
            <div className="a-page-subtitle">Manage promotional discounts and promo codes</div>
          </div>
          <button className="a-btn a-btn-primary" onClick={()=>{setEditingOffer(null);setFormError(null);setShowForm(true);}}>
            <Plus style={{width:15,height:15}} /> New Offer
          </button>
        </div>

        <div className="a-filter-bar">
          <div className="a-search-wrap" style={{maxWidth:300}}>
            <Search />
            <input className="a-search-input" placeholder="Search offers or codes…" value={search} onChange={e=>setSearch(e.target.value)} />
          </div>
          <button className="a-btn a-btn-secondary a-btn-sm" onClick={load}><RefreshCw style={{width:13,height:13}} /></button>
        </div>

        <div className="a-card">
          {loading?(
            <div className="a-loading"><RefreshCw style={{width:16,height:16,animation:"spin 1s linear infinite"}} />Loading…</div>
          ):filtered.length===0?(
            <div className="a-empty">
              <div className="a-empty-icon"><Percent /></div>
              <div className="a-empty-title">No offers found</div>
              <div className="a-empty-sub">{search?"Try a different search.":"Create your first offer to start promoting products."}</div>
              {!search&&<button className="a-btn a-btn-primary" onClick={()=>setShowForm(true)}><Plus style={{width:14,height:14}} /> New Offer</button>}
            </div>
          ):(
            <div className="a-table-wrap">
              <table className="a-table">
                <thead>
                  <tr>
                    <th>Offer</th>
                    <th>Code</th>
                    <th>Discount</th>
                    <th>Scope</th>
                    <th>Validity</th>
                    <th>Status</th>
                    <th style={{textAlign:"right"}}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(offer=>(
                    <tr key={offer.id}>
                      <td>
                        <div style={{fontWeight:600,fontSize:13}}>{offer.title}</div>
                        {offer.description&&<div style={{fontSize:11,color:"var(--a-text-3)",maxWidth:200,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{offer.description}</div>}
                      </td>
                      <td>
                        {offer.code
                          ? <span className="a-badge a-badge-blue" style={{fontFamily:"monospace"}}>{offer.code}</span>
                          : <span style={{fontSize:12,color:"var(--a-text-4)"}}>Auto-applied</span>}
                      </td>
                      <td>
                        <span className="a-badge a-badge-orange">{offerLabel(offer)}</span>
                      </td>
                      <td>
                        {offer.productIds.length===0
                          ? <span className="a-badge a-badge-neutral">Sitewide</span>
                          : <span className="a-badge a-badge-blue">{offer.productIds.length} product{offer.productIds.length!==1?"s":""}</span>}
                      </td>
                      <td>
                        <div style={{fontSize:12,color:"var(--a-text-3)"}}>
                          {offer.startsAt&&<div>From: {new Date(offer.startsAt).toLocaleDateString()}</div>}
                          {offer.endsAt&&<div>Until: {new Date(offer.endsAt).toLocaleDateString()}</div>}
                          {!offer.startsAt&&!offer.endsAt&&<span style={{color:"var(--a-text-4)"}}>No expiry</span>}
                        </div>
                      </td>
                      <td><StatusBadge offer={offer} /></td>
                      <td>
                        <div style={{display:"flex",gap:3,justifyContent:"flex-end"}}>
                          <button className="a-btn a-btn-ghost a-btn-icon a-btn-sm" onClick={()=>handleToggle(offer)} title={offer.isActive?"Deactivate":"Activate"}>
                            {offer.isActive?<ToggleRight style={{width:15,height:15,color:"var(--a-success)"}} />:<ToggleLeft style={{width:15,height:15}} />}
                          </button>
                          <button className="a-btn a-btn-ghost a-btn-icon a-btn-sm" onClick={()=>openEdit(offer)} title="Edit">
                            <Edit2 style={{width:13,height:13}} />
                          </button>
                          <button className="a-btn a-btn-ghost a-btn-icon a-btn-sm" onClick={()=>setDeleteId(offer.id)} title="Delete">
                            <Trash2 style={{width:13,height:13,color:"var(--a-danger-text)"}} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
