"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { useAdminTheme } from "@/lib/adminTheme";
import { supabase } from "@/lib/supabase";
import { sendOTP, verifyOTPServer, updatePasswordAfterOtp, validatePassword, markResendSent } from "@/lib/passwordUtils";
import { Mail, Lock, Loader2, ShieldCheck, AlertCircle, Sun, Moon, ArrowLeft, CheckCircle2 } from "lucide-react";
import "../admin.css";

type Screen = "login" | "fp_email" | "fp_otp" | "fp_newpass" | "fp_done";

function ValidationRow({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className={`flex items-center gap-2`} style={{ fontSize: 12, color: ok ? "var(--a-success-text)" : "var(--a-text-3)" }}>
      <CheckCircle2 style={{ width: 12, height: 12, opacity: ok ? 1 : 0.3 }} />
      {label}
    </div>
  );
}

export default function AdminLoginPage() {
  const { signInWithEmail, user, loading: authLoading } = useAuth();
  const { isDark, toggleTheme } = useAdminTheme();
  const router = useRouter();

  const [screen, setScreen] = useState<Screen>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fpEmail, setFpEmail] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const [verifyToken, setVerifyToken] = useState<string | null>(null);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  useEffect(() => {
    if (authLoading || !user || !supabase) return;
    supabase
      .from("user_settings")
      .select("is_store_admin")
      .eq("user_id", user.id)
      .single()
      .then(async ({ data }) => {
        if (data?.is_store_admin) {
          router.replace("/admin/dashboard");
        } else {
          await supabase!.auth.signOut();
          setError("This account does not have administrator access.");
        }
      });
  }, [user, authLoading, router]);

  async function handleGoogle() {
    setError(null);
    setGoogleLoading(true);
    if (!supabase) { setError("Supabase isn't configured."); setGoogleLoading(false); return; }
    const { error: err } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: typeof window !== "undefined" ? `${window.location.origin}/admin/login` : undefined },
    });
    if (err) { setError(err.message); setGoogleLoading(false); }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error: authError } = await signInWithEmail(email, password);
    if (authError) { setError(authError); setLoading(false); return; }
    if (!supabase) { setError("Supabase isn't configured."); setLoading(false); return; }
    const { data: settings } = await supabase.auth.getUser();
    if (!settings?.user) { setError("Authentication failed."); setLoading(false); return; }
    const { data: userSettings } = await supabase
      .from("user_settings")
      .select("is_store_admin")
      .eq("user_id", settings.user.id)
      .single();
    if (!userSettings?.is_store_admin) {
      await supabase.auth.signOut();
      setError("This account does not have administrator access.");
      setLoading(false);
      return;
    }
    router.replace("/admin/dashboard");
  }

  // Forgot password — admins are regular Supabase Auth users (identified by
  // is_store_admin in user_settings), so this reuses the same unauthenticated
  // forgot-password OTP flow as the main app, entirely server-side.
  async function handleForgotSend(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error: err } = await sendOTP({ purpose: "forgot_password", email: fpEmail });
    setLoading(false);
    if (err) { setError(err); return; }
    setCooldown(60);
    setScreen("fp_otp");
  }

  async function handleForgotVerifyOTP(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error: serverErr, verifyToken: token } = await verifyOTPServer({
      purpose: "forgot_password", code: otpCode, email: fpEmail,
    });
    setLoading(false);
    if (serverErr || !token) { setError(serverErr ?? "Invalid or expired code."); return; }
    setVerifyToken(token);
    setScreen("fp_newpass");
  }

  async function handleForgotSetPassword(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const v = validatePassword(newPassword);
    if (!v.allPassed) { setError("Password doesn't meet requirements."); return; }
    if (newPassword !== confirmPassword) { setError("Passwords don't match."); return; }
    if (!verifyToken) { setError("Verification expired. Please start again."); setScreen("fp_email"); return; }
    setLoading(true);
    const { error: err } = await updatePasswordAfterOtp({ email: fpEmail, verifyToken, newPassword });
    setLoading(false);
    if (err) { setError(err); return; }
    setVerifyToken(null);
    setScreen("fp_done");
  }

  async function handleResend() {
    if (cooldown > 0) return;
    setError(null);
    setLoading(true);
    const { error: err } = await sendOTP({ purpose: "forgot_password", email: fpEmail });
    setLoading(false);
    if (err) { setError(err); return; }
    markResendSent(fpEmail);
    setCooldown(60);
  }

  const pwV = validatePassword(newPassword);

  return (
    <div className="a-login-wrap" style={{ background: "var(--a-bg)" }}>
      <button onClick={toggleTheme} className="a-login-theme-btn" aria-label={isDark ? "Light mode" : "Dark mode"} title={isDark ? "Light mode" : "Dark mode"}>
        {isDark ? <Sun style={{ width: 13, height: 13 }} /> : <Moon style={{ width: 13, height: 13 }} />}
        {isDark ? "Light" : "Dark"}
      </button>

      <div className="a-login-card">
        {screen === "login" && (
          <>
            <div className="a-login-logo">
              <div className="a-login-logo-icon"><ShieldCheck style={{ width: 22, height: 22 }} /></div>
              <div>
                <div className="a-login-title">BB Store Admin</div>
                <div className="a-login-sub">Administrator access only</div>
              </div>
            </div>

            <button type="button" onClick={handleGoogle} disabled={googleLoading || loading} className="a-btn a-btn-secondary a-btn-lg" style={{ width: "100%", marginBottom: 16 }}>
              {googleLoading ? <Loader2 style={{ width: 14, height: 14 }} className="animate-spin" /> : (
                <svg style={{ width: 16, height: 16 }} viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
              )}
              {googleLoading ? "Signing in…" : "Continue with Google"}
            </button>

            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
              <div style={{ height: 1, flex: 1, background: "var(--a-border)" }} />
              <span style={{ fontSize: 11, color: "var(--a-text-3)" }}>or</span>
              <div style={{ height: 1, flex: 1, background: "var(--a-border)" }} />
            </div>

            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ position: "relative" }}>
                <Mail style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", width: 14, height: 14, color: "var(--a-text-3)", pointerEvents: "none" }} />
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" placeholder="Email address" className="a-form-input" style={{ paddingLeft: 32, height: 38 }} />
              </div>
              <div style={{ position: "relative" }}>
                <Lock style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", width: 14, height: 14, color: "var(--a-text-3)", pointerEvents: "none" }} />
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" placeholder="Password" className="a-form-input" style={{ paddingLeft: 32, height: 38 }} />
              </div>

              <div style={{ textAlign: "right", marginTop: -4 }}>
                <button type="button" onClick={() => { setFpEmail(email); setScreen("fp_email"); setError(null); }} style={{ fontSize: 12, color: "var(--a-primary)", background: "none", border: "none", cursor: "pointer" }}>
                  Forgot password?
                </button>
              </div>

              {error && (
                <div className="a-alert a-alert-error">
                  <AlertCircle style={{ width: 14, height: 14, flexShrink: 0, marginTop: 1 }} />
                  <span>{error}</span>
                </div>
              )}

              <button type="submit" disabled={loading || googleLoading} className="a-btn a-btn-primary a-btn-lg" style={{ width: "100%", marginTop: 4 }}>
                {loading ? <Loader2 style={{ width: 14, height: 14 }} className="animate-spin" /> : <ShieldCheck style={{ width: 14, height: 14 }} />}
                {loading ? "Verifying…" : "Sign in to Admin"}
              </button>
            </form>

            <p style={{ textAlign: "center", fontSize: 12, color: "var(--a-text-3)", marginTop: 20 }}>
              Not an admin?{" "}
              <a href="/login" style={{ color: "var(--a-primary)", textDecoration: "none", fontWeight: 500 }}>Go to BB Health</a>
            </p>
          </>
        )}

        {/* ── Forgot: enter email ── */}
        {screen === "fp_email" && (
          <>
            <button onClick={() => { setScreen("login"); setError(null); }} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--a-text-3)", background: "none", border: "none", cursor: "pointer", marginBottom: 16 }}>
              <ArrowLeft style={{ width: 13, height: 13 }} /> Back to login
            </button>
            <div className="a-login-logo" style={{ marginBottom: 16 }}>
              <div className="a-login-logo-icon"><Lock style={{ width: 18, height: 18 }} /></div>
              <div>
                <div className="a-login-title">Reset password</div>
                <div className="a-login-sub">We'll send a code to your email</div>
              </div>
            </div>
            <form onSubmit={handleForgotSend} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ position: "relative" }}>
                <Mail style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", width: 14, height: 14, color: "var(--a-text-3)", pointerEvents: "none" }} />
                <input type="email" value={fpEmail} onChange={(e) => setFpEmail(e.target.value)} required autoComplete="email" placeholder="Your admin email" className="a-form-input" style={{ paddingLeft: 32, height: 38 }} />
              </div>
              {error && <div className="a-alert a-alert-error"><AlertCircle style={{ width: 14, height: 14, flexShrink: 0 }} /><span>{error}</span></div>}
              <button type="submit" disabled={loading} className="a-btn a-btn-primary a-btn-lg" style={{ width: "100%" }}>
                {loading ? <Loader2 style={{ width: 14, height: 14 }} className="animate-spin" /> : "Send verification code"}
              </button>
            </form>
          </>
        )}

        {/* ── Forgot: OTP ── */}
        {screen === "fp_otp" && (
          <>
            <button onClick={() => { setScreen("fp_email"); setError(null); }} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--a-text-3)", background: "none", border: "none", cursor: "pointer", marginBottom: 16 }}>
              <ArrowLeft style={{ width: 13, height: 13 }} /> Back
            </button>
            <div className="a-login-logo" style={{ marginBottom: 16 }}>
              <div className="a-login-logo-icon"><ShieldCheck style={{ width: 18, height: 18 }} /></div>
              <div>
                <div className="a-login-title">Enter code</div>
                <div className="a-login-sub">Sent to {fpEmail}</div>
              </div>
            </div>
            <form onSubmit={handleForgotVerifyOTP} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <input
                type="text" inputMode="numeric" placeholder="6-digit code" value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                maxLength={6} required className="a-form-input"
                style={{ height: 42, textAlign: "center", letterSpacing: "0.4em", fontFamily: "monospace", fontSize: 18 }}
              />
              {error && <div className="a-alert a-alert-error"><AlertCircle style={{ width: 14, height: 14, flexShrink: 0 }} /><span>{error}</span></div>}
              <button type="submit" disabled={loading || otpCode.length < 6} className="a-btn a-btn-primary a-btn-lg" style={{ width: "100%" }}>
                {loading ? <Loader2 style={{ width: 14, height: 14 }} className="animate-spin" /> : "Verify code"}
              </button>
              <button type="button" onClick={handleResend} disabled={cooldown > 0 || loading} style={{ fontSize: 12, color: "var(--a-text-3)", background: "none", border: "none", cursor: "pointer", opacity: cooldown > 0 ? 0.5 : 1 }}>
                {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code"}
              </button>
            </form>
          </>
        )}

        {/* ── Forgot: new password ── */}
        {screen === "fp_newpass" && (
          <>
            <div className="a-login-logo" style={{ marginBottom: 16 }}>
              <div className="a-login-logo-icon"><Lock style={{ width: 18, height: 18 }} /></div>
              <div>
                <div className="a-login-title">New password</div>
                <div className="a-login-sub">Choose a strong password</div>
              </div>
            </div>
            <form onSubmit={handleForgotSetPassword} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ position: "relative" }}>
                <Lock style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", width: 14, height: 14, color: "var(--a-text-3)", pointerEvents: "none" }} />
                <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required autoComplete="new-password" placeholder="New password" className="a-form-input" style={{ paddingLeft: 32, height: 38 }} />
              </div>
              <div style={{ position: "relative" }}>
                <Lock style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", width: 14, height: 14, color: "var(--a-text-3)", pointerEvents: "none" }} />
                <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required autoComplete="new-password" placeholder="Confirm password" className="a-form-input" style={{ paddingLeft: 32, height: 38 }} />
              </div>
              {newPassword && (
                <div style={{ padding: "10px 12px", background: "var(--a-surface)", borderRadius: "var(--a-radius)", border: "1px solid var(--a-border)", display: "flex", flexDirection: "column", gap: 4 }}>
                  <ValidationRow ok={pwV.minLength} label="At least 8 characters" />
                  <ValidationRow ok={pwV.hasLetter} label="Contains a letter" />
                  <ValidationRow ok={pwV.hasNumber} label="Contains a number" />
                  {confirmPassword && <ValidationRow ok={newPassword === confirmPassword} label="Passwords match" />}
                </div>
              )}
              {error && <div className="a-alert a-alert-error"><AlertCircle style={{ width: 14, height: 14, flexShrink: 0 }} /><span>{error}</span></div>}
              <button type="submit" disabled={loading || !pwV.allPassed || newPassword !== confirmPassword} className="a-btn a-btn-primary a-btn-lg" style={{ width: "100%" }}>
                {loading ? <Loader2 style={{ width: 14, height: 14 }} className="animate-spin" /> : "Reset password"}
              </button>
            </form>
          </>
        )}

        {/* ── Forgot: done ── */}
        {screen === "fp_done" && (
          <div style={{ textAlign: "center", padding: "16px 0" }}>
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 14 }}>
              <div style={{ width: 52, height: 52, borderRadius: "50%", background: "var(--a-success-bg)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <CheckCircle2 style={{ width: 26, height: 26, color: "var(--a-success-text)" }} />
              </div>
            </div>
            <div className="a-login-title" style={{ marginBottom: 6 }}>Password reset!</div>
            <div className="a-login-sub" style={{ marginBottom: 20 }}>You can now sign in with your new password.</div>
            <button className="a-btn a-btn-primary a-btn-lg" style={{ width: "100%" }} onClick={() => { setScreen("login"); setError(null); setOtpCode(""); setNewPassword(""); setConfirmPassword(""); }}>
              Return to login
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
