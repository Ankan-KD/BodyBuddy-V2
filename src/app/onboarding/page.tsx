"use client";

import { BulkUp } from "@/components/BulkUp";
import { Button } from "@/components/ui/button";
import { EditableNumber } from "@/components/ui/editable-number";
import { useAuth } from "@/lib/auth";
import {
  GOAL_DESCRIPTIONS,
  GOAL_LABELS,
  calculateBMI,
  calorieGoalWarning,
  goalWeightWarning,
  onboardingCta,
  personalizedCalorieGoal,
  personalizedProteinGoal,
  recommendedGoalWeight,
} from "@/lib/goalCopy";
import { AppIcon } from "@/lib/icons";
import { getOnboardingSuggestions, type OnboardingSuggestion } from "@/lib/masterFoods";
import { useStore } from "@/lib/store";
import { GoalMode } from "@/lib/types";
import { cn } from "@/lib/utils";
import { AlertTriangle, Equal, Info, TrendingDown, TrendingUp } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const GOAL_ICONS: Record<GoalMode, typeof TrendingUp> = {
  gain: TrendingUp,
  lose: TrendingDown,
  maintain: Equal,
};

export default function OnboardingPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { updateSettings, addFood, addWeightEntry, foods, settings } = useStore();

  const [step, setStep] = useState(0);

  // Step 0 — Goal
  // Always start fresh — don't pre-fill from stored settings on onboarding.
  const [goal, setGoal] = useState<GoalMode>("gain");

  // Step 1 — Profile (gender, height, current weight, goal weight)
  // Always start at 0 ("not entered") — never pre-fill from stored settings.
  // The user is completing onboarding for the first time (or re-doing it),
  // so they should always type their own values rather than see stale defaults.
  const [gender, setGender] = useState<"male" | "female" | "other">("male");
  const [heightCm, setHeightCm] = useState<number>(0);
  const [currentWeight, setCurrentWeight] = useState<number>(0);
  // goalWeight: 0 means "not yet set / not entered"
  const [goalWeight, setGoalWeight] = useState<number>(0);
  const [goalWeightTouched, setGoalWeightTouched] = useState(false);

  // Step 2 — Daily targets (auto-calculated only when inputs are valid, user-editable)
  // 0 means "not yet computed / user hasn't provided enough info"
  const [calorieGoal, setCalorieGoal] = useState<number>(0);
  const [calorieGoalTouched, setCalorieGoalTouched] = useState(false);
  const [proteinGoal, setProteinGoal] = useState<number>(0);
  const [proteinGoalTouched, setProteinGoalTouched] = useState(false);

  // Step 3 — Food selection
  const [suggestions] = useState<OnboardingSuggestion[]>(() => getOnboardingSuggestions());
  const [name, setName] = useState(settings.name || (user?.user_metadata?.name as string) || "");
  const [chosen, setChosen] = useState<string[]>(
    () => getOnboardingSuggestions().filter((s) => s.defaultSelected).map((s) => s.displayName)
  );
  const [targets, setTargets] = useState<Record<string, number>>({});

  const [saving, setSaving] = useState(false);

  // Auto-compute recommended goal weight — only when height AND weight are actually entered.
  // Never silently fall back to currentWeight if the user hasn't touched goalWeight.
  useEffect(() => {
    if (!goalWeightTouched && heightCm > 0 && currentWeight > 0) {
      const recommended = recommendedGoalWeight(heightCm, currentWeight, goal);
      setGoalWeight(recommended);
    }
  }, [heightCm, currentWeight, goal, goalWeightTouched]);

  // Auto-compute calorie goal — only when all required inputs are present.
  useEffect(() => {
    if (!calorieGoalTouched && currentWeight > 0 && heightCm > 0) {
      // Only use goalWeight if it has been meaningfully set (>0); otherwise fall back to currentWeight.
      const effectiveGoalWeight = goalWeight > 0 ? goalWeight : currentWeight;
      const cal = personalizedCalorieGoal(currentWeight, effectiveGoalWeight, heightCm, gender, goal);
      setCalorieGoal(cal);
    } else if (!calorieGoalTouched && (currentWeight === 0 || heightCm === 0)) {
      // Reset to 0 (unset) if the user clears their inputs
      setCalorieGoal(0);
    }
  }, [currentWeight, goalWeight, heightCm, gender, goal, calorieGoalTouched]);

  // Auto-compute protein goal — only when weight is actually entered.
  useEffect(() => {
    if (!proteinGoalTouched && currentWeight > 0) {
      const effectiveGoalWeight = goalWeight > 0 ? goalWeight : currentWeight;
      const pro = personalizedProteinGoal(currentWeight, effectiveGoalWeight, goal);
      setProteinGoal(pro);
    } else if (!proteinGoalTouched && currentWeight === 0) {
      setProteinGoal(0);
    }
  }, [currentWeight, goalWeight, goal, proteinGoalTouched]);

  function toggleFood(n: string) {
    setChosen((c) => (c.includes(n) ? c.filter((x) => x !== n) : [...c, n]));
  }

  function finish() {
    // Guard: don't save zero macro targets — something went wrong with
    // auto-compute (e.g. user cleared values manually). Fall back to
    // sensible defaults derived from current weight so the dashboard isn't
    // seeded with 0 kcal / 0 g protein goals.
    const safeCalorieGoal = calorieGoal > 0 ? calorieGoal : Math.round((currentWeight * 30) / 50) * 50;
    const safeProteinGoal = proteinGoal > 0 ? proteinGoal : Math.round((currentWeight * 1.6) / 5) * 5;
    // goalWeight defaults to currentWeight if auto-compute never ran (edge case).
    const safeGoalWeight = goalWeight > 0 ? goalWeight : currentWeight;

    setSaving(true);
    try {
      updateSettings({
        name,
        goalMode: goal,
        calorieGoal: safeCalorieGoal,
        goalWeightKg: safeGoalWeight,
        startWeightKg: currentWeight,
        proteinGoal: safeProteinGoal,
        gender,
        heightCm,
        onboarded: true,
      });
      if (currentWeight > 0) addWeightEntry(currentWeight);
      if (foods.length === 0) {
        suggestions.filter((s) => chosen.includes(s.displayName)).forEach((s) => {
          addFood({
            name: s.displayName,
            emoji: s.emoji,
            category: s.category,
            customCategory: "",
            baseIngredient: s.baseIngredient,
            unit: s.unit,
            kind: s.kind,
            targetQuantity: targets[s.displayName] ?? s.targetQuantity,
            calories: s.calories,
            protein: s.protein,
            carbs: s.carbs,
            fats: s.fats,
            aliases: s.aliases,
            archived: false,
            activeDays: [0, 1, 2, 3, 4, 5, 6],
            dateOnly: null,
          });
        });
      }
      router.replace("/dashboard");
    } catch (err) {
      console.error("finish() failed", err);
      setSaving(false);
    }
  }

  const totalSteps = 5;
  const progress = ((step + 1) / totalSteps) * 100;
  const bmi =
    heightCm > 0 && currentWeight > 0 ? calculateBMI(currentWeight, heightCm) : null;
  const weightWarning =
    goalWeight > 0 ? goalWeightWarning(goal, currentWeight, goalWeight) : null;
  const calorieWarning =
    calorieGoal > 0 ? calorieGoalWarning(currentWeight, goal, calorieGoal) : null;

  return (
    <div className="min-h-dvh flex flex-col px-6 pt-10 pb-8">
      {/* Progress bar */}
      <div className="h-1 w-full rounded-full bg-nova-700/15 mb-8">
        <div
          className="h-full rounded-full bg-gradient-to-r from-nova-500 to-aurora-400 shadow-glow-nova transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* ── Step 0: Choose Goal ─────────────────────────────────────── */}
      {step === 0 && (
        <div className="flex-1 flex flex-col animate-grow-in">
          <BulkUp progress={0.15} className="w-16 h-16 mb-4" />
          <h1 className="font-display text-3xl font-semibold mb-1">What&apos;s your goal?</h1>
          <p className="text-[var(--text-muted)] text-sm mb-8">
            This shapes your targets and daily checklist — you can change it anytime in Settings.
          </p>

          <div className="space-y-2.5">
            {(["gain", "lose", "maintain"] as GoalMode[]).map((g) => {
              const Icon = GOAL_ICONS[g];
              return (
                <button
                  key={g}
                  onClick={() => setGoal(g)}
                  className={cn(
                    "w-full flex items-center gap-3 rounded-xl2 border px-4 py-3.5 text-left transition-all",
                    goal === g
                      ? "bg-nova-600 border-nova-500 text-white shadow-glow-nova"
                      : "border-[var(--border)] bg-[var(--bg-elevated)]"
                  )}
                >
                  <span
                    className={cn(
                      "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
                      goal === g ? "bg-white/15" : "bg-nova-700/12"
                    )}
                  >
                    <Icon className="w-5 h-5" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold">{GOAL_LABELS[g]}</span>
                    <span
                      className={cn(
                        "block text-xs",
                        goal === g ? "text-white/80" : "text-[var(--text-muted)]"
                      )}
                    >
                      {GOAL_DESCRIPTIONS[g]}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>

          <div className="mt-auto pt-8">
            <Button size="lg" className="w-full" onClick={() => setStep(1)}>
              Continue
            </Button>
          </div>
        </div>
      )}

      {/* ── Step 1: Let's Set Your Goals (profile) ──────────────────── */}
      {step === 1 && (
        <div className="flex-1 flex flex-col animate-grow-in">
          <h1 className="font-display text-3xl font-semibold mb-1">Let&apos;s set your goals</h1>
          <p className="text-[var(--text-muted)] text-sm mb-6">
            We&apos;ll use this to personalise your calorie and protein targets.
          </p>

          <div className="space-y-5">
            {/* Gender */}
            <div>
              <label className="block text-sm font-medium mb-2">Gender</label>
              <div className="grid grid-cols-3 gap-2">
                {(["male", "female", "other"] as const).map((g) => (
                  <button
                    key={g}
                    onClick={() => setGender(g)}
                    className={cn(
                      "rounded-xl border py-2.5 text-sm font-medium capitalize transition-all",
                      gender === g
                        ? "bg-nova-600 border-nova-500 text-white shadow-glow-nova"
                        : "border-[var(--border)] bg-[var(--bg-elevated)]"
                    )}
                  >
                    {g === "male" ? "Male" : g === "female" ? "Female" : "Other"}
                  </button>
                ))}
              </div>
            </div>

            {/* Height — shows placeholder dash when not yet entered */}
            <GoalStepper
              label="Height"
              value={heightCm}
              step={1}
              suffix="cm"
              min={100}
              max={250}
              onChange={setHeightCm}
              placeholder="Enter height"
            />

            {/* Current Weight — shows placeholder dash when not yet entered */}
            <GoalStepper
              label="Current weight"
              value={currentWeight}
              step={0.5}
              suffix="kg"
              min={30}
              max={300}
              onChange={setCurrentWeight}
              placeholder="Enter weight"
            />

            {/* BMI indicator — only shown when both inputs are present */}
            {bmi !== null && bmi > 0 && (
              <div className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] px-3.5 py-2.5 text-xs">
                <Info className="w-4 h-4 shrink-0 text-nova-500" />
                <span>
                  Your current BMI is <strong>{bmi}</strong>{" "}
                  {bmi < 18.5
                    ? "— Underweight Range"
                    : bmi <= 24.9
                    ? "— In Healthy Range"
                    : bmi <= 29.9
                    ? "— Overweight Range"
                    : "— Obese Range"}
                </span>
              </div>
            )}

            {/* Goal Weight — only shown / editable once height + current weight are entered */}
            {heightCm > 0 && currentWeight > 0 && (
              <div>
                <label className="block text-sm font-medium mb-1">Goal weight</label>
                <p className="text-xs text-[var(--text-muted)] mb-2">
                  Suggested from your height &amp; BMI — change it to anything you like.
                </p>
                <GoalStepper
                  label=""
                  value={goalWeight > 0 ? goalWeight : currentWeight}
                  step={1}
                  suffix="kg"
                  min={30}
                  max={300}
                  onChange={(v) => {
                    setGoalWeight(v);
                    setGoalWeightTouched(true);
                  }}
                  placeholder="Enter goal weight"
                />
              </div>
            )}

            {/* Goal weight hint when inputs are missing */}
            {(heightCm === 0 || currentWeight === 0) && (
              <p className="text-xs text-[var(--text-muted)]">
                Enter your height and current weight above to get a goal weight suggestion.
              </p>
            )}

            {weightWarning && (
              <div className="flex items-start gap-2 rounded-xl border border-ember-500/30 bg-ember-500/10 px-3.5 py-3 text-xs text-ember-600">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{weightWarning}</span>
              </div>
            )}
          </div>

          <div className="mt-auto pt-8 flex gap-3">
            <Button variant="outline" size="lg" className="flex-1" onClick={() => setStep(0)}>
              Back
            </Button>
            <Button
              size="lg"
              className="flex-1"
              onClick={() => setStep(2)}
              // Require at least height + weight before proceeding
              disabled={heightCm === 0 || currentWeight === 0}
            >
              Continue
            </Button>
          </div>
        </div>
      )}

      {/* ── Step 2: Daily Targets (personalized) ────────────────────── */}
      {step === 2 && (
        <div className="flex-1 flex flex-col animate-grow-in">
          <h1 className="font-display text-3xl font-semibold mb-1">Daily targets</h1>
          <p className="text-[var(--text-muted)] text-sm mb-2">
            Calculated from your profile — adjust anytime.
          </p>
          <div className="flex items-center gap-1.5 mb-6 text-xs text-[var(--text-muted)]">
            <Info className="w-3.5 h-3.5 shrink-0" />
            <span>These are estimates to get you started, not medical advice.</span>
          </div>

          <div className="space-y-6">
            {/* Calorie goal — show placeholder dash until computed */}
            <GoalStepper
              label="Daily calorie goal"
              value={calorieGoal}
              step={50}
              suffix="kcal"
              min={800}
              max={8000}
              onChange={(v) => {
                setCalorieGoal(v);
                setCalorieGoalTouched(true);
              }}
              placeholder="—"
            />
            {/* Protein goal — show placeholder dash until computed */}
            <GoalStepper
              label="Daily protein goal"
              value={proteinGoal}
              step={5}
              suffix="g"
              min={20}
              max={400}
              onChange={(v) => {
                setProteinGoal(v);
                setProteinGoalTouched(true);
              }}
              placeholder="—"
            />
            {calorieWarning && (
              <div className="flex items-start gap-2 rounded-xl border border-ember-500/30 bg-ember-500/10 px-3.5 py-3 text-xs text-ember-600">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{calorieWarning}</span>
              </div>
            )}
          </div>

          <div className="mt-auto pt-8 flex gap-3">
            <Button variant="outline" size="lg" className="flex-1" onClick={() => setStep(1)}>
              Back
            </Button>
            <Button
              size="lg"
              className="flex-1"
              onClick={() => setStep(3)}
              disabled={calorieGoal === 0 || proteinGoal === 0}
            >
              Continue
            </Button>
          </div>
        </div>
      )}

      {/* ── Step 3: Food selection ───────────────────────────────────── */}
      {step === 3 && (
        <div className="flex-1 flex flex-col animate-grow-in">
          <h1 className="font-display text-3xl font-semibold mb-1">
            What foods do you regularly eat?
          </h1>
          <p className="text-[var(--text-muted)] text-sm mb-1">
            Pick a few to start — you can add more anytime.
          </p>
          <p className="text-[var(--text-muted)] text-xs mb-6">
            Nutrition values are filled in automatically from our food database.
          </p>

          <div className="grid grid-cols-2 gap-2.5 overflow-y-auto no-scrollbar pb-2">
            {suggestions.map((s) => (
              <button
                key={s.displayName}
                onClick={() => toggleFood(s.displayName)}
                className={cn(
                  "flex items-center gap-2 rounded-xl2 border px-3.5 py-3 text-left transition-all",
                  chosen.includes(s.displayName)
                    ? "bg-nova-600 border-nova-500 text-white shadow-glow-nova"
                    : "border-[var(--border)] bg-[var(--bg-elevated)]"
                )}
              >
                <span className="text-xl">
                  <AppIcon name={s.emoji} className="w-5 h-5" />
                </span>
                <span className="text-sm font-medium">{s.displayName}</span>
              </button>
            ))}
          </div>

          <div className="mt-auto pt-8 flex gap-3">
            <Button variant="outline" size="lg" className="flex-1" onClick={() => setStep(2)}>
              Back
            </Button>
            <Button
              size="lg"
              className="flex-1"
              onClick={() => setStep(4)}
              disabled={chosen.length === 0}
            >
              Continue
            </Button>
          </div>
        </div>
      )}

      {/* ── Step 4: Set Daily Targets (quantities) + final review ─────── */}
      {step === 4 && (
        <div className="flex-1 flex flex-col animate-grow-in">
          <h1 className="font-display text-3xl font-semibold mb-1">Set your daily targets</h1>
          <p className="text-[var(--text-muted)] text-sm mb-1">How much of each food, per day?</p>

          {/* Macro recap — only show when values are actually present */}
          {(calorieGoal > 0 || proteinGoal > 0) && (
            <div className="flex gap-3 mb-5 mt-2">
              {calorieGoal > 0 && (
                <div className="flex-1 rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2 text-center">
                  <p className="text-xs text-[var(--text-muted)]">Daily calories</p>
                  <p className="text-base font-display font-semibold">
                    {calorieGoal}{" "}
                    <span className="text-xs font-normal text-[var(--text-muted)]">kcal</span>
                  </p>
                </div>
              )}
              {proteinGoal > 0 && (
                <div className="flex-1 rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2 text-center">
                  <p className="text-xs text-[var(--text-muted)]">Daily protein</p>
                  <p className="text-base font-display font-semibold">
                    {proteinGoal}{" "}
                    <span className="text-xs font-normal text-[var(--text-muted)]">g</span>
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Name field */}
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">What should we call you?</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] px-4 py-3 outline-none focus:border-nova-500"
            />
          </div>

          <div className="space-y-3 overflow-y-auto no-scrollbar">
            {suggestions
              .filter((s) => chosen.includes(s.displayName))
              .map((s) => (
                <div
                  key={s.displayName}
                  className="flex items-center gap-3 rounded-xl2 border border-[var(--border)] bg-[var(--bg-elevated)] px-4 py-3"
                >
                  <span className="text-xl">
                    <AppIcon name={s.emoji} className="w-5 h-5" />
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="text-sm font-medium block">{s.displayName}</span>
                    <span className="text-xs text-[var(--text-muted)]">
                      {s.unit === "g" || s.unit === "ml"
                        ? `${Math.round(
                            s.calories * (targets[s.displayName] ?? s.targetQuantity)
                          )} kcal`
                        : s.unit === "count"
                        ? `${Math.round(
                            s.calories * (targets[s.displayName] ?? s.targetQuantity)
                          )} kcal`
                        : `${s.calories} kcal / serving`}
                    </span>
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() =>
                        setTargets((t) => ({
                          ...t,
                          [s.displayName]: Math.max(
                            0,
                            (t[s.displayName] ?? s.targetQuantity) -
                              (s.unit === "g" || s.unit === "ml" ? 50 : 1)
                          ),
                        }))
                      }
                      className="h-7 w-7 rounded-full bg-nova-700/12 flex items-center justify-center"
                    >
                      −
                    </button>
                    <span className="w-16 flex items-center justify-center gap-0.5 text-sm tabular-nums font-semibold">
                      <EditableNumber
                        value={targets[s.displayName] ?? s.targetQuantity}
                        onChange={(v) =>
                          setTargets((t) => ({ ...t, [s.displayName]: Math.max(0, v) }))
                        }
                        ariaLabel={`${s.displayName} target quantity`}
                        className="w-10 bg-transparent"
                      />
                      {s.unit === "count" ? "" : s.unit === "serving" ? " srv" : s.unit}
                    </span>
                    <button
                      onClick={() =>
                        setTargets((t) => ({
                          ...t,
                          [s.displayName]:
                            (t[s.displayName] ?? s.targetQuantity) +
                            (s.unit === "g" || s.unit === "ml" ? 50 : 1),
                        }))
                      }
                      className="h-7 w-7 rounded-full bg-nova-700/12 flex items-center justify-center"
                    >
                      +
                    </button>
                  </div>
                </div>
              ))}
          </div>

          <div className="mt-auto pt-8 flex gap-3">
            <Button variant="outline" size="lg" className="flex-1" onClick={() => setStep(3)}>
              Back
            </Button>
            <Button size="lg" className="flex-1" onClick={finish} disabled={saving}>
              {saving ? "Starting…" : onboardingCta(goal)}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * GoalStepper
 *
 * The center value area is always tappable — even when the field is empty
 * (value === 0). Tapping it opens an inline text input so the user can type
 * directly without having to hit + first.
 *
 * Empty state: shows the placeholder text and a muted suffix.
 * Filled state: shows the numeric value and the suffix.
 * Editing state: shows a focused number input.
 *
 * The + button seeds the value from `min` on the first press (when empty),
 * and increments by `step` on every subsequent press.
 */
function GoalStepper({
  label,
  value,
  step,
  suffix,
  min = 0,
  max = 9999,
  onChange,
  placeholder = "–",
}: {
  label: string;
  value: number;
  step: number;
  suffix: string;
  min?: number;
  max?: number;
  onChange: (v: number) => void;
  placeholder?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const isEmpty = value === 0;
  const decimals = step < 1 ? 1 : 0;

  // Sync draft when value changes externally (e.g. + / − buttons) while not editing.
  useEffect(() => {
    if (!editing) {
      setDraft(value > 0 ? String(value) : "");
    }
  }, [value, editing]);

  // Auto-focus and select when editing starts.
  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  function startEditing() {
    setDraft(value > 0 ? String(value) : "");
    setEditing(true);
  }

  function commit() {
    setEditing(false);
    const parsed = parseFloat(draft);
    if (!Number.isFinite(parsed) || draft.trim() === "") {
      // Empty or invalid — leave the value unchanged (don't snap to 0).
      return;
    }
    const rounded = Math.round(parsed * 10 ** decimals) / 10 ** decimals;
    onChange(Math.min(max, Math.max(min, rounded)));
  }

  function handleIncrement() {
    const base = isEmpty ? min : value;
    onChange(Math.min(max, Math.round((base + step) * 10) / 10));
  }

  function handleDecrement() {
    if (isEmpty) return;
    onChange(Math.max(min, Math.round((value - step) * 10) / 10));
  }

  return (
    <div>
      {label && <label className="block text-sm font-medium mb-2">{label}</label>}
      <div className="flex items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2">
        {/* Decrement */}
        <button
          type="button"
          onClick={handleDecrement}
          disabled={isEmpty}
          className="h-9 w-9 rounded-full bg-nova-700/12 flex items-center justify-center active:scale-90 transition-transform disabled:opacity-30"
        >
          −
        </button>

        {/* Center — always tappable to start typing */}
        <span className="text-lg font-display font-semibold tabular-nums flex items-baseline gap-1 flex-1 justify-center">
          {editing ? (
            <input
              ref={inputRef}
              type="number"
              inputMode="decimal"
              value={draft}
              min={min}
              max={max}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commit}
              onKeyDown={(e) => {
                if (e.key === "Enter") { e.preventDefault(); commit(); }
                if (e.key === "Escape") { e.preventDefault(); setEditing(false); }
              }}
              onFocus={(e) => e.currentTarget.select()}
              aria-label={label || suffix}
              className="no-spinner w-20 bg-transparent text-center outline-none border-b-2 border-nova-500 tabular-nums text-lg font-display font-semibold"
            />
          ) : (
            <button
              type="button"
              onClick={startEditing}
              aria-label={label ? `${label}, tap to enter a value` : "Tap to enter a value"}
              className="flex items-baseline gap-1 cursor-text focus:outline-none"
            >
              {isEmpty ? (
                <span className="text-[var(--text-muted)] font-normal text-base">{placeholder}</span>
              ) : (
                <span>{value}</span>
              )}
              {!isEmpty && (
                <span className="text-sm font-body font-normal text-[var(--text-muted)]">{suffix}</span>
              )}
            </button>
          )}
          {/* Show suffix alongside the input while editing so user knows the unit */}
          {editing && (
            <span className="text-sm font-body font-normal text-[var(--text-muted)]">{suffix}</span>
          )}
        </span>

        {/* Increment */}
        <button
          type="button"
          onClick={handleIncrement}
          className="h-9 w-9 rounded-full bg-nova-700/12 flex items-center justify-center active:scale-90 transition-transform"
        >
          +
        </button>
      </div>
    </div>
  );
}