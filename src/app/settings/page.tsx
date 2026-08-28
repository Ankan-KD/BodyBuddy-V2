"use client";

import { useMemo, useState, useEffect } from "react";
import { useStore } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EditableNumber } from "@/components/ui/editable-number";
import {
  Sun, Moon, Monitor, Heart, LogOut, Mail, TrendingUp, TrendingDown, Equal,
  AlertTriangle, Lock, CheckCircle2, Eye, EyeOff, ArrowLeft, Loader2, KeyRound,
} from "lucide-react";
import { GoalMode } from "@/lib/types";
import { GOAL_SHORT_LABELS, goalWeightWarning, calorieGoalWarning } from "@/lib/goalCopy";
import {
  validatePassword, sendOTP, verifyOTPServer, updatePasswordAfterOtp,
  checkHasPassword, markResendSent,
} from "@/lib/passwordUtils";

async function getAccessToken(): Promise<string | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

const GOAL_ICONS: Record<GoalMode, typeof TrendingUp> = {
  gain: TrendingUp,
  lose: TrendingDown,
  maintain: Equal,
};

// ─── Password / Security Section ─────────────────────────────────────────────

type PwScreen =
  | "idle"           // show the card normally
  | "change_form"    // current + new + confirm
  | "change_otp"     // OTP verification for change
  | "change_done"
  | "set_form"       // new + confirm (no current password)
  | "set_otp"        // OTP verification for set
  | "set_done"
  | "forgot_otp"     // forgot from settings → OTP
  | "forgot_newpass" // new password after OTP
  | "forgot_done";

