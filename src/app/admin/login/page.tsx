"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { Mail, Lock, Loader2, ShieldCheck, AlertCircle } from "lucide-react";
import "../admin.css";

export default function AdminLoginPage() {
  const { signInWithEmail, user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
          setError("This Google account does not have administrator access.");
        }
      });
  }, [user, authLoading, router]);

  async function handleGoogle() {
    setError(null);
    setGoogleLoading(true);
    if (!supabase) { setError("Supabase isn't configured."); setGoogleLoading(false); return; }
    const { error: err } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: typeof window !== "undefined" ? `${window.location.origin}/admin/login` : undefined,
      },
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

  return (
    <div className="admin-shell a-login-wrap" style={{ background: "var(--a-bg)" }}>
      <div className="a-login-card">
        {/* Logo */}
        <div className="a-login-logo">
          <div className="a-login-logo-icon">
            <ShieldCheck style={{ width: 22, height: 22 }} />
          </div>
          <div>
            <div className="a-login-title">BB Store Admin</div>
            <div className="a-login-sub">Administrator access only</div>
          </div>
        </div>

        {/* Google button */}
        <button
          type="button"
          onClick={handleGoogle}
          disabled={googleLoading || loading}
          className="a-btn a-btn-secondary a-btn-lg"
          style={{ width: "100%", marginBottom: 16 }}
        >
          {googleLoading ? (
            <Loader2 style={{ width: 14, height: 14 }} className="animate-spin" />
          ) : (
            <svg style={{ width: 16, height: 16 }} viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
          )}
          {googleLoading ? "Signing in…" : "Continue with Google"}
        </button>

        {/* Divider */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
          <div style={{ height: 1, flex: 1, background: "var(--a-border)" }} />
          <span style={{ fontSize: 11, color: "var(--a-text-3)" }}>or</span>
          <div style={{ height: 1, flex: 1, background: "var(--a-border)" }} />
        </div>

        {/* Email form */}
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ position: "relative" }}>
            <Mail style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", width: 14, height: 14, color: "var(--a-text-3)", pointerEvents: "none" }} />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              placeholder="Email address"
              className="a-form-input"
              style={{ paddingLeft: 32, height: 38 }}
            />
          </div>

          <div style={{ position: "relative" }}>
            <Lock style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", width: 14, height: 14, color: "var(--a-text-3)", pointerEvents: "none" }} />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              placeholder="Password"
              className="a-form-input"
              style={{ paddingLeft: 32, height: 38 }}
            />
          </div>

          {error && (
            <div className="a-alert a-alert-error">
              <AlertCircle style={{ width: 14, height: 14, flexShrink: 0, marginTop: 1 }} />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading || googleLoading}
            className="a-btn a-btn-primary a-btn-lg"
            style={{ width: "100%", marginTop: 4 }}
          >
            {loading ? <Loader2 style={{ width: 14, height: 14 }} className="animate-spin" /> : <ShieldCheck style={{ width: 14, height: 14 }} />}
            {loading ? "Verifying…" : "Sign in to Admin"}
          </button>
        </form>

        <p style={{ textAlign: "center", fontSize: 12, color: "var(--a-text-3)", marginTop: 20 }}>
          Not an admin?{" "}
          <a href="/login" style={{ color: "var(--a-primary)", textDecoration: "none", fontWeight: 500 }}>
            Go to BB Health
          </a>
        </p>
      </div>
    </div>
  );
}
