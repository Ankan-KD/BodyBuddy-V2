"use client";

// ════════════════════════════════════════════════════════════════════════
// BB Store — Checkout Page (Razorpay)
// Collects customer details + delivery address (auto-filled from the
// user's saved Store delivery profile when available), then the single
// "Pay & Place Order" action creates a server-verified order and opens
// Razorpay Checkout. No payment-method picker — Razorpay itself presents
// whichever methods are enabled on the account.
// ════════════════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  MapPin,
  User,
  Phone,
  Mail,
  Package,
  ChevronRight,
  AlertCircle,
  CheckCircle2,
  Loader2,
  ShieldCheck,
  BadgeCheck,
  Plus,
  Tag,
} from "lucide-react";
import { useCart, formatPriceINR } from "@/lib/cartContext";
import { isVariantPurchasable } from "@/lib/storeTypes";
import { useAuth } from "@/lib/auth";
import { createCheckoutOrder, verifyCheckoutPayment, markCheckoutOrderFailed } from "@/lib/orderApi";
import { listMyDeliveryProfiles, saveMyDeliveryProfile } from "@/lib/deliveryProfileApi";
import { DeliveryProfile } from "@/lib/deliveryProfileTypes";
import { cn } from "@/lib/utils";

// ── Razorpay Checkout.js typings (minimal, matches the tested module) ──────

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
    if (window.Razorpay) {
      resolve(true);
      return;
    }
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

// ── Step indicator ────────────────────────────────────────────────────────

const STEPS = ["Details", "Address", "Review"];

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
                "text-[10px] font-medium",
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

// ── Form field ────────────────────────────────────────────────────────────

function Field({
  label,
  icon: Icon,
  error,
  required,
  children,
}: {
  label: string;
  icon: React.ElementType;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold text-[var(--text-muted)] flex items-center gap-1.5">
        <Icon className="w-3.5 h-3.5" />
        {label}
        {required && <span className="text-amber-500">*</span>}
      </label>
      {children}
      {error && <p className="text-[11px] text-red-500">{error}</p>}
    </div>
  );
}

