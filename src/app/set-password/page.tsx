"use client";

// Mandatory "create a password" gate — shown to any new user who doesn't
// have a password set yet. This covers two cases:
//
//   1. Google sign-up: email verified by Google → lands here directly.
//   2. Manual sign-up: email verified via OTP on /login → lands here next.
//
// In both cases the user has a live Supabase session (signUp creates one
// even with a temp password). We just call updateUser() with their chosen
// real password. No OTP needed here — the OTP step already happened.

import { AppIcon } from "@/components/AppIcon";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { validatePassword, markPasswordSet } from "@/lib/passwordUtils";
import { CheckCircle2, Eye, EyeOff, Loader2, Lock, LogOut, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

type Screen = "form" | "done";

export default function SetPasswordPage() {
  const { user, session, signOut, markPasswordSetLocally } = useAuth();
  const router = useRouter();

  const [screen, setScreen] = useState<Screen>("form");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pwV = validatePassword(newPw);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!pwV.allPassed) { setError("Password doesn't meet the requirements below."); return; }
    if (newPw !== confirmPw) { setError("Passwords don't match."); return; }
    if (!supabase) { setError("Not configured."); return; }
    if (!session?.access_token) { setError("Your session expired — please sign in again."); return; }

    setLoading(true);
    // Google-verified email — no OTP needed. Set the password directly.
    const { error: updateErr } = await supabase.auth.updateUser({ password: newPw });
    if (updateErr) {
      setLoading(false);
      setError(updateErr.message);
      return;
    }

    // Record that this is a real, user-chosen password — see markPasswordSet's
    // doc comment for why this can't be inferred from Supabase's own
    // encrypted_password column for manual-signup accounts.
    const { error: markErr } = await markPasswordSet(session.access_token);
    setLoading(false);
    if (markErr) {
      // Password WAS updated in Supabase Auth successfully — only our own
      // bookkeeping failed. Not fatal: if this happens the Gate will still
      // see password_set=false and send them back here, but resubmitting
      // (harmless — updateUser with the same password) will retry this
      // call. Logged so it's visible if it ever actually happens.
      console.error("[set-password] markPasswordSet failed:", markErr);
    }

    setScreen("done");
    // Give the "done" screen a beat to render before moving on. We flip our
    // local copy of hasPassword right here — together with the navigation,
    // not the moment the API call above resolves — because the Gate reacts
    // to hasPassword changing by immediately redirecting away from
    // /set-password on its own. Flipping it earlier would cut the "You're
    // all set!" confirmation short (Gate would swap it for a splash before
    // the beat is up). Flipping it here, right before we navigate, still
    // fixes the real bug: by the time /dashboard mounts, the Gate already
    // knows a real password exists and won't bounce the user back here on
    // stale state (see the note above AuthProvider's account-state effect
    // in src/lib/auth.tsx for the full story).
    setTimeout(() => {
      if (!markErr) markPasswordSetLocally();
      router.replace("/dashboard");
    }, 900);
  }

  return (
    <div className="min-h-dvh flex flex-col justify-center px-6 py-10">
      <div className="mx-auto w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <AppIcon className="h-16 w-16 rounded-2xl shadow-glow-nova mb-4" />
          <span className="flex items-center gap-1.5 text-xs font-medium text-nova-400 mb-2">
            <ShieldCheck className="w-3.5 h-3.5" /> One last step
          </span>
          <h1 className="font-display text-2xl font-semibold text-center">Create a password</h1>
          <p className="text-sm text-[var(--text-muted)] mt-1 text-center">
            Create a password for <strong>{user?.email ?? "your account"}</strong> so you
            can log in directly any time.
          </p>
        </div>

        {screen === "form" && (
          <form onSubmit={handleSubmit} className="space-y-3">
            <PwField label="New password" value={newPw} onChange={setNewPw} show={showPw} onToggle={() => setShowPw((v) => !v)} />
            <PwField label="Confirm password" value={confirmPw} onChange={setConfirmPw} show={showPw} onToggle={() => setShowPw((v) => !v)} />
            {newPw && <PwChecklist pw={newPw} confirm={confirmPw} />}
            {error && <p className="text-xs text-ember-400">{error}</p>}
            <Button type="submit" size="lg" className="w-full" disabled={loading || !pwV.allPassed || newPw !== confirmPw}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Set password & continue"}
            </Button>
          </form>
        )}

        {screen === "done" && (
          <div className="text-center">
            <div className="flex justify-center mb-4">
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-aurora-500/15">
                <CheckCircle2 className="w-7 h-7 text-aurora-400" />
              </span>
            </div>
            <h2 className="font-display text-xl font-semibold mb-2">You&apos;re all set!</h2>
            <p className="text-sm text-[var(--text-muted)]">
              You can now log in with {user?.email} and your password any time.
            </p>
          </div>
        )}

        {screen !== "done" && (
          <button
            type="button"
            onClick={signOut}
            className="mx-auto mt-8 flex items-center gap-1.5 text-xs text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" /> Not you? Sign out
          </button>
        )}
      </div>
    </div>
  );
}

function PwField({
  label, value, onChange, show, onToggle,
}: { label: string; value: string; onChange: (v: string) => void; show: boolean; onToggle: () => void }) {
  return (
    <div className="space-y-1">
      <label className="text-xs text-[var(--text-muted)]">{label}</label>
      <div className="relative">
        <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
        <input
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] pl-10 pr-10 py-3 text-sm outline-none focus:border-nova-500 focus:shadow-glow placeholder:text-[var(--text-muted)]"
          placeholder={label}
          autoComplete="new-password"
          required
        />
        <button type="button" onClick={onToggle} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text)] transition-colors">
          {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}

function PwChecklist({ pw, confirm }: { pw: string; confirm: string }) {
  const v = validatePassword(pw);
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 py-2.5 space-y-1">
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