function PasswordSection({ userEmail, hasPassword }: { userEmail: string; hasPassword: boolean }) {
  const [screen, setScreen] = useState<PwScreen>("idle");
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  function reset() {
    setScreen("idle");
    setCurrentPw(""); setNewPw(""); setConfirmPw(""); setOtpCode("");
    setError(null); setLoading(false); setCooldown(0);
  }

  const pwV = validatePassword(newPw);

  // Purpose of the OTP currently in flight — drives which endpoint to hit.
  const [activePurpose, setActivePurpose] = useState<"change_password" | "set_password">("change_password");

  // ── Change password: verify current, then OTP ──
  async function handleChangeSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!pwV.allPassed) { setError("New password doesn't meet requirements."); return; }
    if (newPw !== confirmPw) { setError("Passwords don't match."); return; }
    if (!supabase) { setError("Not configured."); return; }
    setLoading(true);
    // Verify current password by attempting sign-in (this is itself a
    // legitimate, server-side Supabase Auth check).
    const { error: signInErr } = await supabase.auth.signInWithPassword({ email: userEmail, password: currentPw });
    if (signInErr) { setError("Current password is incorrect."); setLoading(false); return; }
    const accessToken = await getAccessToken();
    const { error: otpErr } = await sendOTP({ purpose: "change_password", accessToken: accessToken ?? undefined });
    setLoading(false);
    if (otpErr) { setError(otpErr); return; }
    setActivePurpose("change_password");
    setCooldown(60);
    setScreen("change_otp");
  }

  async function handleChangeOTPVerify(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!supabase) { setError("Not configured."); return; }
    setLoading(true);
    const accessToken = await getAccessToken();
    // Verified entirely server-side, regardless of Supabase dashboard settings.
    const { error: serverErr } = await verifyOTPServer({
      purpose: "change_password", code: otpCode, accessToken: accessToken ?? undefined,
    });
    if (serverErr) { setError(serverErr); setLoading(false); return; }
    // OTP ok → update password using the user's own live session.
    const { error: updateErr } = await supabase.auth.updateUser({ password: newPw });
    setLoading(false);
    if (updateErr) { setError(updateErr.message); return; }
    setScreen("change_done");
  }

  // ── Set password (no current password) ──
  async function handleSetSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!pwV.allPassed) { setError("Password doesn't meet requirements."); return; }
    if (newPw !== confirmPw) { setError("Passwords don't match."); return; }
    setLoading(true);
    const accessToken = await getAccessToken();
    const { error: otpErr } = await sendOTP({ purpose: "set_password", accessToken: accessToken ?? undefined });
    setLoading(false);
    if (otpErr) { setError(otpErr); return; }
    setActivePurpose("set_password");
    setCooldown(60);
    setScreen("set_otp");
  }

  async function handleSetOTPVerify(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!supabase) { setError("Not configured."); return; }
    setLoading(true);
    const accessToken = await getAccessToken();
    const { error: serverErr } = await verifyOTPServer({
      purpose: "set_password", code: otpCode, accessToken: accessToken ?? undefined,
    });
    if (serverErr) { setError(serverErr); setLoading(false); return; }
    const { error: updateErr } = await supabase.auth.updateUser({ password: newPw });
    setLoading(false);
    if (updateErr) { setError(updateErr.message); return; }
    setScreen("set_done");
  }

  // ── Forgot from settings (already authenticated — same as "change"
  //     but skips the current-password step) ──
  async function handleForgotSendOTP() {
    setError(null);
    setLoading(true);
    const accessToken = await getAccessToken();
    const { error: otpErr } = await sendOTP({ purpose: "change_password", accessToken: accessToken ?? undefined });
    setLoading(false);
    if (otpErr) { setError(otpErr); return; }
    markResendSent(userEmail);
    setActivePurpose("change_password");
    setCooldown(60);
    setScreen("forgot_otp");
  }

  async function handleForgotOTPVerify(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const accessToken = await getAccessToken();
    const { error: serverErr } = await verifyOTPServer({
      purpose: "change_password", code: otpCode, accessToken: accessToken ?? undefined,
    });
    setLoading(false);
    if (serverErr) { setError(serverErr); return; }
    setScreen("forgot_newpass");
  }

  async function handleForgotSetPassword(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!pwV.allPassed) { setError("Password doesn't meet requirements."); return; }
    if (newPw !== confirmPw) { setError("Passwords don't match."); return; }
    if (!supabase) { setError("Not configured."); return; }
    setLoading(true);
    // Already-authenticated session — update directly.
    const { error: updateErr } = await supabase.auth.updateUser({ password: newPw });
    setLoading(false);
    if (updateErr) { setError(updateErr.message); return; }
    setScreen("forgot_done");
  }

  async function handleResend() {
    if (cooldown > 0) return;
    setError(null);
    setLoading(true);
    const accessToken = await getAccessToken();
    const { error: otpErr } = await sendOTP({ purpose: activePurpose, accessToken: accessToken ?? undefined });
    setLoading(false);
    if (otpErr) { setError(otpErr); return; }
    markResendSent(userEmail);
    setCooldown(60);
  }

  // ── Render ──

  if (screen === "idle") {
    return (
      <Card className="p-4 mb-4">
        <div className="flex items-center gap-2 mb-3">
          <KeyRound className="w-4 h-4 text-nova-400" />
          <p className="text-sm font-medium">Password &amp; Security</p>
        </div>
        {hasPassword ? (
          <div className="space-y-2">
            <p className="text-xs text-[var(--text-muted)]">A password is set for your account.</p>
            <Button variant="outline" size="sm" className="w-full" onClick={() => setScreen("change_form")}>
              Change password
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-[var(--text-muted)]">No password has been set.</p>
            <Button variant="outline" size="sm" className="w-full" onClick={() => setScreen("set_form")}>
              Set password
            </Button>
          </div>
        )}
      </Card>
    );
  }

  // ── Change: form ──
  if (screen === "change_form") {
    return (
      <Card className="p-4 mb-4">
        <button onClick={reset} className="flex items-center gap-1 text-xs text-[var(--text-muted)] mb-4 hover:text-[var(--text)] transition-colors">
          <ArrowLeft className="w-3 h-3" /> Back
        </button>
        <div className="flex items-center gap-2 mb-4">
          <KeyRound className="w-4 h-4 text-nova-400" />
          <p className="text-sm font-medium">Change password</p>
        </div>
        <form onSubmit={handleChangeSubmit} className="space-y-3">
          <PwField label="Current password" value={currentPw} onChange={setCurrentPw} show={showCurrent} onToggle={() => setShowCurrent(v => !v)} />
          <div className="flex justify-end -mt-1">
            <button type="button" onClick={handleForgotSendOTP} disabled={loading} className="text-xs text-nova-400 hover:text-nova-300 transition-colors">
              {loading ? "Sending…" : "Forgot password?"}
            </button>
          </div>
          <PwField label="New password" value={newPw} onChange={setNewPw} show={showNew} onToggle={() => setShowNew(v => !v)} />
          <PwField label="Confirm new password" value={confirmPw} onChange={setConfirmPw} show={showNew} onToggle={() => setShowNew(v => !v)} />
          {newPw && <PwChecklist pw={newPw} confirm={confirmPw} />}
          {error && <p className="text-xs text-ember-400">{error}</p>}
          <Button type="submit" size="sm" className="w-full" disabled={loading}>
            {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : "Continue"}
          </Button>
        </form>
      </Card>
    );
  }

  // ── Set: form ──
  if (screen === "set_form") {
    return (
      <Card className="p-4 mb-4">
        <button onClick={reset} className="flex items-center gap-1 text-xs text-[var(--text-muted)] mb-4 hover:text-[var(--text)] transition-colors">
          <ArrowLeft className="w-3 h-3" /> Back
        </button>
        <div className="flex items-center gap-2 mb-4">
          <KeyRound className="w-4 h-4 text-nova-400" />
          <p className="text-sm font-medium">Set password</p>
        </div>
        <form onSubmit={handleSetSubmit} className="space-y-3">
          <PwField label="New password" value={newPw} onChange={setNewPw} show={showNew} onToggle={() => setShowNew(v => !v)} />
          <PwField label="Confirm password" value={confirmPw} onChange={setConfirmPw} show={showNew} onToggle={() => setShowNew(v => !v)} />
          {newPw && <PwChecklist pw={newPw} confirm={confirmPw} />}
          {error && <p className="text-xs text-ember-400">{error}</p>}
          <Button type="submit" size="sm" className="w-full" disabled={loading}>
            {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : "Continue"}
          </Button>
        </form>
      </Card>
    );
  }

  // ── OTP screens ──
  const isOTP = screen === "change_otp" || screen === "set_otp" || screen === "forgot_otp";
  if (isOTP) {
    const onVerify = screen === "change_otp" ? handleChangeOTPVerify : screen === "set_otp" ? handleSetOTPVerify : handleForgotOTPVerify;
    return (
      <Card className="p-4 mb-4">
        <div className="flex items-center gap-2 mb-3">
          <KeyRound className="w-4 h-4 text-nova-400" />
          <p className="text-sm font-medium">Verify your identity</p>
        </div>
        <p className="text-xs text-[var(--text-muted)] mb-4">
          We sent a 6-digit code to <strong>{userEmail}</strong>. Enter it below.
        </p>
        <form onSubmit={onVerify} className="space-y-3">
          <input
            type="text"
            inputMode="numeric"
            placeholder="6-digit code"
            value={otpCode}
            onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-4 py-2.5 text-sm text-center tracking-[0.4em] font-mono outline-none focus:border-nova-500 focus:shadow-glow placeholder:text-[var(--text-muted)] placeholder:tracking-normal"
            maxLength={6}
            required
          />
          {error && <p className="text-xs text-ember-400">{error}</p>}
          <Button type="submit" size="sm" className="w-full" disabled={loading || otpCode.length < 6}>
            {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : "Verify"}
          </Button>
          <button type="button" onClick={handleResend} disabled={cooldown > 0 || loading} className="w-full text-xs text-[var(--text-muted)] hover:text-nova-400 transition-colors disabled:opacity-50">
            {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code"}
          </button>
        </form>
      </Card>
    );
  }

  // ── Forgot: new password ──
  if (screen === "forgot_newpass") {
    return (
      <Card className="p-4 mb-4">
        <div className="flex items-center gap-2 mb-3">
          <KeyRound className="w-4 h-4 text-nova-400" />
          <p className="text-sm font-medium">Set new password</p>
        </div>
        <form onSubmit={handleForgotSetPassword} className="space-y-3">
          <PwField label="New password" value={newPw} onChange={setNewPw} show={showNew} onToggle={() => setShowNew(v => !v)} />
          <PwField label="Confirm password" value={confirmPw} onChange={setConfirmPw} show={showNew} onToggle={() => setShowNew(v => !v)} />
          {newPw && <PwChecklist pw={newPw} confirm={confirmPw} />}
          {error && <p className="text-xs text-ember-400">{error}</p>}
          <Button type="submit" size="sm" className="w-full" disabled={loading || !pwV.allPassed || newPw !== confirmPw}>
            {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : "Update password"}
          </Button>
        </form>
      </Card>
    );
  }

  // ── Done screens ──
  const doneMsg =
    screen === "change_done" ? "Password updated successfully."
    : screen === "set_done" ? "Password created! You can now log in with email and password."
    : "Password updated successfully.";

  return (
    <Card className="p-4 mb-4">
      <div className="flex items-center gap-3 mb-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-aurora-500/15">
          <CheckCircle2 className="w-5 h-5 text-aurora-400" />
        </span>
        <div>
          <p className="text-sm font-medium">Done!</p>
          <p className="text-xs text-[var(--text-muted)]">{doneMsg}</p>
        </div>
      </div>
      <Button variant="outline" size="sm" className="w-full" onClick={reset}>
        Back to settings
      </Button>
    </Card>
  );
}

