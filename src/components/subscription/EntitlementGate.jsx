import { useEffect } from "react";
import { Link } from "react-router-dom";
import { LockKeyhole } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSubscription } from "@/hooks/useSubscription";
import { trackPaywallEvent } from "@/lib/paywallAnalytics";

export function useEntitlement(entitlement) {
  const subscription = useSubscription();
  return {
    ...subscription,
    isEntitled: subscription.hasEntitlement(entitlement),
  };
}

export function EntitlementGate({
  entitlement,
  children,
  title = "Premium feature",
  description = "Unlock this creator tool with Premium while keeping your core NaliBase experience on Free.",
  source = "entitlement_gate",
}) {
  const { isEntitled, isLoading, isError, refetch } = useEntitlement(entitlement);

  useEffect(() => {
    if (!isLoading && !isEntitled) {
      trackPaywallEvent("entitlement_prompt_view", { entitlement, source });
    }
  }, [entitlement, isEntitled, isLoading, source]);

  if (isLoading) {
    return (
      <div className="ui-surface rounded-3xl border border-border bg-card p-6 text-center sm:p-8" aria-live="polite">
        <p className="text-sm text-muted-foreground">Checking access...</p>
      </div>
    );
  }

  if (isEntitled) return children;

  return (
    <div className="ui-surface rounded-3xl border border-primary/30 bg-card p-6 text-center sm:p-8">
      <LockKeyhole className="mx-auto mb-4 h-10 w-10 text-primary" aria-hidden="true" />
      <h2 className="font-heading text-2xl font-bold">{title}</h2>
      <p className="mx-auto mt-2 max-w-lg text-sm text-muted-foreground">
        {isError ? "We could not verify your subscription. Paid access stays locked until verification succeeds." : description}
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        {isError && (
          <Button className="ui-hover min-h-11 rounded-xl" variant="outline" onClick={() => refetch()}>
            Try again
          </Button>
        )}
        <Button className="ui-hover min-h-11 rounded-xl font-semibold" asChild onClick={() => trackPaywallEvent("entitlement_prompt_convert", { entitlement, source })}>
          <Link to={`/pricing?source=${encodeURIComponent(source)}&feature=${encodeURIComponent(entitlement)}`}>Unlock with Premium</Link>
        </Button>
      </div>
    </div>
  );
}

