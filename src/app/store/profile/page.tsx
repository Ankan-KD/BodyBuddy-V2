"use client";

// ════════════════════════════════════════════════════════════════════════
// BB Store — Store Profile (Saved Addresses)
// Manages every saved delivery address used to auto-populate checkout —
// add as many as you like (Home, Work, ...), edit or delete any of them,
// and mark one as the default. Entirely separate from the BB Health
// profile.
// ════════════════════════════════════════════════════════════════════════

import { useEffect, useState } from "react";
import {
  MapPin,
  User,
  Phone,
  Pencil,
  Trash2,
  Plus,
  Loader2,
  CheckCircle2,
  Star,
  Tag,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import {
  listMyDeliveryProfiles,
  saveMyDeliveryProfile,
  deleteMyDeliveryProfile,
  setDefaultDeliveryProfile,
} from "@/lib/deliveryProfileApi";
import { DeliveryProfile } from "@/lib/deliveryProfileTypes";
import { cn } from "@/lib/utils";

function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "w-full px-3.5 py-2.5 rounded-xl text-sm bg-[var(--bg-card)] border border-[var(--border)]",
        "focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500 transition-colors",
        "placeholder:text-[var(--text-muted)]",
        className
      )}
      {...props}
    />
  );
}

interface FormState {
  label: string;
  recipientName: string;
  phone: string;
  line1: string;
  line2: string;
  city: string;
  state: string;
  pincode: string;
  deliveryInstructions: string;
  isDefault: boolean;
}

const EMPTY_FORM: FormState = {
  label: "Home",
  recipientName: "",
  phone: "",
  line1: "",
  line2: "",
  city: "",
  state: "",
  pincode: "",
  deliveryInstructions: "",
  isDefault: false,
};

const QUICK_LABELS = ["Home", "Work", "Other"];

