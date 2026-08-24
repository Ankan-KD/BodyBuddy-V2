// ════════════════════════════════════════════════════════════════════════
// BB Store — Phase 10 Personalization
// Bridges BB Health user data (goal, nutrition targets) with BB Store so
// the store can surface goal-relevant and nutrition-matched products.
// BB Health itself is never modified — this is a read-only bridge.
// ════════════════════════════════════════════════════════════════════════

"use client";

import { useMemo } from "react";
import { useStore } from "./store";
import { GoalMode } from "./types";

// Maps BB Health goalMode → BB Store health_goal_tags value
const GOAL_MODE_TO_STORE_TAG: Record<GoalMode, string> = {
  gain: "weight-gain",
  lose: "weight-loss",
  maintain: "general-fitness",
};

export interface PersonalizationContext {
  /** The BB Store goal tag derived from the user's BB Health goal */
  goalTag: string;
  /** Human-readable label for the goal, e.g. "Gain Weight" */
  goalLabel: string;
  /** Short motivational sub-label for store sections */
  goalBlurb: string;
  /** The user's daily protein target in grams */
  proteinGoalG: number;
  /** The user's daily calorie target */
  calorieGoal: number;
  /** True when the user is in a calorie-surplus goal (gain) */
  isCalorieSurplus: boolean;
  /** True when the user is in a calorie-deficit goal (lose) */
  isCalorieDeficit: boolean;
  /** Minimum protein per serving (g) to highlight as "high protein" for this user */
  highProteinThresholdG: number;
  /** Whether any BB Health data is actually available (user logged in & onboarded) */
  hasHealthData: boolean;
  /** User's display name from BB Health profile */
  userName: string;
}

const GOAL_LABELS: Record<GoalMode, string> = {
  gain: "Gain Weight",
  lose: "Lose Weight",
  maintain: "Maintain Weight",
};

const GOAL_BLURBS: Record<GoalMode, string> = {
  gain: "Calorie-dense picks to support your bulk.",
  lose: "High-satiety, lower-calorie options for your cut.",
  maintain: "Balanced nutrition to keep you on track.",
};

export function usePersonalization(): PersonalizationContext {
  const { settings, ready } = useStore();

  return useMemo(() => {
    const goalMode = settings.goalMode;
    const goalTag = GOAL_MODE_TO_STORE_TAG[goalMode];
    const hasHealthData = ready && settings.onboarded;

    // A simple threshold: 20g protein per serving is "high protein"
    // For muscle-building / weight-gain users we raise this slightly
    const highProteinThresholdG = goalMode === "gain" || goalMode === "maintain" ? 20 : 15;

    return {
      goalTag,
      goalLabel: GOAL_LABELS[goalMode],
      goalBlurb: GOAL_BLURBS[goalMode],
      proteinGoalG: settings.proteinGoal,
      calorieGoal: settings.calorieGoal,
      isCalorieSurplus: goalMode === "gain",
      isCalorieDeficit: goalMode === "lose",
      highProteinThresholdG,
      hasHealthData,
      userName: settings.name,
    };
  }, [settings, ready]);
}