function PwField({
  label, value, onChange, show, onToggle,
}: { label: string; value: string; onChange: (v: string) => void; show: boolean; onToggle: () => void }) {
  return (
    <div className="space-y-1">
      <label className="text-xs text-[var(--text-muted)]">{label}</label>
      <div className="relative">
        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-muted)]" />
        <input
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] pl-9 pr-9 py-2.5 text-sm outline-none focus:border-nova-500 focus:shadow-glow placeholder:text-[var(--text-muted)]"
          placeholder={label}
          autoComplete="new-password"
        />
        <button type="button" onClick={onToggle} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text)] transition-colors">
          {show ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
        </button>
      </div>
    </div>
  );
}

function PwChecklist({ pw, confirm }: { pw: string; confirm: string }) {
  const v = validatePassword(pw);
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 py-2 space-y-1">
      <VRow ok={v.minLength} label="At least 8 characters" />
      <VRow ok={v.hasLetter} label="Contains a letter" />
      <VRow ok={v.hasNumber} label="Contains a number" />
      {confirm && <VRow ok={pw === confirm} label="Passwords match" />}
    </div>
  );
}

function VRow({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className={`flex items-center gap-2 text-xs transition-colors ${ok ? "text-aurora-400" : "text-[var(--text-muted)]"}`}>
      <CheckCircle2 className={`w-3 h-3 ${ok ? "opacity-100" : "opacity-30"}`} />
      {label}
    </div>
  );
}