function Input({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
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

// ── Main component ────────────────────────────────────────────────────────

interface FormErrors {
  name?: string;
  email?: string;
  phone?: string;
  line1?: string;
  city?: string;
  state?: string;
  pincode?: string;
}

export default function CheckoutPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { items, totals, loading, refreshCart } = useCart();
  const [step, setStep] = useState(0);
  const [placing, setPlacing] = useState(false);
  const [orderError, setOrderError] = useState<string | null>(null);

  // ── Customer details ───────────────────────────────────────────────
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  // ── Delivery address ───────────────────────────────────────────────
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

  // ── Errors ─────────────────────────────────────────────────────────
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
    setLine1("");
    setLine2("");
    setCity("");
    setState("");
    setPincode("");
    setInstructions("");
  }

  // Pre-fill from user profile + saved Store delivery addresses
  useEffect(() => {
    if (!user) return;
    const meta = user.user_metadata;
    if (meta?.name && !name) setName(meta.name as string);
    if (user.email && !email) setEmail(user.email);

    listMyDeliveryProfiles(user.id).then((profiles) => {
      setSavedProfiles(profiles);
      const defaultProfile = profiles.find((p) => p.isDefault) ?? profiles[0] ?? null;
      if (defaultProfile) {
        setHasSavedProfile(true);
        applyProfile(defaultProfile);
      }
      setProfileLoaded(true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Only checkout available, purchasable items
  const availableItems = items.filter(
    (i) =>
      i.product.published &&
      i.product.availability === "active" &&
      isVariantPurchasable(i.variant)
  );
  const hasItems = availableItems.length > 0;
  const unavailableCount = items.length - availableItems.length;

  // ── Validation ─────────────────────────────────────────────────────

  function validateStep0(): boolean {
    const e: FormErrors = {};
    if (!name.trim()) e.name = "Full name is required";
    if (!email.trim()) e.email = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      e.email = "Enter a valid email address";
    if (!phone.trim()) e.phone = "Phone number is required";
    else if (!/^[0-9]{10}$/.test(phone.replace(/\s/g, "")))
      e.phone = "Enter a valid 10-digit phone number";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function validateStep1(): boolean {
    const e: FormErrors = {};
    if (!line1.trim()) e.line1 = "Address line 1 is required";
    if (!city.trim()) e.city = "City is required";
    if (!state.trim()) e.state = "State is required";
    if (!pincode.trim()) e.pincode = "Pincode is required";
    else if (!/^[0-9]{6}$/.test(pincode.trim()))
      e.pincode = "Enter a valid 6-digit pincode";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function handleNext() {
    if (step === 0 && validateStep0()) setStep(1);
    else if (step === 1 && validateStep1()) setStep(2);
  }

  // ── Pay & Place Order ──────────────────────────────────────────────

  const cleanupFailedOrder = useCallback(async (orderId: string, reason: string) => {
    await markCheckoutOrderFailed(orderId, reason);
    await refreshCart();
  }, [refreshCart]);

  async function handlePayAndPlaceOrder() {
    if (!user || !hasItems || placing) return;
    setPlacing(true);
    setOrderError(null);

    let createdOrderId: string | null = null;

    try {
      // 1. Create the order + Razorpay order (server-side trusted pricing)
      const created = await createCheckoutOrder({
        customerName: name.trim(),
        customerEmail: email.trim(),
        customerPhone: phone.trim(),
        deliveryAddress: {
          line1: line1.trim(),
          line2: line2.trim(),
          city: city.trim(),
          state: state.trim(),
          pincode: pincode.trim(),
          country: "India",
        },
      });
      createdOrderId = created.orderId;

      // Save/update the delivery profile in parallel (best-effort; never
      // blocks or fails checkout).
      if (saveProfile) {
        saveMyDeliveryProfile(user.id, profileId, {
          label: addressLabel.trim() || "Home",
          recipientName: name.trim(),
          phone: phone.trim(),
          line1: line1.trim(),
          line2: line2.trim(),
          city: city.trim(),
          state: state.trim(),
          pincode: pincode.trim(),
          country: "India",
          deliveryInstructions: instructions.trim(),
        }).catch(() => {});
      }

      // 2. Load Razorpay Checkout
      const ready = await loadRazorpayScript();
      if (!ready) throw new Error("Could not load the payment window. Check your internet connection.");

      if (!created.razorpayKeyId) throw new Error("Payment is not configured. Please contact support.");

      // 3. Open Razorpay Checkout — it presents whichever methods (UPI,
      //    cards, netbanking, wallets, ...) are enabled on the account.
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
            setPlacing(false);
            setOrderError("Checkout was closed before payment completed. Your order was not placed — please try again.");
            if (createdOrderId) await cleanupFailedOrder(createdOrderId, "Checkout dismissed by customer.");
          },
        },
        handler: async (payment) => {
          const result = await verifyCheckoutPayment({
            orderId: created.orderId,
            razorpay_order_id: payment.razorpay_order_id,
            razorpay_payment_id: payment.razorpay_payment_id,
            razorpay_signature: payment.razorpay_signature,
          });
          if (result.verified) {
            router.replace(`/store/orders/${created.orderId}?placed=1`);
          } else {
            setPlacing(false);
            setOrderError(result.error ?? "We couldn't confirm your payment. Please contact support before retrying.");
          }
        },
      });

      razorpay.on("payment.failed", async (failure) => {
        setPlacing(false);
        setOrderError(failure.error?.description || "Payment failed. Please try again.");
        if (createdOrderId) await cleanupFailedOrder(createdOrderId, failure.error?.description ?? "payment.failed");
      });

      razorpay.open();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Something went wrong. Please try again.";
      setOrderError(msg);
      setPlacing(false);
      if (createdOrderId) await cleanupFailedOrder(createdOrderId, msg);
    }
  }

  // ── Loading / empty guard ──────────────────────────────────────────

  if (loading || !profileLoaded) {
    return (
      <div className="px-4 pt-4">
        <h1 className="font-display text-xl font-semibold mb-4">Checkout</h1>
        <div className="space-y-3 animate-pulse">
          {[1, 2, 3].map((n) => (
            <div key={n} className="h-16 rounded-2xl bg-[var(--border)]" />
          ))}
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
          <h2 className="font-display text-lg font-semibold mb-1">
            Your cart is empty
          </h2>
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

  // ── Render ─────────────────────────────────────────────────────────

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
                onChange={(e) => {
                  setName(e.target.value);
                  if (errors.name) setErrors((p) => ({ ...p, name: undefined }));
                }}
              />
            </Field>

            <Field label="Email Address" icon={Mail} required error={errors.email}>
              <Input
                type="email"
                placeholder="rahul@example.com"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (errors.email) setErrors((p) => ({ ...p, email: undefined }));
                }}
              />
            </Field>

            <Field label="Phone Number" icon={Phone} required error={errors.phone}>
              <Input
                type="tel"
                placeholder="9876543210"
                maxLength={10}
                value={phone}
                onChange={(e) => {
                  setPhone(e.target.value.replace(/\D/g, ""));
                  if (errors.phone) setErrors((p) => ({ ...p, phone: undefined }));
                }}
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

          {/* Saved address picker — only shown when the user has more than
              one saved address; a single saved address is already applied
              automatically above. */}
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
                      profileId === p.id
                        ? "border-amber-500 bg-amber-500/10"
                        : "border-[var(--border)] glass-panel"
                    )}
                  >
                    <span className="flex items-center gap-1 text-[11px] font-bold text-amber-600 dark:text-amber-300">
                      <Tag className="w-3 h-3" /> {p.label}
                    </span>
                    <span className="block text-[11px] text-[var(--text-muted)] mt-0.5 line-clamp-1">
                      {p.recipientName}
                    </span>
                    <span className="block text-[11px] text-[var(--text-muted)] line-clamp-1">
                      {p.line1}, {p.city}
                    </span>
                  </button>
                ))}
                <button
                  type="button"
                  onClick={startNewAddress}
                  className={cn(
                    "shrink-0 flex flex-col items-center justify-center gap-1 text-[11px] font-semibold rounded-xl border px-4 py-2 min-w-[100px] transition-colors",
                    profileId === null
                      ? "border-amber-500 bg-amber-500/10 text-amber-600 dark:text-amber-300"
                      : "border-dashed border-[var(--border)] text-[var(--text-muted)]"
                  )}
                >
                  <Plus className="w-4 h-4" /> New address
                </button>
              </div>
            </div>
          )}

          <div className="glass-panel border border-[var(--border)] rounded-2xl p-4 space-y-4">
            <Field label="Address Label" icon={Tag}>
              <Input
                placeholder="Home, Work, ..."
                value={addressLabel}
                onChange={(e) => setAddressLabel(e.target.value)}
              />
            </Field>

            <Field label="Address Line 1" icon={MapPin} required error={errors.line1}>
              <Input
                placeholder="Flat / House no., Building, Street"
                value={line1}
                onChange={(e) => {
                  setLine1(e.target.value);
                  if (errors.line1) setErrors((p) => ({ ...p, line1: undefined }));
                }}
              />
            </Field>

            <Field label="Address Line 2 (Optional)" icon={MapPin}>
              <Input
                placeholder="Area, Colony, Landmark"
                value={line2}
                onChange={(e) => setLine2(e.target.value)}
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="City" icon={MapPin} required error={errors.city}>
                <Input
                  placeholder="Mumbai"
                  value={city}
                  onChange={(e) => {
                    setCity(e.target.value);
                    if (errors.city) setErrors((p) => ({ ...p, city: undefined }));
                  }}
                />
              </Field>

              <Field label="State" icon={MapPin} required error={errors.state}>
                <Input
                  placeholder="Maharashtra"
                  value={state}
                  onChange={(e) => {
                    setState(e.target.value);
                    if (errors.state) setErrors((p) => ({ ...p, state: undefined }));
                  }}
                />
              </Field>
            </div>

            <Field label="Pincode" icon={MapPin} required error={errors.pincode}>
              <Input
                placeholder="400001"
                maxLength={6}
                value={pincode}
                onChange={(e) => {
                  setPincode(e.target.value.replace(/\D/g, ""));
                  if (errors.pincode) setErrors((p) => ({ ...p, pincode: undefined }));
                }}
              />
            </Field>

            <Field label="Delivery Instructions (Optional)" icon={MapPin}>
              <Input
                placeholder="Leave at the door, call on arrival, etc."
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
              />
            </Field>

            <label className="flex items-center gap-2 text-xs text-[var(--text-muted)] pt-1">
              <input
                type="checkbox"
                checked={saveProfile}
                onChange={(e) => setSaveProfile(e.target.checked)}
                className="rounded border-[var(--border)]"
              />
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
          {/* Customer summary */}
          <div className="glass-panel border border-[var(--border)] rounded-2xl p-4">
            <div className="flex items-start justify-between mb-3">
              <h3 className="font-semibold text-sm flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-amber-500" /> Contact
              </h3>
              <button
                onClick={() => setStep(0)}
                className="text-[11px] text-amber-500 font-medium"
              >
                Edit
              </button>
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
              <button
                onClick={() => setStep(1)}
                className="text-[11px] text-amber-500 font-medium"
              >
                Edit
              </button>
            </div>
            <p className="text-sm leading-relaxed">
              {line1}
              {line2 ? `, ${line2}` : ""}
              <br />
              {city}, {state} – {pincode}
              <br />
              India
            </p>
          </div>

          {/* Order items summary */}
          <div className="glass-panel border border-[var(--border)] rounded-2xl p-4">
            <h3 className="font-semibold text-sm flex items-center gap-1.5 mb-3">
              <Package className="w-3.5 h-3.5 text-amber-500" /> Order Summary
              <span className="text-[var(--text-muted)] font-normal">
                ({availableItems.length} item{availableItems.length !== 1 ? "s" : ""})
              </span>
            </h3>

            <div className="space-y-3 mb-3">
              {availableItems.map((item) => {
                const primaryImage =
                  item.variant.images?.[0] ?? item.product.images?.[0] ?? null;
                const variantLabel = [item.variant.sizeLabel, item.variant.flavour]
                  .filter(Boolean)
                  .join(" · ");
                return (
                  <div key={item.id} className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-amber-500/10 to-nova-500/10 flex items-center justify-center overflow-hidden shrink-0">
                      {primaryImage ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={primaryImage}
                          alt={item.product.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Package className="w-4 h-4 text-amber-500/30" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium leading-tight line-clamp-1">
                        {item.product.name}
                      </p>
                      {variantLabel && (
                        <p className="text-[11px] text-[var(--text-muted)]">
                          {variantLabel}
                        </p>
                      )}
                      <p className="text-[11px] text-[var(--text-muted)]">
                        Qty: {item.quantity}
                      </p>
                    </div>
                    <span className="text-xs font-semibold shrink-0">
                      {formatPriceINR(item.variant.pricePaise * item.quantity)}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Totals */}
            <div className="border-t border-[var(--border)] pt-3 space-y-1.5 text-sm">
              <div className="flex justify-between text-[var(--text-muted)]">
                <span>Subtotal</span>
                <span>{formatPriceINR(totals.subtotalPaise + totals.savingsPaise)}</span>
              </div>
              {totals.savingsPaise > 0 && (
                <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
                  <span>Discount</span>
                  <span className="font-semibold">
                    −{formatPriceINR(totals.savingsPaise)}
                  </span>
                </div>
              )}
              <div className="flex justify-between text-[var(--text-muted)]">
                <span>Delivery</span>
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                  Free
                </span>
              </div>
              <div className="flex justify-between font-bold text-base pt-1 border-t border-[var(--border)]">
                <span>Total</span>
                <span className="text-amber-500">
                  {formatPriceINR(totals.totalPaise)}
                </span>
              </div>
            </div>
          </div>

          {/* Secure payment note (Razorpay presents the methods) */}
          <div className="flex items-start gap-2 p-3 rounded-xl bg-emerald-500/8 border border-emerald-500/20">
            <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
            <p className="text-xs text-emerald-700 dark:text-emerald-300">
              You&apos;ll pay securely via Razorpay — UPI, cards, netbanking and
              wallets are all supported at the payment step.
            </p>
          </div>

          {/* Unavailable items warning */}
          {unavailableCount > 0 && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
              <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-600 dark:text-amber-300">
                {unavailableCount} item{unavailableCount !== 1 ? "s" : ""} in your
                cart {unavailableCount === 1 ? "is" : "are"} currently unavailable
                and won&apos;t be included in this order.
              </p>
            </div>
          )}

          {/* Order error */}
          {orderError && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              <p className="text-xs text-red-600 dark:text-red-300">{orderError}</p>
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
              disabled={placing}
              className="flex-[2] flex items-center justify-center gap-2 font-semibold rounded-2xl py-3.5 bg-amber-500 text-white shadow-soft active:scale-95 transition-transform disabled:opacity-70"
            >
              {placing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Processing…
                </>
              ) : (
                <>
                  Pay &amp; Place Order <ChevronRight className="w-4 h-4" />
                </>
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
