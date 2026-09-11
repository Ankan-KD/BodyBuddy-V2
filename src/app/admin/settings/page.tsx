"use client";

import { useState, useEffect } from "react";
import {
  Settings, Save, RefreshCw, AlertTriangle, Check,
  Store, Bell, Shield, Star, Lock, Eye, EyeOff,
  KeyRound, CheckCircle2, Loader2,
} from "lucide-react";
import {
  adminFetchSettings,
  adminSaveSettings,
  adminFetchAllCategories,
} from "@/lib/storeAdminApi";
import type { StoreSettings } from "@/lib/offerTypes";
import type { StoreCategory } from "@/lib/storeTypes";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import {
  validatePassword, sendOTP, verifyOTPServer, checkHasPassword, markResendSent,
} from "@/lib/passwordUtils";

async function getAccessToken(): Promise<string | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

// ─── Admin Password Section ───────────────────────────────────────────────────

type PwScreen = "idle" | "change_form" | "change_otp" | "done" | "forgot_otp" | "forgot_newpass" | "forgot_done";

function VRow({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: ok ? "var(--a-success-text)" : "var(--a-text-3)" }}>
      <CheckCircle2 style={{ width: 12, height: 12, opacity: ok ? 1 : 0.3 }} />
      {label}
    </div>
  );
}

