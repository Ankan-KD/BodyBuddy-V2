"use client";

import { AppIcon } from "@/components/AppIcon";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import {
  sendOTP,
  verifyOTPServer,
  updatePasswordAfterOtp,
  validatePassword,
  markResendSent,
} from "@/lib/passwordUtils";
import {
  CheckCircle2,
  Loader2,
  Lock,
  Mail,
  User as UserIcon,
  ArrowLeft,
  ShieldCheck,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

type Screen =
  | "auth"           // login / signup
  | "fp_email"       // forgot: enter email
  | "fp_otp"         // forgot: enter OTP
  | "fp_newpass"     // forgot: enter new password
  | "fp_done";       // forgot: success

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  );
}

// ─── Forgot Password Flow ────────────────────────────────────────────────────

function ForgotPasswordFlow({ onBack }: { onBack: () => void }) {
  const [screen, setScreen] = useState<"email" | "otp" | "newpass" | "done">("email");
  const [email, setEmail] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  // One-time ticket returned after OTP verification — proves the caller
  // controls this email's inbox. Required to actually reset the password.
  const [verifyToken, setVerifyToken] = useState<string | null>(null);

  // Cooldown timer
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  async function handleSendOTP(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error: err } = await sendOTP({ purpose: "forgot_password", email });
    setLoading(false);
    if (err) { setError(err); return; }
    setCooldown(60);
    setScreen("otp");
  }

  async function handleResend() {
    if (cooldown > 0) return;
    setError(null);
    setLoading(true);
    const { error: err } = await sendOTP({ purpose: "forgot_password", email });
    setLoading(false);
    if (err) { setError(err); return; }
    markResendSent(email);
    setCooldown(60);
  }

  async function handleVerifyOTP(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    // Verified entirely server-side — no Supabase magic link or session
    // involved. Success returns a short-lived, single-use ticket.
    const { error: serverErr, verifyToken: token } = await verifyOTPServer({
      purpose: "forgot_password", code: otpCode, email,
    });
    setLoading(false);
    if (serverErr || !token) {
      setError(serverErr ?? "Verification failed. Please try again.");
      return;
    }
    setVerifyToken(token);
    setScreen("newpass");
  }

  async function handleSetPassword(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const v = validatePassword(newPassword);
    if (!v.allPassed) { setError("Password doesn't meet requirements."); return; }
    if (newPassword !== confirmPassword) { setError("Passwords don't match."); return; }
    if (!verifyToken) { setError("Verification expired. Please start again."); setScreen("email"); return; }
    setLoading(true);
    const { error: err } = await updatePasswordAfterOtp({ email, verifyToken, newPassword });
    setLoading(false);
    if (err) { setError(err); return; }
    setVerifyToken(null);
    setScreen("done");
  }

  const pwValidation = validatePassword(newPassword);

  if (screen === "email") {
    return (
      <div>
        <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-[var(--text-muted)] mb-6 hover:text-[var(--text)] transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to login
        </button>
        <h2 className="font-display text-xl font-semibold mb-1">Forgot password?</h2>
        <p className="text-sm text-[var(--text-muted)] mb-6">Enter your email and we'll send a verification code.</p>
        <form onSubmit={handleSendOTP} className="space-y-3">
          <FieldInput icon={Mail} type="email" placeholder="Email address" value={email} onChange={setEmail} required />
          {error && <p className="text-xs text-ember-400">{error}</p>}
          <Button type="submit" size="lg" className="w-full" disabled={loading}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Send verification code"}
          </Button>
        </form>
      </div>
    );
  }

  if (screen === "otp") {
    return (
      <div>
        <button onClick={() => setScreen("email")} className="flex items-center gap-1.5 text-sm text-[var(--text-muted)] mb-6 hover:text-[var(--text)] transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" /> Back
        </button>
        <h2 className="font-display text-xl font-semibold mb-1">Enter verification code</h2>
        <p className="text-sm text-[var(--text-muted)] mb-6">
          We sent a 6-digit code to <strong>{email}</strong>. Check your inbox (and spam folder).
        </p>
        <form onSubmit={handleVerifyOTP} className="space-y-3">
          <input
            type="text"
            inputMode="numeric"
            placeholder="6-digit code"
            value={otpCode}
            onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-4 py-3 text-sm text-center tracking-[0.4em] font-mono outline-none focus:border-nova-500 focus:shadow-glow placeholder:text-[var(--text-muted)] placeholder:tracking-normal"
            maxLength={6}
            required
          />
          {error && <p className="text-xs text-ember-400">{error}</p>}
          <Button type="submit" size="lg" className="w-full" disabled={loading || otpCode.length < 6}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Verify code"}
          </Button>
          <button
            type="button"
            onClick={handleResend}
            disabled={cooldown > 0 || loading}
            className="w-full text-sm text-[var(--text-muted)] hover:text-nova-400 transition-colors disabled:opacity-50"
          >
            {cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend code"}
          </button>
        </form>
      </div>
    );
  }

  if (screen === "newpass") {
    return (
      <div>
        <h2 className="font-display text-xl font-semibold mb-1">Set new password</h2>
        <p className="text-sm text-[var(--text-muted)] mb-6">Choose a strong password for your account.</p>
        <form onSubmit={handleSetPassword} className="space-y-3">
          <FieldInput icon={Lock} type="password" placeholder="New password" value={newPassword} onChange={setNewPassword} required />
          <FieldInput icon={Lock} type="password" placeholder="Confirm new password" value={confirmPassword} onChange={setConfirmPassword} required />
          {newPassword && (
            <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-elevated,var(--bg))] px-3 py-2.5 space-y-1">
              <ValidationRow ok={pwValidation.minLength} label="At least 8 characters" />
              <ValidationRow ok={pwValidation.hasLetter} label="Contains a letter" />
              <ValidationRow ok={pwValidation.hasNumber} label="Contains a number" />
              {confirmPassword && (
                <ValidationRow ok={newPassword === confirmPassword} label="Passwords match" />
              )}
            </div>
          )}
          {error && <p className="text-xs text-ember-400">{error}</p>}
          <Button type="submit" size="lg" className="w-full" disabled={loading || !pwValidation.allPassed || newPassword !== confirmPassword}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Reset password"}
          </Button>
        </form>
      </div>
    );
  }

  // done
  return (
    <div className="text-center py-4">
      <div className="flex justify-center mb-4">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-aurora-500/15">
          <CheckCircle2 className="w-7 h-7 text-aurora-400" />
        </span>
      </div>
      <h2 className="font-display text-xl font-semibold mb-2">Password reset!</h2>
      <p className="text-sm text-[var(--text-muted)] mb-6">Your password has been updated. You can now log in with your new password.</p>
      <Button size="lg" className="w-full" onClick={onBack}>
        Return to login
      </Button>
    </div>
  );
}

