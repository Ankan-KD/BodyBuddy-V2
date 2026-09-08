"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { BottomNav } from "./BottomNav";
import { QuickLogSheet } from "./QuickLogSheet";
import { LogDateSwitcher } from "./LogDateSwitcher";
import { StoreProvider, useStore } from "@/lib/store";
import { AuthProvider, useAuth } from "@/lib/auth";
import { Loader2 } from "lucide-react";
import { AppIcon } from "./AppIcon";

function Splash() {
  return (
    <div className="min-h-dvh flex flex-col items-center justify-center gap-3">
      <AppIcon className="h-14 w-14 rounded-2xl shadow-glow-nova animate-pulse-glow" />
      <Loader2 className="w-5 h-5 text-nova-400 animate-spin" />
    </div>
  );
}

function Gate({ children }: { children: React.ReactNode }) {
  const { user, loading, configured, hasPassword, pendingEmailVerify } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [logOpen, setLogOpen] = useState(false);

  const isLogin = pathname === "/login";
  const isPublicMarketing = pathname === "/" || pathname === "/landing";
  const isStore = pathname.startsWith("/store");
  const isAdmin = pathname.startsWith("/admin");
  const isPublic = isLogin || isPublicMarketing;
  const isSetPassword = pathname === "/set-password";
  const hideChrome =
    pathname === "/onboarding" || isPublic || isStore || isAdmin || isSetPassword;

  // hasPassword / pendingEmailVerify now live in AuthProvider (see
  // src/lib/auth.tsx) instead of being fetched locally here. That lets the
  // OTP-verify and set-password screens update them optimistically the
  // instant their server call succeeds — before navigating away — so this
  // Gate never acts on stale account state and bounces the user back to a
  // screen they just finished. pendingEmailVerify=true means: manual
  // signup, OTP not yet verified. While true the user must stay on /login
  // to complete OTP. They cannot advance to /set-password or the webapp
  // until this clears.

  // needsPassword: user is signed in, has no real password yet, and is NOT
  // blocked behind OTP verification (that's a separate earlier gate).
  const needsPassword =
    !!user &&
    !isStore &&
    !isAdmin &&
    hasPassword === false &&
    pendingEmailVerify === false;

  // pendingOtp: user signed up manually, has a temp-password session, but
  // has NOT yet completed email OTP verification. Must stay on /login.
  const pendingOtp = !!user && pendingEmailVerify === true;

  useEffect(() => {
    if (loading) return;

    if (!user && !isPublic && !isStore && !isAdmin) {
      router.replace("/landing");
      return;
    }

    if (user && isPublic && !isLogin) {
      // Redirect away from marketing pages when signed in. Wait for
      // account state to resolve first (isPublicMarketing renders a
      // Splash in the meantime — see below) so a brand-new Google
      // sign-up lands on /set-password directly instead of flashing
      // /dashboard first and then bouncing to /set-password a beat later.
      if (hasPassword === null || pendingEmailVerify === null) return;
      if (pendingOtp) {
        router.replace("/login");
        return;
      }
      if (needsPassword) {
        router.replace("/set-password");
        return;
      }
      router.replace("/dashboard");
      return;
    }

    // If user is signed in and on /login: only redirect them away if they're
    // NOT in the middle of OTP verification (pendingOtp users must stay on
    // /login). Route to /set-password rather than /dashboard if they still
    // need one — this matters right when OTP verification just completed:
    // pendingEmailVerify flips to false optimistically (see
    // markEmailVerified() in src/lib/auth.tsx) slightly before the page's
    // own router.replace("/set-password") lands, and without this check
    // that gap could send them to /dashboard instead, which would then
    // have to bounce them to /set-password anyway.
    if (user && isLogin && pendingEmailVerify === false) {
      if (hasPassword === null) return;
      if (needsPassword) {
        router.replace("/set-password");
        return;
      }
      router.replace("/dashboard");
      return;
    }

    // Pending OTP: user must stay on /login to complete verification.
    if (pendingOtp && !isLogin) {
      router.replace("/login");
      return;
    }

    // No password set → /set-password (but NOT if still pending OTP — OTP first).
    if (needsPassword && !isSetPassword) {
      router.replace("/set-password");
      return;
    }

    // Once password exists, /set-password has nothing left to do.
    if (user && isSetPassword && hasPassword === true) {
      router.replace("/dashboard");
      return;
    }
  }, [
    loading,
    user,
    isPublic,
    isLogin,
    isStore,
    isAdmin,
    needsPassword,
    isSetPassword,
    hasPassword,
    pendingEmailVerify,
    pendingOtp,
    router,
  ]);

  if (loading) return <Splash />;

  if (!user) {
    if (!isPublic && !isStore && !isAdmin) return <Splash />;
    return <>{children}</>;
  }

  // Signed-in user on marketing/landing page — brief splash before redirect.
  if (isPublicMarketing) return <Splash />;

  // Store routes render their own layout.
  if (isStore) return <>{children}</>;

  // Admin routes render their own layout.
  if (isAdmin) return <>{children}</>;

  // /login ALWAYS renders immediately for a signed-in user, even while
  // hasPassword/pendingEmailVerify are still resolving (null).
  //
  // Why this matters: right after supabase.auth.signUp() succeeds, `user`
  // flips from null → truthy on this exact page, but AuthProvider's
  // account-state fetch (checkPasswordState — see src/lib/auth.tsx) hasn't
  // resolved yet. If we fell through to the "still resolving" Splash check
  // below, LoginPage would get unmounted and then
  // remounted from scratch once the fetch resolves — wiping out its internal
  // `screen` state (e.g. "signup_otp") and dropping the user back on the
  // plain sign-in form. That was the "click sign up → get bounced to the
  // login form" bug. LoginPage manages its own screens (OTP, forgot
  // password) independently of these flags; the useEffect above already
  // redirects away from /login once we positively know the account is fully
  // set up, so it's safe to just keep rendering it in the meantime.
  if (isLogin) return <>{children}</>;

  // Still resolving account state — show splash.
  if (hasPassword === null || pendingEmailVerify === null) return <Splash />;

  // Pending OTP: user must stay on /login to complete verification.
  // (isLogin already handled above — reaching here means they navigated
  // away mid-verification, so bounce back with a splash.)
  if (pendingOtp) return <Splash />;

  // Needs password — only /set-password renders.
  if (needsPassword) {
    if (isSetPassword) return <>{children}</>;
    return <Splash />; // mid-redirect
  }

  // /set-password for a user who already has a password → redirect away.
  if (isSetPassword && hasPassword === true) return <Splash />;

  // /set-password for a user who needs to set one — render it.
  if (isSetPassword) return <>{children}</>;

  return (
    <StoreProvider>
      <OnboardingGate hideChrome={hideChrome} configured={configured} logOpen={logOpen} setLogOpen={setLogOpen}>
        {children}
      </OnboardingGate>
    </StoreProvider>
  );
}

