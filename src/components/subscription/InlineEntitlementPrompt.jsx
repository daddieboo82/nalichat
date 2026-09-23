import { useEffect } from "react";
import { Link } from "react-router-dom";
import { LockKeyhole } from "lucide-react";
import { Button } from "@/components/ui/button";
import { trackPaywallEvent } from "@/lib/paywallAnalytics";

export default function InlineEntitlementPrompt({
  entitlement,
  source,
  title,
  description,
}) {
  useEffect(() => {
    trackPaywallEvent("entitlement_prompt_view", { entitlement, source });
  }, [entitlement, source]);

  return (
    <div className="ui-surface rounded-2xl border border-primary/30 bg-primary/5 p-4 sm:p-5" role="note">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-3">
          <LockKeyhole className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
          <div>
            <h3 className="font-heading font-semibold text-foreground">{title}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          </div>
        </div>
        <Button
          asChild
          className="ui-hover min-h-11 w-full shrink-0 rounded-xl font-semibold sm:w-auto"
          onClick={() => { trackPaywallEvent("entitlement_prompt_convert", { entitlement, source }); trackPaywallEvent("upgrade_click", { entitlement, source }); }}
        >
          <Link to={`/pricing?source=${encodeURIComponent(source)}&feature=${encodeURIComponent(entitlement)}`}>Unlock with Premium</Link>
        </Button>
      </div>
    </div>
  );
}
