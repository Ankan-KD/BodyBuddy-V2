"use client";

// ════════════════════════════════════════════════════════════════════════
// BB Store — Store Profile (Delivery Information)
// Store-only profile: manages the saved delivery address used to
// auto-populate checkout. Entirely separate from the BB Health profile.
// ════════════════════════════════════════════════════════════════════════

import { useEffect, useState } from "react";
import { MapPin, User, Phone, Pencil, Trash2, Plus, Loader2, CheckCircle2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import {
  fetchMyDeliveryProfile,
  saveMyDeliveryProfile,
  deleteMyDeliveryProfile,
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
  recipientName: string;
  phone: string;
  line1: string;
  line2: string;
  city: string;
  state: string;
  pincode: string;
  deliveryInstructions: string;
}

const EMPTY_FORM: FormState = {
  recipientName: "",
  phone: "",
  line1: "",
  line2: "",
  city: "",
  state: "",
  pincode: "",
  deliveryInstructions: "",
};

export default function StoreProfilePage() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<DeliveryProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    fetchMyDeliveryProfile(user.id).then((p) => {
      setProfile(p);
      setLoading(false);
    });
  }, [user]);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }

  function startAdd() {
    setForm(EMPTY_FORM);
    setError(null);
    setEditing(true);
  }

  function startEdit() {
    if (!profile) return;
    setForm({
      recipientName: profile.recipientName,
      phone: profile.phone,
      line1: profile.line1,
      line2: profile.line2,
      city: profile.city,
      state: profile.state,
      pincode: profile.pincode,
      deliveryInstructions: profile.deliveryInstructions,
    });
    setError(null);
    setEditing(true);
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
    const { profile: saved, error: err } = await saveMyDeliveryProfile(user.id, profile?.id ?? null, {
      recipientName: form.recipientName.trim(),
      phone: form.phone.trim(),
      line1: form.line1.trim(),
      line2: form.line2.trim(),
      city: form.city.trim(),
      state: form.state.trim(),
      pincode: form.pincode.trim(),
      country: "India",
      deliveryInstructions: form.deliveryInstructions.trim(),
    });
    setSaving(false);
    if (err) {
      setError(err);
      return;
    }
    setProfile(saved);
    setEditing(false);
    showToast("Delivery information saved.");
  }

  async function handleDelete() {
    if (!user || !profile) return;
    if (!confirm("Delete your saved delivery address?")) return;
    setSaving(true);
    const err = await deleteMyDeliveryProfile(user.id, profile.id);
    setSaving(false);
    if (err) {
      setError(err);
      return;
    }
    setProfile(null);
    showToast("Delivery address deleted.");
  }

  if (loading) {
    return (
      <div className="px-4 pt-4 flex items-center justify-center py-24">
        <Loader2 className="w-5 h-5 animate-spin text-amber-500" />
      </div>
    );
  }

  return (
    <div className="px-4 pt-4 pb-8 space-y-4">
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500 text-white text-xs font-semibold shadow-soft">
          <CheckCircle2 className="w-3.5 h-3.5" /> {toast}
        </div>
      )}

      <h1 className="font-display text-xl font-semibold flex items-center gap-2">
        <User className="w-5 h-5 text-amber-500" /> My Profile
      </h1>

      <div className="glass-panel border border-[var(--border)] rounded-2xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-sm flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-amber-500" /> Delivery Information
          </h2>
          {profile && !editing && (
            <div className="flex items-center gap-2">
              <button onClick={startEdit} className="text-[11px] text-amber-500 font-medium flex items-center gap-1">
                <Pencil className="w-3 h-3" /> Edit
              </button>
              <button onClick={handleDelete} className="text-[11px] text-red-500 font-medium flex items-center gap-1">
                <Trash2 className="w-3 h-3" /> Delete
              </button>
            </div>
          )}
        </div>

        {!editing && profile && (
          <div className="text-sm space-y-1">
            <p className="font-medium">{profile.recipientName}</p>
            <p className="text-[var(--text-muted)]">
              {profile.line1}
              {profile.line2 ? `, ${profile.line2}` : ""}
            </p>
            <p className="text-[var(--text-muted)]">
              {profile.city}, {profile.state} – {profile.pincode}
            </p>
            <p className="text-[var(--text-muted)]">{profile.country}</p>
            <p className="text-[var(--text-muted)] flex items-center gap-1 mt-1">
              <Phone className="w-3 h-3" /> {profile.phone}
            </p>
            {profile.deliveryInstructions && (
              <p className="text-[11px] text-[var(--text-muted)] italic mt-1">
                &ldquo;{profile.deliveryInstructions}&rdquo;
              </p>
            )}
          </div>
        )}

        {!editing && !profile && (
          <div className="text-center py-6">
            <p className="text-sm text-[var(--text-muted)] mb-3">
              No saved delivery address yet.
            </p>
            <button
              onClick={startAdd}
              className="inline-flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-xl bg-amber-500 text-white shadow-soft active:scale-95 transition-transform"
            >
              <Plus className="w-4 h-4" /> Add Delivery Details
            </button>
          </div>
        )}

        {editing && (
          <div className="space-y-3">
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

            {error && <p className="text-[11px] text-red-500">{error}</p>}

            <div className="flex gap-3 pt-1">
              <button
                onClick={() => setEditing(false)}
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
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
