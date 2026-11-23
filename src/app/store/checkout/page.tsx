"use client";

// ════════════════════════════════════════════════════════════════════════
// BB Store — Checkout Page (Razorpay)
// Step 0 — Customer details
// Step 1 — Delivery address
// Step 2 — Review, coupon + Pay
//
// Key behaviours:
//  • Coupon code entry on the Review step — validated live against the
//    server (validate-coupon), then re-verified in create-order.
//  • 5-minute payment countdown starts when Razorpay opens. If it
//    hits zero the order is cancelled and the user must re-add items.
//  • Payment failure / dismiss → order cancelled, stock restored,
//    clear error sent the user back to the cart to retry.
// ════════════════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  MapPin, User, Phone, Mail, Package, ChevronRight,
  AlertCircle, CheckCircle2, Loader2, ShieldCheck, BadgeCheck,
  Plus, Tag, X, Timer, RefreshCw,
} from "lucide-react";
import { useCart, formatPriceINR } from "@/lib/cartContext";
import { isVariantPurchasable } from "@/lib/storeTypes";
import { useAuth } from "@/lib/auth";
import {
  createCheckoutOrder,
  verifyCheckoutPayment,
  markCheckoutOrderFailed,
  validateCoupon,
  type CouponValidationResult,
} from "@/lib/orderApi";
import { listMyDeliveryProfiles, saveMyDeliveryProfile } from "@/lib/deliveryProfileApi";
import { DeliveryProfile } from "@/lib/deliveryProfileTypes";
import { ActiveOffersBanner } from "@/components/store/ActiveOffersBanner";
import { cn } from "@/lib/utils";

// ── Razorpay Checkout.js typings ──────────────────────────────────────────

declare global {
  interface Window {
    Razorpay: new (options: RazorpayOptions) => {
      open: () => void;
      on: (event: "payment.failed", callback: (response: RazorpayFailure) => void) => void;
    };
  }
}

interface RazorpayOptions {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  order_id: string;
  handler: (response: RazorpaySuccess) => void;
  modal: { ondismiss: () => void };
  theme: { color: string };
  prefill: { name: string; email: string; contact: string };
}

