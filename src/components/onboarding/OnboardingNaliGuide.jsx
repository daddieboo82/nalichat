import { useEffect, useRef } from "react";
import { useSubscription } from "@/hooks/useSubscription";

/**
 * Auto-opens Nali on the onboarding page and walks the user through each step.
 * Sends contextual messages to Nali as the user advances so she guides them live.
 *
 * Props:
 *  - step: current onboarding step (1 = profile, 2 = tutorial)
 *  - profileComplete: true when the user has filled in required profile fields
 */
export default function OnboardingNaliGuide({ step, profileComplete }) {
  const { hasEntitlement, isLoading } = useSubscription();
  const canUseAi = hasEntitlement("ai.standard");
  const openedRef = useRef(false);
  const lastStepRef = useRef(0);

  // Open Nali once on mount with an onboarding-specific greeting
  useEffect(() => {
    if (isLoading || !canUseAi || openedRef.current) return;
    openedRef.current = true;
    const greeting =
      "I'm a brand-new user who just landed on the onboarding screen. " +
      "Welcome me warmly to NaliBase, then walk me through setting up my profile. " +
      "Explain what the Display Name, Birthdate, Location, and Bio fields are for and why they matter. " +
      "Keep it short, friendly, and encouraging — I'm new here!";
    window.dispatchEvent(
      new CustomEvent("open-ai-assistant", { detail: { greeting } })
    );
  }, [isLoading, canUseAi]);

  // Guide the user when they advance to the tutorial step
  useEffect(() => {
    if (step === lastStepRef.current) return;
    lastStepRef.current = step;

    if (canUseAi && step === 2 && profileComplete) {
      window.dispatchEvent(
        new CustomEvent("nali-send-message", {
          detail: {
            message:
              "I've completed my profile and I'm on the tutorial step. " +
              "Walk me through the three pillars of NaliStudio — Studio Creation, Collaboration, and Publishing — " +
              "and tell me what I should try first once I'm inside.",
          },
        })
      );
    }
  }, [step, profileComplete, canUseAi]);

  return null;
}