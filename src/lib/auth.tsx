"use client";

import type { Session, User } from "@supabase/supabase-js";
import React, { createContext, useContext, useEffect, useState } from "react";
import { isSupabaseConfigured, supabase } from "./supabase";
import { checkPasswordState } from "./passwordUtils";

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  loading: boolean;
  configured: boolean;
  // ── Account state (password / email-verification) ─────────────────────
  // Lives here — NOT locally inside AppShell's Gate — so that the exact
  // components performing the OTP-verify and set-password actions can
  // update it optimistically, in the same tick as their own success
  // handler, before they navigate anywhere. See markEmailVerified() and
  // markPasswordSetLocally() below for why this matters.
  hasPassword: boolean | null;
  pendingEmailVerify: boolean | null;
  markEmailVerified: () => void;
  markPasswordSetLocally: () => void;
  refreshAccountState: () => void;
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

  // ── Account state: hasPassword / pendingEmailVerify ────────────────────
  // null = "still resolving", true/false = resolved.
  //
  // THIS USED TO LIVE INSIDE AppShell's <Gate>, fetched once per
  // user/session via checkPasswordState() and never updated again except by
  // a fresh fetch. That caused a real, visible bug: the moment OTP
  // verification (or password creation) succeeded SERVER-side, the
  // client's cached copy of pendingEmailVerify/hasPassword was still
  // stale — nothing told it to refetch — so Gate's redirect effect kept
  // acting on old data for a beat, bouncing the user back to /login (or
  // /set-password) right after they'd just cleared that exact step, until
  // the next unrelated re-render/fetch happened to catch it up.
  //
  // Fix: keep this state up here, and let the very components that
  // perform the verify/set-password actions call markEmailVerified() /
  // markPasswordSetLocally() to flip it optimistically, synchronously,
  // BEFORE they navigate — so Gate never has stale data to act on.
  const [hasPassword, setHasPassword] = useState<boolean | null>(null);
  const [pendingEmailVerify, setPendingEmailVerify] = useState<boolean | null>(null);
  // Bumped to force a retry of checkPasswordState after a failed check
  // (network hiccup, transient server error) without needing user/session
  // to actually change.
  const [retryTick, setRetryTick] = useState(0);

  useEffect(() => {
    if (!session?.user || !session.access_token) {
      setHasPassword(null);
      setPendingEmailVerify(null);
      return;
    }
    let cancelled = false;
    checkPasswordState(session.access_token).then(({ hasPassword: hp, pendingEmailVerify: pev, resolved }) => {
      if (cancelled) return;
      if (!resolved) {
        // The check itself failed — NOT the same as "confirmed no
        // password". Stay in "still resolving" (don't overwrite existing
        // state with a guess) and retry shortly.
        setTimeout(() => {
          if (!cancelled) setRetryTick((n) => n + 1);
        }, 1500);
        return;
      }
      setHasPassword(hp);
      setPendingEmailVerify(pev);
    });
    return () => {
      cancelled = true;
    };
  }, [session?.user?.id, session?.access_token, retryTick]);

  // Called the instant OTP verification succeeds (before navigating to
  // /set-password) so the Gate immediately knows this user is no longer
  // pending — it never gets a chance to see the old "true" value.
  function markEmailVerified() {
    setPendingEmailVerify(false);
  }

  // Called the instant a real password is recorded (before navigating
  // onward) so the Gate immediately stops treating this user as needing
  // /set-password.
  function markPasswordSetLocally() {
    setHasPassword(true);
  }

  function refreshAccountState() {
    setRetryTick((n) => n + 1);
  }

  /**
   * Manual email signup.
   * Creates the Supabase auth user with a cryptographically-random temp password
   * (user cannot know it — they will set a real password after OTP verification).
   *
   * signup_method: "manual" in options.data is read by the handle_new_user()
   * DB trigger (see supabase/017_fix_signup_pending_race.sql) to set
   * pending_email_verify = true ATOMICALLY when the user_settings row is
   * created — i.e. before supabase.auth.signUp() even resolves on the
   * client. This used to be done via a separate /api/signup/mark-pending
   * POST call after the fact, which raced against the Gate's own
   * checkPasswordState() read (both fire the moment `user` becomes truthy)
   * and could lose, silently skipping the OTP screen. The mark-pending call
   * below is kept as a defense-in-depth fallback but the trigger is now the
   * actual source of truth.
   */
  async function signUpWithEmail(email: string, password: string, name: string) {
    if (!supabase) return { error: "Supabase isn't configured yet." };

    // Use a random temp password. The user sets a real password on /set-password
    // after OTP email verification — the temp password is never exposed to them.
    const { data, error } = await supabase.auth.signUp({
      email,
      password, // caller passes a random temp password
      options: { data: { name, signup_method: "manual" } },
    });

    if (error) return { error: error.message };

    // If the Supabase project has email confirmation turned OFF (common in dev),
    // the user gets a session immediately. Mark them as pending OTP verification
    // so the Gate prevents webapp access until they complete both steps.
    if (data?.user) {
      // The profiles row may be created by a DB trigger. Update pending_email_verify
      // via a server-side API call so we can use the service role safely.
      try {
        await fetch("/api/signup/mark-pending", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            // Use the new session's access token if available.
            ...(data.session?.access_token
              ? { Authorization: `Bearer ${data.session.access_token}` }
              : {}),
          },
          body: JSON.stringify({ userId: data.user.id }),
        });
      } catch {
        // Non-fatal — the OTP step will still gate access.
      }
    }

    return { error: null };
  }

  async function signInWithEmail(email: string, password: string) {
    if (!supabase) return { error: "Supabase isn't configured yet." };
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  }

  async function signInWithGoogle() {
    if (!supabase) return { error: "Supabase isn't configured yet." };
    const redirectTo =
      typeof window !== "undefined" ? window.location.origin + "/" : undefined;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo,
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
    hasPassword,
    pendingEmailVerify,
    markEmailVerified,
    markPasswordSetLocally,
    refreshAccountState,
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
