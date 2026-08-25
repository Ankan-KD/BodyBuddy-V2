"use client";

import type { Session, User } from "@supabase/supabase-js";
import React, { createContext, useContext, useEffect, useState } from "react";
import { isSupabaseConfigured, supabase } from "./supabase";

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  loading: boolean;
  configured: boolean;
  signUpWithEmail: (email: string, password: string, name: string) => Promise<{ error: string | null }>;
  signInWithEmail: (email: string, password: string) => Promise<{ error: string | null }>;
  signInWithGoogle: () => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setLoading(false);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  async function signUpWithEmail(email: string, password: string, name: string) {
    if (!supabase) return { error: "Supabase isn't configured yet." };
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name } },
    });
    return { error: error?.message ?? null };
  }

  async function signInWithEmail(email: string, password: string) {
    if (!supabase) return { error: "Supabase isn't configured yet." };
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  }

  async function signInWithGoogle() {
    if (!supabase) return { error: "Supabase isn't configured yet." };
    // Redirect back to the app root after Google OAuth completes.
    // The Gate component in AppShell handles routing from there:
    //   • New users (no onboarding data) → /onboarding
    //   • Returning users → / (dashboard)
    // Using window.location.origin ensures no stale /login path is kept,
    // which would cause a redirect loop since signed-in users are bounced
    // away from /login.
    const redirectTo =
      typeof window !== "undefined" ? window.location.origin + "/" : undefined;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo,
        // Ask Supabase to skip the password-link step for existing email/password
        // accounts with the same email — instead it merges the Google identity
        // into the existing account automatically (requires "Link accounts" to be
        // enabled in the Supabase Auth dashboard).
        queryParams: {
          access_type: "online",
          prompt: "select_account",
        },
      },
    });
    return { error: error?.message ?? null };
  }

  async function signOut() {
    if (!supabase) return;
    await supabase.auth.signOut();
  }

  const value: AuthContextValue = {
    user: session?.user ?? null,
    session,
    loading,
    configured: isSupabaseConfigured,
    signUpWithEmail,
    signInWithEmail,
    signInWithGoogle,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