function AdminPasswordSection({ userEmail, hasPassword }: { userEmail: string; hasPassword: boolean }) {
  const [screen, setScreen] = useState<PwScreen>("idle");
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown(c => Math.max(0, c - 1)), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  function reset() {
    setScreen("idle"); setCurrentPw(""); setNewPw(""); setConfirmPw(""); setOtp("");
    setError(null); setLoading(false); setCooldown(0);
  }

  const pwV = validatePassword(newPw);

  const purpose = hasPassword ? "change_password" : "set_password";

  async function handleChangeSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!pwV.allPassed) { setError("New password doesn't meet requirements."); return; }
    if (newPw !== confirmPw) { setError("Passwords don't match."); return; }
    if (!supabase) { setError("Not configured."); return; }
    setLoading(true);
    // Only verify current password when changing an existing password, not when setting one fresh
    if (hasPassword) {
      const { error: signInErr } = await supabase.auth.signInWithPassword({ email: userEmail, password: currentPw });
      if (signInErr) { setError("Current password is incorrect."); setLoading(false); return; }
    }
    const accessToken = await getAccessToken();
    const { error: otpErr } = await sendOTP({ purpose, accessToken: accessToken ?? undefined });
    setLoading(false);
    if (otpErr) { setError(otpErr); return; }
    setCooldown(60);
    setScreen("change_otp");
  }

  async function handleForgotSend() {
    setError(null);
    setLoading(true);
    const accessToken = await getAccessToken();
    const { error: otpErr } = await sendOTP({ purpose: "change_password", accessToken: accessToken ?? undefined });
    setLoading(false);
    if (otpErr) { setError(otpErr); return; }
    markResendSent(userEmail);
    setCooldown(60);
    setScreen("forgot_otp");
  }

  async function handleOTPVerify(e: React.FormEvent, nextScreen: "change_done_pending" | "forgot_newpass") {
    e.preventDefault();
    setError(null);
    if (!supabase) { setError("Not configured."); return; }
    setLoading(true);
    const accessToken = await getAccessToken();
    // Verified entirely server-side, regardless of Supabase dashboard settings.
    const { error: serverErr } = await verifyOTPServer({
      purpose: nextScreen === "change_done_pending" ? purpose : "change_password",
      code: otp,
      accessToken: accessToken ?? undefined,
    });
    if (serverErr) { setError(serverErr); setLoading(false); return; }
    if (nextScreen === "change_done_pending") {
      // OTP ok → update password using the admin's own live session.
      const { error: ue } = await supabase.auth.updateUser({ password: newPw });
      setLoading(false);
      if (ue) { setError(ue.message); return; }
      setScreen("done");
    } else {
      setLoading(false);
      setScreen("forgot_newpass");
    }
  }

  async function handleForgotSetPassword(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!pwV.allPassed) { setError("Password doesn't meet requirements."); return; }
    if (newPw !== confirmPw) { setError("Passwords don't match."); return; }
    if (!supabase) { setError("Not configured."); return; }
    setLoading(true);
    // Already-authenticated session — update directly.
    const { error: ue } = await supabase.auth.updateUser({ password: newPw });
    setLoading(false);
    if (ue) { setError(ue.message); return; }
    setScreen("forgot_done");
  }

  async function handleResend() {
    if (cooldown > 0) return;
    setError(null);
    setLoading(true);
    const accessToken = await getAccessToken();
    const { error: e } = await sendOTP({ purpose, accessToken: accessToken ?? undefined });
    setLoading(false);
    if (e) { setError(e); return; }
    markResendSent(userEmail);
    setCooldown(60);
  }

  // ── Idle ──
  if (screen === "idle") {
    return (
      <div className="a-card" style={{ marginBottom: 16 }}>
        <div className="a-card-header">
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div className="a-section-heading-icon"><KeyRound style={{ width: 14, height: 14 }} /></div>
            <span className="a-card-header-title">Password &amp; Security</span>
          </div>
        </div>
        <div style={{ padding: "18px 20px" }}>
          {hasPassword ? (
            <>
              <p style={{ fontSize: 13, color: "var(--a-text-3)", marginBottom: 12 }}>A password is set for your admin account.</p>
              <button className="a-btn a-btn-secondary" style={{ width: "100%" }} onClick={() => setScreen("change_form")}>
                <Lock style={{ width: 14, height: 14 }} /> Change password
              </button>
            </>
          ) : (
            <>
              <p style={{ fontSize: 13, color: "var(--a-text-3)", marginBottom: 12 }}>No password has been set for this account.</p>
              <button className="a-btn a-btn-secondary" style={{ width: "100%" }} onClick={() => setScreen("change_form")}>
                <Lock style={{ width: 14, height: 14 }} /> Set password
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  // ── Change / Set form ──
  if (screen === "change_form") {
    return (
      <div className="a-card" style={{ marginBottom: 16 }}>
        <div className="a-card-header">
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div className="a-section-heading-icon"><KeyRound style={{ width: 14, height: 14 }} /></div>
            <span className="a-card-header-title">{hasPassword ? "Change password" : "Set password"}</span>
          </div>
        </div>
        <div style={{ padding: "18px 20px" }}>
          <form onSubmit={handleChangeSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {hasPassword && (
              <div className="a-form-field">
                <label className="a-form-label">Current password</label>
                <div style={{ position: "relative" }}>
                  <Lock style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", width: 13, height: 13, color: "var(--a-text-3)", pointerEvents: "none" }} />
                  <input type={showCurrent ? "text" : "password"} value={currentPw} onChange={e => setCurrentPw(e.target.value)} placeholder="Current password" className="a-form-input" style={{ paddingLeft: 30, paddingRight: 36 }} />
                  <button type="button" onClick={() => setShowCurrent(v => !v)} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "var(--a-text-3)" }}>
                    {showCurrent ? <EyeOff style={{ width: 13, height: 13 }} /> : <Eye style={{ width: 13, height: 13 }} />}
                  </button>
                </div>
                <button type="button" onClick={handleForgotSend} disabled={loading} style={{ alignSelf: "flex-end", fontSize: 12, color: "var(--a-primary)", background: "none", border: "none", cursor: "pointer", marginTop: 2 }}>
                  {loading ? "Sending…" : "Forgot password?"}
                </button>
              </div>
            )}
            <div className="a-form-field">
              <label className="a-form-label">New password</label>
              <div style={{ position: "relative" }}>
                <Lock style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", width: 13, height: 13, color: "var(--a-text-3)", pointerEvents: "none" }} />
                <input type={showNew ? "text" : "password"} value={newPw} onChange={e => setNewPw(e.target.value)} placeholder="New password" className="a-form-input" style={{ paddingLeft: 30, paddingRight: 36 }} autoComplete="new-password" />
                <button type="button" onClick={() => setShowNew(v => !v)} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "var(--a-text-3)" }}>
                  {showNew ? <EyeOff style={{ width: 13, height: 13 }} /> : <Eye style={{ width: 13, height: 13 }} />}
                </button>
              </div>
            </div>
            <div className="a-form-field">
              <label className="a-form-label">Confirm password</label>
              <div style={{ position: "relative" }}>
                <Lock style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", width: 13, height: 13, color: "var(--a-text-3)", pointerEvents: "none" }} />
                <input type={showNew ? "text" : "password"} value={confirmPw} onChange={e => setConfirmPw(e.target.value)} placeholder="Confirm password" className="a-form-input" style={{ paddingLeft: 30 }} autoComplete="new-password" />
              </div>
            </div>
            {newPw && (
              <div style={{ padding: "10px 12px", background: "var(--a-surface-2, var(--a-surface))", borderRadius: "var(--a-radius)", border: "1px solid var(--a-border)", display: "flex", flexDirection: "column", gap: 5 }}>
                <VRow ok={pwV.minLength} label="At least 8 characters" />
                <VRow ok={pwV.hasLetter} label="Contains a letter" />
                <VRow ok={pwV.hasNumber} label="Contains a number" />
                {confirmPw && <VRow ok={newPw === confirmPw} label="Passwords match" />}
              </div>
            )}
            {error && <div className="a-alert a-alert-error" style={{ fontSize: 13 }}><AlertTriangle style={{ width: 14, height: 14, flexShrink: 0 }} />{error}</div>}
            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" className="a-btn a-btn-secondary" onClick={reset} style={{ flex: 1 }}>Cancel</button>
              <button type="submit" className="a-btn a-btn-primary" disabled={loading} style={{ flex: 1 }}>
                {loading ? <Loader2 style={{ width: 13, height: 13 }} className="animate-spin" /> : "Continue"}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // ── OTP screen ──
  const isChangeOTP = screen === "change_otp";
  const isForgotOTP = screen === "forgot_otp";
  if (isChangeOTP || isForgotOTP) {
    return (
      <div className="a-card" style={{ marginBottom: 16 }}>
        <div className="a-card-header">
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div className="a-section-heading-icon"><Shield style={{ width: 14, height: 14 }} /></div>
            <span className="a-card-header-title">Verify your identity</span>
          </div>
        </div>
        <div style={{ padding: "18px 20px" }}>
          <p style={{ fontSize: 13, color: "var(--a-text-3)", marginBottom: 14 }}>A 6-digit code was sent to <strong>{userEmail}</strong>.</p>
          <form onSubmit={(e) => handleOTPVerify(e, isChangeOTP ? "change_done_pending" : "forgot_newpass")} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <input
              type="text" inputMode="numeric" placeholder="6-digit code" value={otp}
              onChange={e => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
              maxLength={6} required className="a-form-input"
              style={{ textAlign: "center", letterSpacing: "0.4em", fontFamily: "monospace", fontSize: 18, height: 44 }}
            />
            {error && <div className="a-alert a-alert-error"><AlertTriangle style={{ width: 14, height: 14, flexShrink: 0 }} />{error}</div>}
            <button type="submit" disabled={loading || otp.length < 6} className="a-btn a-btn-primary" style={{ width: "100%" }}>
              {loading ? <Loader2 style={{ width: 13, height: 13 }} className="animate-spin" /> : "Verify"}
            </button>
            <button type="button" onClick={handleResend} disabled={cooldown > 0 || loading} style={{ fontSize: 12, color: "var(--a-text-3)", background: "none", border: "none", cursor: "pointer", opacity: cooldown > 0 ? 0.5 : 1 }}>
              {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ── Forgot: new password ──
  if (screen === "forgot_newpass") {
    return (
      <div className="a-card" style={{ marginBottom: 16 }}>
        <div className="a-card-header">
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div className="a-section-heading-icon"><Lock style={{ width: 14, height: 14 }} /></div>
            <span className="a-card-header-title">Set new password</span>
          </div>
        </div>
        <div style={{ padding: "18px 20px" }}>
          <form onSubmit={handleForgotSetPassword} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ position: "relative" }}>
              <Lock style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", width: 13, height: 13, color: "var(--a-text-3)", pointerEvents: "none" }} />
              <input type="password" value={newPw} onChange={e => setNewPw(e.target.value)} placeholder="New password" className="a-form-input" style={{ paddingLeft: 30 }} autoComplete="new-password" />
            </div>
            <div style={{ position: "relative" }}>
              <Lock style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", width: 13, height: 13, color: "var(--a-text-3)", pointerEvents: "none" }} />
              <input type="password" value={confirmPw} onChange={e => setConfirmPw(e.target.value)} placeholder="Confirm password" className="a-form-input" style={{ paddingLeft: 30 }} autoComplete="new-password" />
            </div>
            {newPw && (
              <div style={{ padding: "10px 12px", background: "var(--a-surface)", borderRadius: "var(--a-radius)", border: "1px solid var(--a-border)", display: "flex", flexDirection: "column", gap: 5 }}>
                <VRow ok={pwV.minLength} label="At least 8 characters" />
                <VRow ok={pwV.hasLetter} label="Contains a letter" />
                <VRow ok={pwV.hasNumber} label="Contains a number" />
                {confirmPw && <VRow ok={newPw === confirmPw} label="Passwords match" />}
              </div>
            )}
            {error && <div className="a-alert a-alert-error"><AlertTriangle style={{ width: 14, height: 14, flexShrink: 0 }} />{error}</div>}
            <button type="submit" disabled={loading || !pwV.allPassed || newPw !== confirmPw} className="a-btn a-btn-primary" style={{ width: "100%" }}>
              {loading ? <Loader2 style={{ width: 13, height: 13 }} className="animate-spin" /> : "Update password"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ── Done ──
  const doneMsg = screen === "forgot_done" ? "Password updated successfully." : "Password changed successfully.";
  return (
    <div className="a-card" style={{ marginBottom: 16 }}>
      <div style={{ padding: "20px", textAlign: "center" }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}>
          <div style={{ width: 44, height: 44, borderRadius: "50%", background: "var(--a-success-bg)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <CheckCircle2 style={{ width: 22, height: 22, color: "var(--a-success-text)" }} />
          </div>
        </div>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Done!</div>
        <div style={{ fontSize: 13, color: "var(--a-text-3)", marginBottom: 14 }}>{doneMsg}</div>
        <button className="a-btn a-btn-secondary" style={{ width: "100%" }} onClick={reset}>Back to settings</button>
      </div>
    </div>
  );
}

// ─── Main Admin Settings Page ─────────────────────────────────────────────────

export default function AdminSettingsPage() {
  const { user } = useAuth();
  const [settings, setSettings] = useState<StoreSettings | null>(null);
  const [categories, setCategories] = useState<StoreCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const [hasPassword, setHasPassword] = useState(false);

  // Local form state
  const [storeName, setStoreName] = useState("");
  const [storeTagline, setStoreTagline] = useState("");
  const [announcement, setAnnouncement] = useState("");
  const [announcementActive, setAnnouncementActive] = useState(false);
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [featuredCategoryIds, setFeaturedCategoryIds] = useState<string[]>([]);
  const [returnBusinessName, setReturnBusinessName] = useState("");
  const [returnLine1, setReturnLine1] = useState("");
  const [returnLine2, setReturnLine2] = useState("");
  const [returnCity, setReturnCity] = useState("");
  const [returnState, setReturnState] = useState("");
  const [returnPincode, setReturnPincode] = useState("");
  const [returnPhone, setReturnPhone] = useState("");

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
      setReturnBusinessName(s.returnBusinessName);
      setReturnLine1(s.returnAddressLine1);
      setReturnLine2(s.returnAddressLine2);
      setReturnCity(s.returnCity);
      setReturnState(s.returnState);
      setReturnPincode(s.returnPincode);
      setReturnPhone(s.returnPhone);
      setLoading(false);
    }
    load();
  }, []);

  useEffect(() => {
    if (!user) return;
    // Use server-side check — client-side identity checks are unreliable
    supabase?.auth.getSession().then(({ data }) => {
      const token = data.session?.access_token;
      if (token) {
        checkHasPassword(token).then(setHasPassword);
      } else {
        const provider: string = user.app_metadata?.provider ?? "";
        setHasPassword(provider === "email");
      }
    });
  }, [user]);

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
      return_business_name: returnBusinessName,
      return_address_line1: returnLine1,
      return_address_line2: returnLine2,
      return_city: returnCity,
      return_state: returnState,
      return_pincode: returnPincode,
      return_country: "India",
      return_phone: returnPhone,
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
      <div style={{ minHeight: "100%", background: "var(--a-bg)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div className="a-loading"><RefreshCw style={{ width: 16, height: 16, animation: "spin 1s linear infinite" }} />Loading settings…</div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100%", background: "var(--a-bg)" }}>
      {toast && (
        <div style={{ position: "fixed", top: 16, right: 16, zIndex: 100, padding: "10px 16px", borderRadius: "var(--a-radius-md)", fontSize: 13, fontWeight: 500, maxWidth: "calc(100vw - 32px)", background: toast.type === "success" ? "var(--a-success-bg)" : "var(--a-danger-bg)", color: toast.type === "success" ? "var(--a-success-text)" : "var(--a-danger-text)", border: `1px solid ${toast.type === "success" ? "var(--a-success-border)" : "var(--a-danger-border)"}`, boxShadow: "var(--a-shadow-md)" }}>
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

        {/* Password & Security */}
        {user?.email && (
          <AdminPasswordSection userEmail={user.email} hasPassword={hasPassword} />
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
              Select which Categories appear in the featured section on the store home page.
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

        {/* Return Address (used on printed shipping labels) */}
        <div className="a-card" style={{ marginBottom: 16 }}>
          <div className="a-card-header">
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div className="a-section-heading-icon"><Store style={{ width: 14, height: 14 }} /></div>
              <span className="a-card-header-title">Return Address</span>
            </div>
          </div>
          <div style={{ padding: "18px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
            <span className="a-form-hint">Shown as the &ldquo;FROM&rdquo; address on admin-printed shipping labels.</span>
            <div className="a-form-field">
              <label className="a-form-label">Business Name</label>
              <input className="a-form-input" value={returnBusinessName} onChange={e => setReturnBusinessName(e.target.value)} placeholder="BB Store" />
            </div>
            <div className="a-form-field">
              <label className="a-form-label">Address Line 1</label>
              <input className="a-form-input" value={returnLine1} onChange={e => setReturnLine1(e.target.value)} />
            </div>
            <div className="a-form-field">
              <label className="a-form-label">Address Line 2</label>
              <input className="a-form-input" value={returnLine2} onChange={e => setReturnLine2(e.target.value)} />
            </div>
            <div className="a-grid-2" style={{ gap: 12 }}>
              <div className="a-form-field">
                <label className="a-form-label">City</label>
                <input className="a-form-input" value={returnCity} onChange={e => setReturnCity(e.target.value)} />
              </div>
              <div className="a-form-field">
                <label className="a-form-label">State</label>
                <input className="a-form-input" value={returnState} onChange={e => setReturnState(e.target.value)} />
              </div>
            </div>
            <div className="a-grid-2" style={{ gap: 12 }}>
              <div className="a-form-field">
                <label className="a-form-label">Pincode</label>
                <input className="a-form-input" value={returnPincode} onChange={e => setReturnPincode(e.target.value)} />
              </div>
              <div className="a-form-field">
                <label className="a-form-label">Phone</label>
                <input className="a-form-input" value={returnPhone} onChange={e => setReturnPhone(e.target.value)} />
              </div>
            </div>
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
