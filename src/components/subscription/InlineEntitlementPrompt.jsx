import { useEffect } from "react";
import { Link } from "react-router-dom";
import { LockKeyhole } from "lucide-react";
import { Button } from "@/components/ui/button";
import { trackPaywallEvent } from "@/lib/paywallAnalytics";
import { useSubscription } from "@/hooks/useSubscription";

export default function InlineEntitlementPrompt({
  entitlement,
  source,
  title,
  description,
}) {
  const { isLoading, isError, refetch } = useSubscription();
  useEffect(() => {
    if (!isLoading && !isError) trackPaywallEvent("entitlement_prompt_view", { entitlement, source });
  }, [entitlement, source, isLoading, isError]);

  return (
    <div className="ui-surface rounded-2xl border border-primary/30 bg-primary/5 p-4 sm:p-5" role="note">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-3">
          <LockKeyhole className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
          <div>
            <h3 className="font-heading font-semibold text-foreground">{title}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{isError ? "Subscription verification is unavailable. Review your billing or retry verification before starting another checkout." : description}</p>
          </div>
        </div>
        {isError ? (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => refetch()}>Try verification again</Button>
            <Button variant="outline" asChild><Link to="/settings">Review billing</Link></Button>
          </div>
        ) : isLoading ? (
          <span className="text-sm text-muted-foreground">Checking subscription...</span>
        ) : (
          <Button
            asChild
            className="ui-hover min-h-11 w-full shrink-0 rounded-xl font-semibold sm:w-auto"
            onClick={() => { trackPaywallEvent("entitlement_prompt_convert", { entitlement, source }); trackPaywallEvent("upgrade_click", { entitlement, source }); }}
          >
            <Link to={`/pricing?source=${encodeURIComponent(source)}&feature=${encodeURIComponent(entitlement)}`}>Unlock with Premium</Link>
          </Button>
        )
      </div>
    </div>
  );
}
