import { useState } from "react";
import { Link } from "react-router-dom";
import { CreditCard, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useSubscription } from "@/hooks/useSubscription";
import { openBillingPortal } from "@/lib/subscriptionBilling";
import { trackPaywallEvent } from "@/lib/paywallAnalytics";
import { useAuth } from "@/lib/AuthContext";

export function subscriptionPlanLabel(plan) {
  if (plan === "premium_plus") return "Premium Plus";
  if (plan === "premium") return "Premium";
  return "Free";
}

function formattedDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toLocaleDateString();
}

export default function SubscriptionSettings() {
  const {
    subscription,
    isLoading,
    isError,
    error,
    refetch,
  } = useSubscription();
  const { user } = useAuth();
  const [openingPortal, setOpeningPortal] = useState(false);

  const manageBilling = async () => {
    if (openingPortal) return;
    setOpeningPortal(true);
    try {
      await openBillingPortal({ expectedUserId: user?.id });
      trackPaywallEvent("billing_portal_opened", {
        plan: subscription.plan,
        billing_period: subscription.billingPeriod || "unknown",
        source: "settings",
      });
    } catch (portalError) {
      toast.error(portalError?.message || "Could not open billing settings. Please try again.");
      setOpeningPortal(false);
    }
  };

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-border bg-card/50 p-6" aria-live="polite">
        <Loader2 className="h-5 w-5 animate-spin text-primary" aria-hidden="true" />
        <span className="sr-only">Loading subscription</span>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-2xl border border-destructive/50 bg-card/50 p-6" role="alert">
        <h3 className="font-heading text-lg font-semibold">Subscription unavailable</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          We could not verify your plan. Paid access remains locked until verification succeeds.
        </p>
        {error?.message && <p className="sr-only">{error.message}</p>}
        <Button className="mt-4" size="sm" variant="outline" onClick={() => refetch()}>
          Try again
        </Button>
      </div>
    );
  }

  const trialEnd = formattedDate(subscription.trialEndDate);
  const periodEnd = formattedDate(subscription.currentPeriodEnd);
  const canManageBilling = subscription.provider === "stripe";

  return (
    <div className="rounded-2xl border border-white/[0.06] bg-card/50 p-6 backdrop-blur-xl">
      <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-start">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-heading text-xl font-semibold">
              {subscriptionPlanLabel(subscription.plan)}
            </h3>
            <Badge variant="outline">{subscription.status}</Badge>
            {subscription.grandfathered && (
              <Badge className="bg-primary/20 text-primary hover:bg-primary/20">
                Grandfathered
              </Badge>
            )}
          </div>

          <dl className="mt-4 space-y-2 text-sm">
            {subscription.billingPeriod && (
              <div className="flex gap-2">
                <dt className="text-muted-foreground">Billing period:</dt>
                <dd className="capitalize">{subscription.billingPeriod === "annual" ? "Yearly" : subscription.billingPeriod}</dd>
              </div>
            )}
            {subscription.isTrialing && trialEnd && (
              <div className="flex gap-2">
                <dt className="text-muted-foreground">Trial ends:</dt>
                <dd>{trialEnd}</dd>
              </div>
            )}
            {periodEnd && (
              <div className="flex gap-2">
                <dt className="text-muted-foreground">
                  {subscription.cancelAtPeriodEnd ? "Access until:" : "Renews on:"}
                </dt>
                <dd>{periodEnd}</dd>
              </div>
            )}
            {subscription.cancelAtPeriodEnd && (
              <div className="flex gap-2">
                <dt className="text-muted-foreground">Renewal:</dt>
                <dd>Ends at the current period</dd>
              </div>
            )}
          </dl>

          {subscription.grandfathered && (
            <p className="mt-4 text-sm text-muted-foreground">
              Your existing subscription includes Premium Plus at its current external price.
            </p>
          )}
          <p className="mt-4 text-sm text-muted-foreground">Core chat is free forever.</p>
          <p className="text-sm text-muted-foreground">Cancel anytime in settings.</p>
        </div>

        {canManageBilling ? (
          <Button onClick={manageBilling} disabled={openingPortal} className="shrink-0 gap-2">
            {openingPortal ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <CreditCard className="h-4 w-4" aria-hidden="true" />
            )}
            {openingPortal ? "Opening..." : "Manage Billing"}
          </Button>
        ) : (
          <Button asChild className="shrink-0 gap-2">
            <Link to="/pricing">
              <CreditCard className="h-4 w-4" aria-hidden="true" />
              View plans
            </Link>
          </Button>
        )}
      </div>
    </div>
  );
}