interface RazorpaySuccess {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

interface RazorpayFailure {
  error: { description?: string; code?: string };
}

function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (window.Razorpay) { resolve(true); return; }
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

// ── Step indicator ────────────────────────────────────────────────────────

const STEPS = ["Details", "Address", "Review & Pay"];

function Stepper({ step }: { step: number }) {
  return (
    <div className="flex items-center mb-6">
      {STEPS.map((label, i) => (
        <div key={label} className="flex items-center flex-1 last:flex-none">
          <div className="flex flex-col items-center gap-1">
            <div
              className={cn(
                "w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors",
                i < step
                  ? "bg-emerald-500 text-white"
                  : i === step
                  ? "bg-amber-500 text-white"
                  : "bg-nova-700/10 dark:bg-nova-100/10 text-[var(--text-muted)]"
              )}
            >
              {i < step ? <CheckCircle2 className="w-4 h-4" /> : i + 1}
            </div>
            <span
              className={cn(
                "text-[10px] font-medium whitespace-nowrap",
                i === step ? "text-amber-500" : "text-[var(--text-muted)]"
              )}
            >
              {label}
            </span>
          </div>
          {i < STEPS.length - 1 && (
            <div
              className={cn(
                "flex-1 h-px mx-2 mb-4 transition-colors",
                i < step ? "bg-emerald-500/40" : "bg-[var(--border)]"
              )}
            />
          )}
        </div>
      ))}
    </div>
  );
}

// ── Form helpers ──────────────────────────────────────────────────────────

function Field({
  label, icon: Icon, error, required, children,
}: {
  label: string; icon: React.ElementType; error?: string; required?: boolean; children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold text-[var(--text-muted)] flex items-center gap-1.5">
        <Icon className="w-3.5 h-3.5" />{label}
        {required && <span className="text-amber-500">*</span>}
      </label>
      {children}
      {error && <p className="text-[11px] text-red-500">{error}</p>}
    </div>
  );
}

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

// ── Coupon input widget ───────────────────────────────────────────────────

interface CouponBoxProps {
  cartTotal: number;
  productIds: string[];
  applied: CouponValidationResult | null;
  onApply: (result: CouponValidationResult, code: string) => void;
  onRemove: () => void;
}

function CouponBox({ cartTotal, productIds, applied, onApply, onRemove }: CouponBoxProps) {
  const [input, setInput] = useState(applied?.code ?? "");
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleApply() {
    const code = input.trim().toUpperCase();
    if (!code) { setError("Enter a coupon code."); return; }
    setChecking(true);
    setError(null);
    const result = await validateCoupon({ code, orderTotalPaise: cartTotal, productIds });
    setChecking(false);
    if (result.valid) {
      onApply(result, code);
    } else {
      setError(result.error ?? "Invalid coupon.");
    }
  }

  if (applied?.valid) {
    return (
      <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-500/8 border border-emerald-500/25">
        <Tag className="w-4 h-4 text-emerald-500 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold text-emerald-700 dark:text-emerald-300">
            Coupon applied: <span className="font-mono">{applied.code}</span>
          </p>
          <p className="text-[11px] text-emerald-600 dark:text-emerald-400">
            You save {formatPriceINR(applied.discountPaise ?? 0)}
          </p>
        </div>
        <button
          onClick={() => { onRemove(); setInput(""); setError(null); }}
          className="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-red-500/10 text-[var(--text-muted)] hover:text-red-500 transition-colors"
          title="Remove coupon"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <div className="flex gap-2">
        <input
          className={cn(
            "flex-1 px-3.5 py-2.5 rounded-xl text-sm bg-[var(--bg-card)] border font-mono uppercase tracking-wide",
            "focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500 transition-colors",
            "placeholder:text-[var(--text-muted)] placeholder:normal-case placeholder:tracking-normal",
            error ? "border-red-500/60" : "border-[var(--border)]"
          )}
          placeholder="Enter coupon code"
          value={input}
          onChange={(e) => { setInput(e.target.value.toUpperCase()); setError(null); }}
          onKeyDown={(e) => { if (e.key === "Enter") handleApply(); }}
          disabled={checking}
          maxLength={30}
        />
        <button
          onClick={handleApply}
          disabled={checking || !input.trim()}
          className="shrink-0 px-4 rounded-xl bg-amber-500 text-white text-sm font-semibold disabled:opacity-50 active:scale-95 transition-transform"
        >
          {checking ? <Loader2 className="w-4 h-4 animate-spin" /> : "Apply"}
        </button>
      </div>
      {error && <p className="text-[11px] text-red-500">{error}</p>}
    </div>
  );
}

// ── Payment countdown timer ───────────────────────────────────────────────

function PaymentTimer({ seconds, onExpired }: { seconds: number; onExpired: () => void }) {
  const [remaining, setRemaining] = useState(seconds);
  const fired = useRef(false);

  useEffect(() => {
    if (remaining <= 0) {
      if (!fired.current) { fired.current = true; onExpired(); }
      return;
    }
    const t = setTimeout(() => setRemaining((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [remaining, onExpired]);

  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;
  const critical = remaining <= 60;

  return (
    <div
      className={cn(
        "flex items-center gap-2 p-3 rounded-xl border text-xs font-semibold",
        critical
          ? "bg-red-500/10 border-red-500/25 text-red-600 dark:text-red-400"
          : "bg-amber-500/8 border-amber-500/20 text-amber-700 dark:text-amber-300"
      )}
    >
      <Timer className={cn("w-4 h-4 shrink-0", critical && "animate-pulse")} />
      <span>
        Complete payment within{" "}
        <span className="font-mono font-bold">
          {mins}:{secs.toString().padStart(2, "0")}
        </span>
        {critical ? " — time is almost up!" : " to confirm your order."}
      </span>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────

interface FormErrors {
  name?: string; email?: string; phone?: string;
  line1?: string; city?: string; state?: string; pincode?: string;
}

const PAYMENT_TIMEOUT_SECONDS = 5 * 60; // 5 minutes

export default function CheckoutPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { items, totals, loading, refreshCart } = useCart();
  const [step, setStep] = useState(0);
  const [placing, setPlacing] = useState(false);
  const [orderError, setOrderError] = useState<string | null>(null);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [timerExpired, setTimerExpired] = useState(false);
  const pendingOrderId = useRef<string | null>(null);

  // ── Customer details ──────────────────────────────────────────────
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  // ── Delivery address ──────────────────────────────────────────────
  const [line1, setLine1] = useState("");
  const [line2, setLine2] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [pincode, setPincode] = useState("");
  const [instructions, setInstructions] = useState("");

  // ── Saved delivery addresses ──────────────────────────────────────
  const [savedProfiles, setSavedProfiles] = useState<DeliveryProfile[]>([]);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [hasSavedProfile, setHasSavedProfile] = useState(false);
  const [saveProfile, setSaveProfile] = useState(true);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [addressLabel, setAddressLabel] = useState("Home");

  // ── Coupon ────────────────────────────────────────────────────────
  const [coupon, setCoupon] = useState<CouponValidationResult | null>(null);
  const [couponCode, setCouponCode] = useState<string | null>(null);

  // ── Errors ────────────────────────────────────────────────────────
  const [errors, setErrors] = useState<FormErrors>({});

  function applyProfile(profile: DeliveryProfile) {
    setProfileId(profile.id);
    setAddressLabel(profile.label);
    setName((prev) => prev || profile.recipientName);
    setPhone(profile.phone);
    setLine1(profile.line1);
    setLine2(profile.line2);
    setCity(profile.city);
    setState(profile.state);
    setPincode(profile.pincode);
    setInstructions(profile.deliveryInstructions);
  }

  function startNewAddress() {
    setProfileId(null);
    setAddressLabel("Home");
    setLine1(""); setLine2(""); setCity(""); setState(""); setPincode(""); setInstructions("");
  }

  useEffect(() => {
    if (!user) return;
    const meta = user.user_metadata;
    if (meta?.name && !name) setName(meta.name as string);
    if (user.email && !email) setEmail(user.email);

    listMyDeliveryProfiles(user.id).then((profiles) => {
      setSavedProfiles(profiles);
      const defaultProfile = profiles.find((p) => p.isDefault) ?? profiles[0] ?? null;
      if (defaultProfile) { setHasSavedProfile(true); applyProfile(defaultProfile); }
      setProfileLoaded(true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const availableItems = items.filter(
    (i) => i.product.published && i.product.availability === "active" && isVariantPurchasable(i.variant)
  );
  const hasItems = availableItems.length > 0;
  const unavailableCount = items.length - availableItems.length;
  const cartProductIds = [...new Set(availableItems.map((i) => i.productId))];

  // Totals with coupon
  const couponDiscount = coupon?.valid ? (coupon.discountPaise ?? 0) : 0;
  const finalTotal = Math.max(0, totals.totalPaise - couponDiscount);

  // ── Validation ────────────────────────────────────────────────────

  function validateStep0(): boolean {
    const e: FormErrors = {};
    if (!name.trim()) e.name = "Full name is required";
    if (!email.trim()) e.email = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = "Enter a valid email address";
    if (!phone.trim()) e.phone = "Phone number is required";
    else if (!/^[0-9]{10}$/.test(phone.replace(/\s/g, ""))) e.phone = "Enter a valid 10-digit phone number";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function validateStep1(): boolean {
    const e: FormErrors = {};
    if (!line1.trim()) e.line1 = "Address line 1 is required";
    if (!city.trim()) e.city = "City is required";
    if (!state.trim()) e.state = "State is required";
    if (!pincode.trim()) e.pincode = "Pincode is required";
    else if (!/^[0-9]{6}$/.test(pincode.trim())) e.pincode = "Enter a valid 6-digit pincode";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function handleNext() {
    if (step === 0 && validateStep0()) setStep(1);
    else if (step === 1 && validateStep1()) setStep(2);
  }

  // ── Handle timer expiry (5 min window) ───────────────────────────

  const handleTimerExpired = useCallback(async () => {
    setPaymentOpen(false);
    setTimerExpired(true);
    setPlacing(false);
    setOrderError(
      "Your 5-minute payment window has expired and the order has been cancelled. " +
      "Your cart is intact — please go back to the cart and place your order again."
    );
    if (pendingOrderId.current) {
      await markCheckoutOrderFailed(pendingOrderId.current, "Payment window expired (5 min).");
      pendingOrderId.current = null;
    }
    await refreshCart();
  }, [refreshCart]);

  // ── Pay & Place Order ─────────────────────────────────────────────

  const cleanupFailedOrder = useCallback(async (orderId: string, reason: string) => {
    await markCheckoutOrderFailed(orderId, reason);
    await refreshCart();
  }, [refreshCart]);

  async function handlePayAndPlaceOrder() {
    if (!user || !hasItems || placing) return;
    setPlacing(true);
    setOrderError(null);
    setTimerExpired(false);

    let createdOrderId: string | null = null;

    try {
      const created = await createCheckoutOrder({
        customerName: name.trim(),
        customerEmail: email.trim(),
        customerPhone: phone.trim(),
        deliveryAddress: {
          line1: line1.trim(), line2: line2.trim(), city: city.trim(),
          state: state.trim(), pincode: pincode.trim(), country: "India",
        },
        couponCode: couponCode ?? null,
      });
      createdOrderId = created.orderId;
      pendingOrderId.current = createdOrderId;

      // If the server rejects the coupon (e.g. race condition exhausted it),
      // it throws — that surfaces as the catch below.

      // Save/update delivery profile (best-effort)
      if (saveProfile) {
        saveMyDeliveryProfile(user.id, profileId, {
          label: addressLabel.trim() || "Home",
          recipientName: name.trim(), phone: phone.trim(),
          line1: line1.trim(), line2: line2.trim(), city: city.trim(),
          state: state.trim(), pincode: pincode.trim(), country: "India",
          deliveryInstructions: instructions.trim(),
        }).catch(() => {});
      }

      const ready = await loadRazorpayScript();
      if (!ready) throw new Error("Could not load the payment window. Check your internet connection.");
      if (!created.razorpayKeyId) throw new Error("Payment is not configured. Please contact support.");

      setPaymentOpen(true); // ← start the 5-min countdown

      const razorpay = new window.Razorpay({
        key: created.razorpayKeyId,
        amount: created.amountPaise,
        currency: "INR",
        order_id: created.razorpayOrderId,
        name: "BB Store",
        description: `Order ${created.orderNumber}`,
        prefill: { name: name.trim(), email: email.trim(), contact: phone.trim() },
        theme: { color: "#f5601f" },
        modal: {
          ondismiss: async () => {
            setPaymentOpen(false);
            setPlacing(false);
            setOrderError(
              "Payment was not completed. Your order has been cancelled and no charge was made. " +
              "Please go back to your cart to place a fresh order."
            );
            if (createdOrderId) {
              await cleanupFailedOrder(createdOrderId, "Checkout dismissed by customer.");
              pendingOrderId.current = null;
            }
          },
        },
        handler: async (payment) => {
          setPaymentOpen(false);
          const result = await verifyCheckoutPayment({
            orderId: created.orderId,
            razorpay_order_id: payment.razorpay_order_id,
            razorpay_payment_id: payment.razorpay_payment_id,
            razorpay_signature: payment.razorpay_signature,
          });
          if (result.verified) {
            pendingOrderId.current = null;
            router.replace(`/store/orders/${created.orderId}?placed=1`);
          } else {
            setPlacing(false);
            setOrderError(result.error ?? "We couldn't confirm your payment. Please contact support before retrying.");
          }
        },
      });

      razorpay.on("payment.failed", async (failure) => {
        setPaymentOpen(false);
        setPlacing(false);
        setOrderError(
          (failure.error?.description || "Payment failed.") +
          " No charge was made. Please go back to your cart and try again."
        );
        if (createdOrderId) {
          await cleanupFailedOrder(createdOrderId, failure.error?.description ?? "payment.failed");
          pendingOrderId.current = null;
        }
      });

      razorpay.open();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Something went wrong. Please try again.";
      setOrderError(msg);
      setPlacing(false);
      setPaymentOpen(false);
      if (createdOrderId) {
        await cleanupFailedOrder(createdOrderId, msg);
        pendingOrderId.current = null;
      }
    }
  }

  // ── Loading / empty guard ─────────────────────────────────────────

  if (loading || !profileLoaded) {
    return (
      <div className="px-4 pt-4">
        <h1 className="font-display text-xl font-semibold mb-4">Checkout</h1>
        <div className="space-y-3 animate-pulse">
          {[1, 2, 3].map((n) => <div key={n} className="h-16 rounded-2xl bg-[var(--border)]" />)}
        </div>
      </div>
    );
  }

  if (!hasItems) {
    return (
      <div className="px-4 pt-4">
        <h1 className="font-display text-xl font-semibold mb-6">Checkout</h1>
        <div className="flex flex-col items-center justify-center text-center py-16">
          <div className="w-20 h-20 rounded-full bg-amber-500/10 flex items-center justify-center mb-4">
            <Package className="w-9 h-9 text-amber-500/60" />
          </div>
          <h2 className="font-display text-lg font-semibold mb-1">Your cart is empty</h2>
          <p className="text-sm text-[var(--text-muted)] mb-6 max-w-[220px]">
            Add some products to your cart before checking out.
          </p>
          <Link
            href="/store"
            className="inline-flex items-center gap-1.5 text-sm font-semibold px-5 py-2.5 rounded-xl bg-amber-500 text-white shadow-soft active:scale-95 transition-transform"
          >
            Browse Store
          </Link>
        </div>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────

  return (
    <div className="px-4 pt-4 pb-8">
      <h1 className="font-display text-xl font-semibold mb-4">Checkout</h1>

      <Stepper step={step} />

      {/* ── Step 0: Customer Details ── */}
      {step === 0 && (
        <section className="space-y-4">
          <h2 className="font-display text-base font-semibold flex items-center gap-2">
            <User className="w-4 h-4 text-amber-500" /> Your Details
          </h2>

          <div className="glass-panel border border-[var(--border)] rounded-2xl p-4 space-y-4">
            <Field label="Full Name" icon={User} required error={errors.name}>
              <Input
                placeholder="Rahul Sharma"
                value={name}
                onChange={(e) => { setName(e.target.value); if (errors.name) setErrors((p) => ({ ...p, name: undefined })); }}
              />
            </Field>
            <Field label="Email Address" icon={Mail} required error={errors.email}>
              <Input
                type="email"
                placeholder="rahul@example.com"
                value={email}
                onChange={(e) => { setEmail(e.target.value); if (errors.email) setErrors((p) => ({ ...p, email: undefined })); }}
              />
            </Field>
            <Field label="Phone Number" icon={Phone} required error={errors.phone}>
              <Input
                type="tel"
                placeholder="9876543210"
                maxLength={10}
                value={phone}
                onChange={(e) => { setPhone(e.target.value.replace(/\D/g, "")); if (errors.phone) setErrors((p) => ({ ...p, phone: undefined })); }}
              />
            </Field>
          </div>

          <button
            onClick={handleNext}
            className="w-full flex items-center justify-center gap-2 font-semibold rounded-2xl py-4 bg-amber-500 text-white shadow-soft active:scale-95 transition-transform"
          >
            Continue to Address <ChevronRight className="w-4 h-4" />
          </button>
        </section>
      )}

      {/* ── Step 1: Delivery Address ── */}
      {step === 1 && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-base font-semibold flex items-center gap-2">
              <MapPin className="w-4 h-4 text-amber-500" /> Delivery Address
            </h2>
            {hasSavedProfile && (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                <BadgeCheck className="w-3.5 h-3.5" /> Using saved address
              </span>
            )}
          </div>

          {savedProfiles.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-[var(--text-muted)]">
                Choose a saved address, or enter a new one below
              </p>
              <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
                {savedProfiles.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => applyProfile(p)}
                    className={cn(
                      "shrink-0 text-left rounded-xl border px-3 py-2 min-w-[140px] transition-colors",
                      profileId === p.id ? "border-amber-500 bg-amber-500/10" : "border-[var(--border)] glass-panel"
                    )}
                  >
                    <span className="flex items-center gap-1 text-[11px] font-bold text-amber-600 dark:text-amber-300">
                      <Tag className="w-3 h-3" /> {p.label}
                    </span>
                    <span className="block text-[11px] text-[var(--text-muted)] mt-0.5 line-clamp-1">{p.recipientName}</span>
                    <span className="block text-[11px] text-[var(--text-muted)] line-clamp-1">{p.line1}, {p.city}</span>
                  </button>
                ))}
                <button
                  type="button"
                  onClick={startNewAddress}
                  className={cn(
                    "shrink-0 flex flex-col items-center justify-center gap-1 text-[11px] font-semibold rounded-xl border px-4 py-2 min-w-[100px] transition-colors",
                    profileId === null ? "border-amber-500 bg-amber-500/10 text-amber-600 dark:text-amber-300" : "border-dashed border-[var(--border)] text-[var(--text-muted)]"
                  )}
                >
                  <Plus className="w-4 h-4" /> New address
                </button>
              </div>
            </div>
          )}

          <div className="glass-panel border border-[var(--border)] rounded-2xl p-4 space-y-4">
            <Field label="Address Label" icon={Tag}>
              <Input placeholder="Home, Work, ..." value={addressLabel} onChange={(e) => setAddressLabel(e.target.value)} />
            </Field>
            <Field label="Address Line 1" icon={MapPin} required error={errors.line1}>
              <Input
                placeholder="Flat / House no., Building, Street"
                value={line1}
                onChange={(e) => { setLine1(e.target.value); if (errors.line1) setErrors((p) => ({ ...p, line1: undefined })); }}
              />
            </Field>
            <Field label="Address Line 2 (Optional)" icon={MapPin}>
              <Input placeholder="Area, Colony, Landmark" value={line2} onChange={(e) => setLine2(e.target.value)} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="City" icon={MapPin} required error={errors.city}>
                <Input
                  placeholder="Mumbai"
                  value={city}
                  onChange={(e) => { setCity(e.target.value); if (errors.city) setErrors((p) => ({ ...p, city: undefined })); }}
                />
              </Field>
              <Field label="State" icon={MapPin} required error={errors.state}>
                <Input
                  placeholder="Maharashtra"
                  value={state}
                  onChange={(e) => { setState(e.target.value); if (errors.state) setErrors((p) => ({ ...p, state: undefined })); }}
                />
              </Field>
            </div>
            <Field label="Pincode" icon={MapPin} required error={errors.pincode}>
              <Input
                placeholder="400001"
                maxLength={6}
                value={pincode}
                onChange={(e) => { setPincode(e.target.value.replace(/\D/g, "")); if (errors.pincode) setErrors((p) => ({ ...p, pincode: undefined })); }}
              />
            </Field>
            <Field label="Delivery Instructions (Optional)" icon={MapPin}>
              <Input placeholder="Leave at the door, call on arrival, etc." value={instructions} onChange={(e) => setInstructions(e.target.value)} />
            </Field>
            <label className="flex items-center gap-2 text-xs text-[var(--text-muted)] pt-1">
              <input type="checkbox" checked={saveProfile} onChange={(e) => setSaveProfile(e.target.checked)} className="rounded border-[var(--border)]" />
              Save this address for next time
            </label>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setStep(0)}
              className="flex-1 font-semibold rounded-2xl py-3.5 border border-[var(--border)] glass-panel text-sm active:scale-95 transition-transform"
            >
              ← Back
            </button>
            <button
              onClick={handleNext}
              className="flex-[2] flex items-center justify-center gap-2 font-semibold rounded-2xl py-3.5 bg-amber-500 text-white shadow-soft active:scale-95 transition-transform"
            >
              Continue to Review <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </section>
      )}

      {/* ── Step 2: Review & Pay ── */}
      {step === 2 && (
        <section className="space-y-4">
          {/* Contact summary */}
          <div className="glass-panel border border-[var(--border)] rounded-2xl p-4">
            <div className="flex items-start justify-between mb-3">
              <h3 className="font-semibold text-sm flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-amber-500" /> Contact
              </h3>
              <button onClick={() => setStep(0)} className="text-[11px] text-amber-500 font-medium">Edit</button>
            </div>
            <p className="text-sm">{name}</p>
            <p className="text-xs text-[var(--text-muted)]">{email}</p>
            <p className="text-xs text-[var(--text-muted)]">+91 {phone}</p>
          </div>

          {/* Address summary */}
          <div className="glass-panel border border-[var(--border)] rounded-2xl p-4">
            <div className="flex items-start justify-between mb-3">
              <h3 className="font-semibold text-sm flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-amber-500" /> Delivery Address
              </h3>
              <button onClick={() => setStep(1)} className="text-[11px] text-amber-500 font-medium">Edit</button>
            </div>
            <p className="text-sm leading-relaxed">
              {line1}{line2 ? `, ${line2}` : ""}<br />
              {city}, {state} – {pincode}<br />India
            </p>
          </div>

          {/* Available offers — collapsed by default */}
          <ActiveOffersBanner productIds={cartProductIds} />

          {/* Order items */}
          <div className="glass-panel border border-[var(--border)] rounded-2xl p-4">
            <h3 className="font-semibold text-sm flex items-center gap-1.5 mb-3">
              <Package className="w-3.5 h-3.5 text-amber-500" /> Order Summary
              <span className="text-[var(--text-muted)] font-normal">
                ({availableItems.length} item{availableItems.length !== 1 ? "s" : ""})
              </span>
            </h3>

            <div className="space-y-3 mb-4">
              {availableItems.map((item) => {
                const primaryImage = item.variant.images?.[0] ?? item.product.images?.[0] ?? null;
                const variantLabel = [item.variant.sizeLabel, item.variant.flavour].filter(Boolean).join(" · ");
                return (
                  <div key={item.id} className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-amber-500/10 to-nova-500/10 flex items-center justify-center overflow-hidden shrink-0">
                      {primaryImage ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={primaryImage} alt={item.product.name} className="w-full h-full object-cover" />
                      ) : (
                        <Package className="w-4 h-4 text-amber-500/30" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium leading-tight line-clamp-1">{item.product.name}</p>
                      {variantLabel && <p className="text-[11px] text-[var(--text-muted)]">{variantLabel}</p>}
                      <p className="text-[11px] text-[var(--text-muted)]">Qty: {item.quantity}</p>
                    </div>
                    <span className="text-xs font-semibold shrink-0">
                      {formatPriceINR(item.variant.pricePaise * item.quantity)}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Coupon input */}
            <div className="border-t border-[var(--border)] pt-3 mb-3">
              <p className="text-xs font-semibold text-[var(--text-muted)] mb-2 flex items-center gap-1.5">
                <Tag className="w-3 h-3" /> Have a coupon code?
              </p>
              <CouponBox
                cartTotal={totals.totalPaise}
                productIds={cartProductIds}
                applied={coupon}
                onApply={(result, code) => { setCoupon(result); setCouponCode(code); }}
                onRemove={() => { setCoupon(null); setCouponCode(null); }}
              />
            </div>

            {/* Totals */}
            <div className="border-t border-[var(--border)] pt-3 space-y-1.5 text-sm">
              <div className="flex justify-between text-[var(--text-muted)]">
                <span>Subtotal</span>
                <span>{formatPriceINR(totals.subtotalPaise + totals.savingsPaise)}</span>
              </div>
              {totals.savingsPaise > 0 && (
                <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
                  <span>Product discount</span>
                  <span className="font-semibold">−{formatPriceINR(totals.savingsPaise)}</span>
                </div>
              )}
              {couponDiscount > 0 && (
                <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
                  <span className="flex items-center gap-1">
                    <Tag className="w-3 h-3" /> Coupon ({couponCode})
                  </span>
                  <span className="font-semibold">−{formatPriceINR(couponDiscount)}</span>
                </div>
              )}
              <div className="flex justify-between text-[var(--text-muted)]">
                <span>Delivery</span>
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">Free</span>
              </div>
              <div className="flex justify-between font-bold text-base pt-1 border-t border-[var(--border)]">
                <span>Total</span>
                <span className="text-amber-500">{formatPriceINR(finalTotal)}</span>
              </div>
            </div>
          </div>

          {/* 5-min countdown — only shown after Razorpay opens */}
          {paymentOpen && !timerExpired && (
            <PaymentTimer
              seconds={PAYMENT_TIMEOUT_SECONDS}
              onExpired={handleTimerExpired}
            />
          )}

          {/* Secure payment note */}
          {!paymentOpen && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-emerald-500/8 border border-emerald-500/20">
              <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
              <p className="text-xs text-emerald-700 dark:text-emerald-300">
                You&apos;ll pay securely via Razorpay — UPI, cards, netbanking and
                wallets are all supported at the payment step.
              </p>
            </div>
          )}

          {unavailableCount > 0 && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
              <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-600 dark:text-amber-300">
                {unavailableCount} item{unavailableCount !== 1 ? "s" : ""} in your cart{" "}
                {unavailableCount === 1 ? "is" : "are"} currently unavailable and won&apos;t be included.
              </p>
            </div>
          )}

          {/* Error — with cart link when payment failed / timed out */}
          {orderError && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-red-600 dark:text-red-300">{orderError}</p>
                <Link
                  href="/store/cart"
                  className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-amber-600 dark:text-amber-300 underline underline-offset-2"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Back to cart
                </Link>
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={() => setStep(1)}
              disabled={placing}
              className="flex-1 font-semibold rounded-2xl py-3.5 border border-[var(--border)] glass-panel text-sm active:scale-95 transition-transform disabled:opacity-50"
            >
              ← Back
            </button>
            <button
              onClick={handlePayAndPlaceOrder}
              disabled={placing || timerExpired}
              className="flex-[2] flex items-center justify-center gap-2 font-semibold rounded-2xl py-3.5 bg-amber-500 text-white shadow-soft active:scale-95 transition-transform disabled:opacity-70"
            >
              {placing ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Processing…</>
              ) : timerExpired ? (
                "Session expired"
              ) : (
                <>Pay &amp; Place Order <ChevronRight className="w-4 h-4" /></>
              )}
            </button>
          </div>

          <p className="text-center text-[11px] text-[var(--text-muted)]">
            By placing your order you agree to our terms &amp; conditions.
          </p>
        </section>
      )}
    </div>
  );
}