// ─── Main Login Page ──────────────────────────────────────────────────────────

export default function LoginPage() {
  const { signInWithEmail, signUpWithEmail, signInWithGoogle, configured } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<"signin" | "signup">(
    searchParams.get("mode") === "signup" ? "signup" : "signin"
  );
  const [showForgot, setShowForgot] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setLoading(true);
    const result =
      mode === "signup"
        ? await signUpWithEmail(email, password, name)
        : await signInWithEmail(email, password);
    setLoading(false);
    if (result.error) { setError(result.error); return; }
    if (mode === "signup") {
      setNotice("Account created. If email confirmation is required, check your inbox — otherwise you're in!");
    }
    router.replace("/dashboard");
  }

  async function google() {
    setError(null);
    setGoogleLoading(true);
    const result = await signInWithGoogle();
    if (result.error) { setError(result.error); setGoogleLoading(false); }
  }

  return (
    <div className="min-h-dvh flex flex-col justify-center px-6 py-10">
      <div className="mx-auto w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <AppIcon className="h-16 w-16 rounded-2xl shadow-glow-nova mb-4" />
          <h1 className="font-display text-2xl font-semibold text-glow-nova">BodyBuddy</h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">Your goals, tracked — one day at a time.</p>
        </div>

        {!configured && (
          <div className="mb-5 rounded-xl2 border border-ember-500/40 bg-ember-500/10 px-4 py-3 text-xs text-ember-300">
            Supabase isn&apos;t configured yet. Add <code>NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
            <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> to your environment.
          </div>
        )}

        {showForgot ? (
          <ForgotPasswordFlow onBack={() => { setShowForgot(false); setMode("signin"); }} />
        ) : (
          <>
            <div className="flex rounded-xl2 border border-[var(--border)] p-1 mb-6 glass-panel">
              <button
                type="button"
                onClick={() => setMode("signin")}
                className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors ${
                  mode === "signin" ? "bg-nova-600 text-white shadow-glow-nova" : "text-[var(--text-muted)]"
                }`}
              >
                Log in
              </button>
              <button
                type="button"
                onClick={() => setMode("signup")}
                className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors ${
                  mode === "signup" ? "bg-nova-600 text-white shadow-glow-nova" : "text-[var(--text-muted)]"
                }`}
              >
                Sign up
              </button>
            </div>

            <form onSubmit={submit} className="space-y-3">
              {mode === "signup" && (
                <FieldInput icon={UserIcon} type="text" placeholder="Your name" value={name} onChange={setName} />
              )}
              <FieldInput icon={Mail} type="email" placeholder="Email" value={email} onChange={setEmail} required />
              <div className="space-y-1">
                <FieldInput
                  icon={Lock}
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={setPassword}
                  required
                  minLength={6}
                />
                {mode === "signin" && (
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => { setShowForgot(true); setError(null); }}
                      className="text-xs text-nova-400 hover:text-nova-300 transition-colors"
                    >
                      Forgot password?
                    </button>
                  </div>
                )}
              </div>

              {error && <p className="text-xs text-ember-400">{error}</p>}
              {notice && <p className="text-xs text-aurora-400">{notice}</p>}

              <Button type="submit" size="lg" className="w-full" disabled={loading || !configured}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : mode === "signup" ? "Create account" : "Log in"}
              </Button>
            </form>

            <div className="flex items-center gap-3 my-5">
              <div className="h-px flex-1 bg-[var(--border)]" />
              <span className="text-xs text-[var(--text-muted)]">or</span>
              <div className="h-px flex-1 bg-[var(--border)]" />
            </div>

            <Button
              type="button"
              variant="outline"
              size="lg"
              className="w-full"
              onClick={google}
              disabled={!configured || googleLoading || loading}
            >
              {googleLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <GoogleIcon />}
              {googleLoading ? "Redirecting to Google…" : "Continue with Google"}
            </Button>

            <p className="text-center text-[11px] text-[var(--text-muted)] mt-6">
              Your data is private to your account and synced securely across your devices.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

function FieldInput({
  icon: Icon,
  value,
  onChange,
  ...props
}: {
  icon: typeof Mail;
  value: string;
  onChange: (v: string) => void;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange">) {
  return (
    <div className="relative">
      <Icon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] pl-10 pr-4 py-3 text-sm outline-none focus:border-nova-500 focus:shadow-glow placeholder:text-[var(--text-muted)]"
        {...props}
      />
    </div>
  );
}

function ValidationRow({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className={`flex items-center gap-2 text-xs transition-colors ${ok ? "text-aurora-400" : "text-[var(--text-muted)]"}`}>
      <CheckCircle2 className={`w-3 h-3 ${ok ? "opacity-100" : "opacity-30"}`} />
      {label}
    </div>
  );
}