export default function StoreProfilePage() {
  const { user } = useAuth();
  const [profiles, setProfiles] = useState<DeliveryProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null | "new">(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  function refresh() {
    if (!user) return;
    setLoading(true);
    listMyDeliveryProfiles(user.id).then((list) => {
      setProfiles(list);
      setLoading(false);
    });
  }

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }

  function startAdd() {
    setForm({ ...EMPTY_FORM, isDefault: profiles.length === 0 });
    setError(null);
    setEditingId("new");
  }

  function startEdit(p: DeliveryProfile) {
    setForm({
      label: p.label,
      recipientName: p.recipientName,
      phone: p.phone,
      line1: p.line1,
      line2: p.line2,
      city: p.city,
      state: p.state,
      pincode: p.pincode,
      deliveryInstructions: p.deliveryInstructions,
      isDefault: p.isDefault,
    });
    setError(null);
    setEditingId(p.id);
  }

  async function handleSave() {
    if (!user) return;
    if (!form.recipientName.trim() || !form.phone.trim() || !form.line1.trim() || !form.city.trim() || !form.state.trim() || !form.pincode.trim()) {
      setError("Please fill in all required fields.");
      return;
    }
    if (!/^[0-9]{10}$/.test(form.phone.replace(/\s/g, ""))) {
      setError("Enter a valid 10-digit phone number.");
      return;
    }
    if (!/^[0-9]{6}$/.test(form.pincode.trim())) {
      setError("Enter a valid 6-digit pincode.");
      return;
    }
    setSaving(true);
    setError(null);
    const existingId = editingId === "new" || editingId === null ? null : editingId;
    const { profile: saved, error: err } = await saveMyDeliveryProfile(user.id, existingId, {
      label: form.label.trim() || "Home",
      recipientName: form.recipientName.trim(),
      phone: form.phone.trim(),
      line1: form.line1.trim(),
      line2: form.line2.trim(),
      city: form.city.trim(),
      state: form.state.trim(),
      pincode: form.pincode.trim(),
      country: "India",
      deliveryInstructions: form.deliveryInstructions.trim(),
      isDefault: form.isDefault,
    });
    setSaving(false);
    if (err || !saved) {
      setError(err ?? "Something went wrong. Please try again.");
      return;
    }
    setEditingId(null);
    refresh();
    showToast("Address saved.");
  }

  async function handleDelete(p: DeliveryProfile) {
    if (!user) return;
    if (!confirm(`Delete the "${p.label}" address?`)) return;
    setSaving(true);
    const err = await deleteMyDeliveryProfile(user.id, p.id);
    setSaving(false);
    if (err) {
      setError(err);
      return;
    }
    refresh();
    showToast("Address deleted.");
  }

  async function handleSetDefault(p: DeliveryProfile) {
    if (!user || p.isDefault) return;
    setSaving(true);
    const err = await setDefaultDeliveryProfile(user.id, p.id);
    setSaving(false);
    if (err) {
      setError(err);
      return;
    }
    refresh();
    showToast(`"${p.label}" is now your default address.`);
  }

  if (loading) {
    return (
      <div className="px-4 pt-4 flex items-center justify-center py-24">
        <Loader2 className="w-5 h-5 animate-spin text-amber-500" />
      </div>
    );
  }

  const isEditing = editingId !== null;

  return (
    <div className="px-4 pt-4 pb-8 space-y-4">
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500 text-white text-xs font-semibold shadow-soft">
          <CheckCircle2 className="w-3.5 h-3.5" /> {toast}
        </div>
      )}

      <div className="flex items-center justify-between">
        <h1 className="font-display text-xl font-semibold flex items-center gap-2">
          <User className="w-5 h-5 text-amber-500" /> My Profile
        </h1>
        {!isEditing && profiles.length > 0 && (
          <button
            onClick={startAdd}
            className="inline-flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-xl bg-amber-500 text-white shadow-soft active:scale-95 transition-transform"
          >
            <Plus className="w-3.5 h-3.5" /> Add Address
          </button>
        )}
      </div>

      <div className="glass-panel border border-[var(--border)] rounded-2xl p-4">
        <h2 className="font-semibold text-sm flex items-center gap-1.5 mb-3">
          <MapPin className="w-3.5 h-3.5 text-amber-500" /> Saved Delivery Addresses
        </h2>

        {/* ── List of saved addresses ── */}
        {!isEditing && profiles.length > 0 && (
          <div className="space-y-3">
            {profiles.map((p) => (
              <div
                key={p.id}
                className={cn(
                  "rounded-xl border p-3.5",
                  p.isDefault
                    ? "border-amber-500/50 bg-amber-500/5"
                    : "border-[var(--border)]"
                )}
              >
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-1.5">
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-nova-500/10 text-nova-600 dark:text-nova-300">
                      <Tag className="w-3 h-3" /> {p.label}
                    </span>
                    {p.isDefault && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-300">
                        <Star className="w-3 h-3 fill-current" /> Default
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => startEdit(p)}
                      aria-label={`Edit ${p.label}`}
                      className="text-[11px] text-amber-500 font-medium flex items-center gap-1"
                    >
                      <Pencil className="w-3 h-3" /> Edit
                    </button>
                    <button
                      onClick={() => handleDelete(p)}
                      aria-label={`Delete ${p.label}`}
                      className="text-[11px] text-red-500 font-medium flex items-center gap-1"
                    >
                      <Trash2 className="w-3 h-3" /> Delete
                    </button>
                  </div>
                </div>

                <div className="text-sm space-y-0.5">
                  <p className="font-medium">{p.recipientName}</p>
                  <p className="text-[var(--text-muted)]">
                    {p.line1}
                    {p.line2 ? `, ${p.line2}` : ""}
                  </p>
                  <p className="text-[var(--text-muted)]">
                    {p.city}, {p.state} – {p.pincode}
                  </p>
                  <p className="text-[var(--text-muted)] flex items-center gap-1 mt-1">
                    <Phone className="w-3 h-3" /> {p.phone}
                  </p>
                  {p.deliveryInstructions && (
                    <p className="text-[11px] text-[var(--text-muted)] italic mt-1">
                      &ldquo;{p.deliveryInstructions}&rdquo;
                    </p>
                  )}
                </div>

                {!p.isDefault && (
                  <button
                    onClick={() => handleSetDefault(p)}
                    disabled={saving}
                    className="mt-3 text-[11px] font-semibold text-amber-500 flex items-center gap-1 disabled:opacity-50"
                  >
                    <Star className="w-3 h-3" /> Make default
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {!isEditing && profiles.length === 0 && (
          <div className="text-center py-6">
            <p className="text-sm text-[var(--text-muted)] mb-3">
              No saved delivery addresses yet.
            </p>
            <button
              onClick={startAdd}
              className="inline-flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-xl bg-amber-500 text-white shadow-soft active:scale-95 transition-transform"
            >
              <Plus className="w-4 h-4" /> Add Delivery Address
            </button>
          </div>
        )}

        {/* ── Add / edit form ── */}
        {isEditing && (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[var(--text-muted)]">Label</label>
              <div className="flex gap-2">
                {QUICK_LABELS.map((l) => (
                  <button
                    key={l}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, label: l }))}
                    className={cn(
                      "text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors",
                      form.label === l
                        ? "bg-amber-500 text-white border-amber-500"
                        : "border-[var(--border)] text-[var(--text-muted)]"
                    )}
                  >
                    {l}
                  </button>
                ))}
              </div>
              <Input
                placeholder="e.g. Home, Work, Hostel"
                value={form.label}
                onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
              />
            </div>
            <Input
              placeholder="Recipient Name"
              value={form.recipientName}
              onChange={(e) => setForm((f) => ({ ...f, recipientName: e.target.value }))}
            />
            <Input
              placeholder="Phone Number"
              maxLength={10}
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value.replace(/\D/g, "") }))}
            />
            <Input
              placeholder="Address Line 1"
              value={form.line1}
              onChange={(e) => setForm((f) => ({ ...f, line1: e.target.value }))}
            />
            <Input
              placeholder="Address Line 2 (Optional)"
              value={form.line2}
              onChange={(e) => setForm((f) => ({ ...f, line2: e.target.value }))}
            />
            <div className="grid grid-cols-2 gap-3">
              <Input
                placeholder="City"
                value={form.city}
                onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
              />
              <Input
                placeholder="State"
                value={form.state}
                onChange={(e) => setForm((f) => ({ ...f, state: e.target.value }))}
              />
            </div>
            <Input
              placeholder="Pincode"
              maxLength={6}
              value={form.pincode}
              onChange={(e) => setForm((f) => ({ ...f, pincode: e.target.value.replace(/\D/g, "") }))}
            />
            <Input
              placeholder="Delivery Instructions (Optional)"
              value={form.deliveryInstructions}
              onChange={(e) => setForm((f) => ({ ...f, deliveryInstructions: e.target.value }))}
            />

            <label className="flex items-center gap-2 text-xs text-[var(--text-muted)] pt-1">
              <input
                type="checkbox"
                checked={form.isDefault}
                onChange={(e) => setForm((f) => ({ ...f, isDefault: e.target.checked }))}
                className="rounded border-[var(--border)]"
              />
              Use as my default address
            </label>

            {error && <p className="text-[11px] text-red-500">{error}</p>}

            <div className="flex gap-3 pt-1">
              <button
                onClick={() => setEditingId(null)}
                disabled={saving}
                className="flex-1 font-semibold rounded-xl py-2.5 border border-[var(--border)] text-sm active:scale-95 transition-transform disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-[2] flex items-center justify-center gap-2 font-semibold rounded-xl py-2.5 bg-amber-500 text-white shadow-soft active:scale-95 transition-transform disabled:opacity-70"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save Address"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
