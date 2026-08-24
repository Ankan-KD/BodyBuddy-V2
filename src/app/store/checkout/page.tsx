"use client";

// ════════════════════════════════════════════════════════════════════════
// BB Store — Phase 7: Checkout Page
// Collects customer details, delivery address, and payment method,
// then places the order by calling orderApi.placeOrder().
// ════════════════════════════════════════════════════════════════════════

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  MapPin,
  User,
  Phone,
  Mail,
  CreditCard,
  Package,
  ChevronRight,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Truck,
} from "lucide-react";
import { useCart, formatPriceINR } from "@/lib/cartContext";
import { isVariantPurchasable } from "@/lib/storeTypes";
import { useAuth } from "@/lib/auth";
import { placeOrder } from "@/lib/orderApi";
import { CreateOrderPayload, PaymentMethod } from "@/lib/orderTypes";
import { cn } from "@/lib/utils";

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

// ── Payment option ────────────────────────────────────────────────────────

const PAYMENT_OPTIONS: { method: PaymentMethod; label: string; sub: string; icon: React.ElementType }[] = [
  {
    method: "cod",
    label: "Cash on Delivery",
    sub: "Pay when your order arrives",
    icon: Truck,
  },
  {
    method: "upi",
    label: "UPI",
    sub: "GPay, PhonePe, Paytm etc.",
    icon: CreditCard,
  },
];

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
  const { items, totals, loading, clearCart } = useCart();
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

  // ── Payment ────────────────────────────────────────────────────────
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cod");

  // ── Errors ─────────────────────────────────────────────────────────
  const [errors, setErrors] = useState<FormErrors>({});

  // Pre-fill from user profile if available
  useEffect(() => {
    if (user) {
      const meta = user.user_metadata;
      if (meta?.name && !name) setName(meta.name as string);
      if (user.email && !email) setEmail(user.email);
    }
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

  // ── Place order ────────────────────────────────────────────────────

  async function handlePlaceOrder() {
    if (!user || !hasItems) return;
    setPlacing(true);
    setOrderError(null);

    const payload: CreateOrderPayload = {
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
      paymentMethod,
    };

    try {
      const order = await placeOrder(user.id, availableItems, payload);
      // Cart is cleared inside placeOrder
      router.replace(`/store/orders/${order.id}?placed=1`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Something went wrong. Please try again.";
      setOrderError(msg);
      setPlacing(false);
    }
  }

  // ── Loading / empty guard ──────────────────────────────────────────

  if (loading) {
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
          <h2 className="font-display text-base font-semibold flex items-center gap-2">
            <MapPin className="w-4 h-4 text-amber-500" /> Delivery Address
          </h2>

          <div className="glass-panel border border-[var(--border)] rounded-2xl p-4 space-y-4">
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

      {/* ── Step 2: Review & Place Order ── */}
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

          {/* Payment method */}
          <div className="glass-panel border border-[var(--border)] rounded-2xl p-4">
            <h3 className="font-semibold text-sm flex items-center gap-1.5 mb-3">
              <CreditCard className="w-3.5 h-3.5 text-amber-500" /> Payment Method
            </h3>
            <div className="space-y-2">
              {PAYMENT_OPTIONS.map((opt) => {
                const Icon = opt.icon;
                const selected = paymentMethod === opt.method;
                return (
                  <button
                    key={opt.method}
                    onClick={() => setPaymentMethod(opt.method)}
                    className={cn(
                      "w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-colors",
                      selected
                        ? "border-amber-500 bg-amber-500/8"
                        : "border-[var(--border)] bg-[var(--bg-card)]"
                    )}
                  >
                    <div
                      className={cn(
                        "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                        selected ? "bg-amber-500/20" : "bg-[var(--border)]"
                      )}
                    >
                      <Icon
                        className={cn(
                          "w-4 h-4",
                          selected ? "text-amber-500" : "text-[var(--text-muted)]"
                        )}
                      />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium">{opt.label}</p>
                      <p className="text-[11px] text-[var(--text-muted)]">
                        {opt.sub}
                      </p>
                    </div>
                    <div
                      className={cn(
                        "w-4 h-4 rounded-full border-2 shrink-0 transition-colors",
                        selected
                          ? "border-amber-500 bg-amber-500"
                          : "border-[var(--border)]"
                      )}
                    />
                  </button>
                );
              })}
            </div>
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
              onClick={handlePlaceOrder}
              disabled={placing}
              className="flex-[2] flex items-center justify-center gap-2 font-semibold rounded-2xl py-3.5 bg-amber-500 text-white shadow-soft active:scale-95 transition-transform disabled:opacity-70"
            >
              {placing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Placing Order…
                </>
              ) : (
                <>
                  Place Order <ChevronRight className="w-4 h-4" />
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