/**
 * Sits inside StoreProvider so it can read `settings.onboarded`.
 * Redirects any authenticated app route to /onboarding when the user
 * hasn't completed onboarding yet — not just /dashboard.
 */
function OnboardingGate({
  children,
  hideChrome,
  configured,
  logOpen,
  setLogOpen,
}: {
  children: React.ReactNode;
  hideChrome: boolean;
  configured: boolean;
  logOpen: boolean;
  setLogOpen: (v: boolean) => void;
}) {
  const { settings, ready } = useStore();
  const pathname = usePathname();
  const router = useRouter();
  const isOnboarding = pathname === "/onboarding";

  useEffect(() => {
    if (!ready) return;
    if (!settings.onboarded && !isOnboarding) {
      router.replace("/onboarding");
    }
  }, [ready, settings.onboarded, isOnboarding, router]);

  // Show splash while store is loading or while redirect is pending.
  if (!ready || (!settings.onboarded && !isOnboarding)) return <Splash />;

  return (
    <div className="mx-auto max-w-md min-h-dvh flex flex-col">
      {!hideChrome && <LogDateSwitcher />}
      <main className={hideChrome ? "flex-1" : "flex-1 pb-28"}>{children}</main>
      {!hideChrome && <BottomNav onLog={() => setLogOpen(true)} />}
      <QuickLogSheet open={logOpen} onClose={() => setLogOpen(false)} />
      {!configured && (
        <div className="fixed top-0 inset-x-0 z-50 bg-ember-600 text-white text-[11px] text-center py-1 px-2">
          Supabase not configured — data won&apos;t be saved. See supabase/schema.sql and .env.example.
        </div>
      )}
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <Gate>{children}</Gate>
    </AuthProvider>
  );
}