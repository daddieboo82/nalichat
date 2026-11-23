import { useSubscription } from "@/hooks/useSubscription";

/** Optional, user-initiated AI guidance that never covers the setup form on load. */
export default function OnboardingNaliGuide() {
  const { hasEntitlement, isLoading } = useSubscription();
  if (isLoading || !hasEntitlement("ai.standard")) return null;

  const openHelp = () => {
    const greeting =
      "I'm setting up my NaliBase profile. Briefly explain that only my display name is required, " +
      "the other fields are optional, and I can finish them later. Keep the instructions concise.";
    window.dispatchEvent(new CustomEvent("open-ai-assistant", { detail: { greeting } }));
  };

  return (
    <button
      type="button"
      onClick={openHelp}
      className="mt-2 inline-flex min-h-11 items-center rounded-xl px-3 text-sm font-semibold text-primary underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-primary"
    >
      Need help? Ask Nali
    </button>
  );
}