// ─── Main Settings Page ───────────────────────────────────────────────────────

export default function SettingsPage() {
  const { settings, updateSettings, weights } = useStore();
  const { user, signOut } = useAuth();
  const [hasPassword, setHasPassword] = useState(false);

  const currentWeight = useMemo(
    () => (weights.length > 0 ? weights[weights.length - 1].weightKg : settings.startWeightKg),
    [weights, settings.startWeightKg]
  );
  const weightWarning = goalWeightWarning(settings.goalMode, currentWeight, settings.goalWeightKg);
  const calorieWarning = calorieGoalWarning(currentWeight, settings.goalMode, settings.calorieGoal);

  // Determine if user has a password set via server-side check (reliable)
  useEffect(() => {
    if (!user) return;
    // Use the server-side check which inspects encrypted_password column directly.
    // Client-side identity checks are unreliable because Supabase may create an
    // "email" identity for OAuth users too.
    supabase?.auth.getSession().then(({ data }) => {
      const token = data.session?.access_token;
      if (token) {
        checkHasPassword(token).then(setHasPassword);
      } else {
        // Fallback: check app_metadata.provider
        const provider: string = user.app_metadata?.provider ?? "";
        setHasPassword(provider === "email");
      }
    });
  }, [user]);

  return (
    <div className="px-5 pt-6">
      <header className="mb-5">
        <p className="text-sm text-[var(--text-muted)]">Tune your goals</p>
        <h1 className="font-display text-2xl font-semibold">Settings</h1>
      </header>

      <Card className="p-4 mb-4 flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-nova-500 to-aurora-500 shadow-glow-nova">
          <Mail className="w-4 h-4 text-white" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs text-[var(--text-muted)]">Signed in as</p>
          <p className="text-sm font-medium truncate">{user?.email}</p>
        </div>
        <Button variant="outline" size="sm" onClick={signOut}>
          <LogOut className="w-4 h-4" /> Sign out
        </Button>
      </Card>

      {/* Password & Security */}
      {user?.email && (
        <PasswordSection userEmail={user.email} hasPassword={hasPassword} />
      )}

      <Card className="p-4 mb-4">
        <p className="text-sm font-medium mb-3">Goal</p>
        <div className="grid grid-cols-3 gap-2">
          {(["gain", "lose", "maintain"] as GoalMode[]).map((g) => {
            const Icon = GOAL_ICONS[g];
            return (
              <button
                key={g}
                onClick={() => updateSettings({ goalMode: g })}
                className={`py-2.5 rounded-xl text-sm font-medium border transition-colors flex flex-col items-center justify-center gap-1 ${
                  settings.goalMode === g ? "bg-nova-700 text-white border-nova-700" : "border-[var(--border)]"
                }`}
              >
                <Icon className="w-4 h-4" />
                {GOAL_SHORT_LABELS[g]}
              </button>
            );
          })}
        </div>
        {weightWarning && (
          <div className="mt-3 flex items-start gap-2 rounded-xl border border-ember-500/30 bg-ember-500/10 px-3.5 py-3 text-xs text-ember-600">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{weightWarning}</span>
          </div>
        )}
      </Card>

      <Card className="p-4 mb-4 space-y-4">
        <NumberRow label="Daily calorie goal" value={settings.calorieGoal} suffix="kcal" onChange={(v) => updateSettings({ calorieGoal: v })} />
        {calorieWarning && (
          <div className="flex items-start gap-2 rounded-xl border border-ember-500/30 bg-ember-500/10 px-3.5 py-3 text-xs text-ember-600">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{calorieWarning}</span>
          </div>
        )}
        <Divider />
        <NumberRow label="Protein goal" value={settings.proteinGoal} suffix="g" onChange={(v) => updateSettings({ proteinGoal: v })} />
        <Divider />
        <NumberRow label="Goal weight" value={settings.goalWeightKg} suffix="kg" step={0.5} onChange={(v) => updateSettings({ goalWeightKg: v })} />
        <Divider />
        <NumberRow label="Water goal" value={settings.waterGoalMl} suffix="ml" step={100} onChange={(v) => updateSettings({ waterGoalMl: v })} />
      </Card>

      <Card className="p-4 mb-4">
        <p className="text-sm font-medium mb-3">Units</p>
        <div className="flex gap-2">
          {(["metric", "imperial"] as const).map((u) => (
            <button
              key={u}
              onClick={() => updateSettings({ units: u })}
              className={`flex-1 py-2 rounded-xl text-sm font-medium border transition-colors capitalize ${
                settings.units === u ? "bg-nova-700 text-white border-nova-700" : "border-[var(--border)]"
              }`}
            >
              {u}
            </button>
          ))}
        </div>
      </Card>

      <Card className="p-4">
        <p className="text-sm font-medium mb-3">Theme</p>
        <div className="grid grid-cols-2 gap-2">
          {[
            { key: "light", icon: Sun },
            { key: "dark", icon: Moon },
            { key: "system", icon: Monitor },
            { key: "princess", icon: Heart },
          ].map(({ key, icon: Icon }) => (
            <button
              key={key}
              onClick={() => updateSettings({ theme: key as typeof settings.theme })}
              className={`py-2.5 rounded-xl text-sm font-medium border transition-colors flex items-center justify-center gap-1.5 capitalize ${
                settings.theme === key
                  ? key === "princess"
                    ? "bg-[#f4429e] text-white border-[#f4429e]"
                    : "bg-nova-700 text-white border-nova-700"
                  : "border-[var(--border)]"
              }`}
            >
              <Icon className={`w-4 h-4 ${key === "princess" && settings.theme !== "princess" ? "text-[#f4429e]" : ""}`} />{" "}
              {key}
            </button>
          ))}
        </div>
      </Card>
    </div>
  );
}

function Divider() {
  return <div className="h-px bg-[var(--border)]" />;
}

function NumberRow({
  label, value, suffix, step = 10, onChange,
}: { label: string; value: number; suffix: string; step?: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm font-medium">{label}</span>
      <div className="flex items-center gap-3">
        <button onClick={() => onChange(Math.max(0, value - step))} className="h-8 w-8 rounded-full bg-nova-700/8 dark:bg-nova-100/10 flex items-center justify-center active:scale-90 transition-transform">−</button>
        <span className="w-20 flex items-baseline justify-center gap-1 text-sm tabular-nums font-semibold">
          <EditableNumber value={value} onChange={(v) => onChange(Math.max(0, v))} ariaLabel={label} className="w-12 bg-transparent" />
          <span className="text-[var(--text-muted)] font-normal">{suffix}</span>
        </span>
        <button onClick={() => onChange(value + step)} className="h-8 w-8 rounded-full bg-nova-700/8 dark:bg-nova-100/10 flex items-center justify-center active:scale-90 transition-transform">+</button>
      </div>
    </div>
  );
}
