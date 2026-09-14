import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/AuthContext";
import { useSubscription } from "@/hooks/useSubscription";
import {
  annualSavings,
  BILLING_PERIODS,
  PAID_PLAN_IDS,
  SUBSCRIPTION_CATALOG,
  subscriptionSku,
} from "@/lib/subscriptionCatalog";
import {
  assignPaywallVariant,
  getPaywallCopy,
  PAYWALL_CONFIG,
} from "@/lib/paywallConfig";
import { trackPaywallEvent } from "@/lib/paywallAnalytics";
import { captureMarketingAttribution, getMarketingAttribution } from "@/lib/adAttribution";
import {
  CHECKOUT_RETURN_KEY,
  createCheckoutRequestKey,
  startSubscriptionCheckout,
} from "@/lib/subscriptionBilling";

function PlanCard({
  plan,
  period,
  badge,
  cta,
  isCurrent,
  isPaidSubscriber,
  isStarting,
  onSelect,
  onContinueFree,
}) {
  const price = plan.prices[period];
  const paid = plan.id !== "free";

  return (
    <article
      className={`ui-surface relative flex h-full flex-col rounded-3xl border p-5 sm:p-6 ${
        badge ? "border-primary bg-primary/5 shadow-lg shadow-primary/10" : "border-border bg-card"
      }`}
      aria-labelledby={`${plan.id}-plan-title`}
    >
      {badge && (
        <span className="mb-4 w-fit rounded-full bg-primary px-3 py-1 text-xs font-bold text-primary-foreground">
          {badge}
        </span>
      )}
      <h2 id={`${plan.id}-plan-title`} className="font-heading text-2xl font-bold">
        {plan.name}
      </h2>
      <p className="mt-2 min-h-10 text-sm text-muted-foreground">{plan.description}</p>
      <div className="mt-6">
        <span className="font-heading text-4xl font-black">{price.label}</span>
        <span className="ml-2 text-sm text-muted-foreground">{price.suffix}</span>
      </div>
      {paid && period === "annual" && (
        <p className="mt-2 text-sm font-semibold text-primary">
          Save ${annualSavings(plan.id)} per year
        </p>
      )}
      <ul className="my-6 flex-1 space-y-3">
        {plan.features.map((feature) => (
          <li key={feature} className="flex items-start gap-3 text-sm">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
            <span>{feature}</span>
          </li>
        ))}
      </ul>

      {paid ? (
        <Button
          className="ui-hover min-h-12 w-full rounded-xl font-semibold shadow-lg shadow-primary/10"
          disabled={isStarting || isCurrent || isPaidSubscriber}
          onClick={() => onSelect(plan.id)}
        >
          {isStarting && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
          {isCurrent ? "Current plan" : isPaidSubscriber ? "Manage in Settings" : cta}
        </Button>
      ) : (
        <Button className="ui-hover min-h-12 w-full rounded-xl font-semibold" variant="outline" onClick={onContinueFree}>
          Continue with Free
        </Button>
      )}
    </article>
  );
}

export default function PricingPlans({
  enabled = PAYWALL_CONFIG.enabled,
  variantOverride,
} = {}) {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, user } = useAuth();
  const { subscription, isLoading, isError, error, refetch } = useSubscription();
  const [period, setPeriod] = useState("annual");
  const [startingPlan, setStartingPlan] = useState(null);
  const [checkoutCanceled, setCheckoutCanceled] = useState(false);
  const requestKeys = useRef(new Map());
  const variant = useMemo(
    () => variantOverride || assignPaywallVariant(user?.id),
    [user?.id, variantOverride],
  );
  const copy = getPaywallCopy(variant);

  useEffect(() => {
    // Preserve campaign context when an ad or sitelink lands directly on pricing.
    captureMarketingAttribution();
    trackPaywallEvent("paywall_view", { variant, source: "pricing" });
    try {
      if (sessionStorage.getItem(CHECKOUT_RETURN_KEY) === "1") {
        sessionStorage.removeItem(CHECKOUT_RETURN_KEY);
        setCheckoutCanceled(true);
      }
    } catch {
      // Checkout remains usable even when session storage is blocked.
    }
  }, [variant]);

  const continueFree = () => {
    trackPaywallEvent("paywall_secondary_cta", { variant, plan: "free", source: "pricing" });
    trackPaywallEvent("paywall_dismissed", { variant, source: "continue_free" });
    const returnTo = location.state?.from;
    navigate(isAuthenticated && typeof returnTo === "string" ? returnTo : isAuthenticated ? "/messages" : "/");
  };

  const selectPeriod = (nextPeriod) => {
    setPeriod(nextPeriod);
    trackPaywallEvent("paywall_billing_toggle", {
      variant,
      billing_period: nextPeriod,
      source: "pricing",
    });
  };

  const startCheckout = async (planId) => {
    const sku = subscriptionSku(planId, period);
    if (!sku || startingPlan) return;

    trackPaywallEvent("paywall_tier_select", {
      variant,
      plan: planId,
      billing_period: period,
      sku,
    });
    trackPaywallEvent("paywall_primary_cta", {
      variant,
      plan: planId,
      billing_period: period,
      sku,
    });

    if (!isAuthenticated) {
      navigate(`/register?returnTo=${encodeURIComponent("/pricing")}`);
      return;
    }

    setCheckoutCanceled(false);
    setStartingPlan(planId);
    try {
      if (!requestKeys.current.has(sku)) {
        requestKeys.current.set(sku, createCheckoutRequestKey());
      }
      try { sessionStorage.setItem(CHECKOUT_RETURN_KEY, "1"); } catch {}
      const attribution = getMarketingAttribution();
      trackPaywallEvent("checkout_started", {
        variant,
        plan: planId,
        billing_period: period,
        sku,
        campaign_source: attribution?.utm_source || undefined,
        campaign_medium: attribution?.utm_medium || undefined,
        campaign_name: attribution?.utm_campaign || undefined,
        campaign_term: attribution?.utm_term || undefined,
        campaign_content: attribution?.utm_content || undefined,
        campaign_landing_path: attribution?.landing_path || undefined,
        google_ads_click: Boolean(attribution?.gclid || attribution?.gbraid || attribution?.wbraid),
      });
      await startSubscriptionCheckout({
        sku,
        idempotencyKey: requestKeys.current.get(sku),
        expectedUserId: user?.id,
      });
    } catch (checkoutError) {
      try { sessionStorage.removeItem(CHECKOUT_RETURN_KEY); } catch {}
      trackPaywallEvent("purchase_failed", {
        variant,
        plan: planId,
        billing_period: period,
        sku,
        outcome: "checkout_error",
      });
      toast.error(checkoutError?.message || "Could not start checkout. Please try again.");
      setStartingPlan(null);
    }
  };

  if (!enabled) {
    return (
      <div className="h-full min-h-0 overflow-y-auto touch-pan-y overscroll-contain [-webkit-overflow-scrolling:touch] bg-background px-4 py-10 sm:px-6 sm:py-16">
        <div className="ui-surface mx-auto max-w-xl rounded-3xl border border-border bg-card p-6 text-center sm:p-8">
          <h1 className="font-heading text-3xl font-black">Plans are temporarily unavailable</h1>
          <p className="mt-3 text-muted-foreground">Core chat is free forever.</p>
          <Button className="ui-hover mt-6 min-h-12 rounded-xl px-6 font-semibold" onClick={continueFree}>Continue with Free</Button>
        </div>
      </div>
    );
  }

  const paidSubscriber = subscription.hasPaidAccess;
  const paidCta = subscription.trialEligible ? copy.trialCta : "Choose plan";

  return (
    <div className="h-full min-h-0 overflow-y-auto touch-pan-y overscroll-contain [-webkit-overflow-scrolling:touch] bg-background">
      <section className="mx-auto max-w-6xl px-4 pb-[max(2rem,env(safe-area-inset-bottom))] pt-8 sm:px-6 sm:py-14">
        <div className="text-center">
          <p className="text-sm font-bold uppercase tracking-widest text-primary">NaliChat plans</p>
          <h1 className="mt-3 font-heading text-3xl font-black tracking-tight sm:text-5xl">{copy.headline}</h1>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">{copy.subhead}</p>
          <p className="mt-4 font-semibold">Core chat is free forever · No paid plan required to start</p>
          <p className="mx-auto mt-2 max-w-2xl text-sm text-muted-foreground">Compare Free, Premium, and Premium Plus before you choose. Paid plans add creator features while your core messaging access stays available.</p>
        </div>

        {checkoutCanceled && (
          <div className="mx-auto mt-8 max-w-2xl rounded-xl border border-border bg-card p-4 text-center" role="status">
            Checkout was canceled. No charge was made, and you can keep using Free.
          </div>
        )}

        {isError && (
          <div className="mx-auto mt-8 max-w-2xl rounded-xl border border-destructive/50 p-4 text-center" role="alert">
            <p>We could not verify your subscription. Paid access has not been granted.</p>
            <Button className="ui-hover mt-3 min-h-10 rounded-xl" size="sm" variant="outline" onClick={() => refetch()}>
              Try again
            </Button>
            {error?.message && <p className="sr-only">{error.message}</p>}
          </div>
        )}

        <fieldset className="mt-10">
          <legend className="sr-only">Billing period</legend>
          <div className="mx-auto flex w-full max-w-sm rounded-2xl border border-border bg-card p-1.5">
            {Object.values(BILLING_PERIODS).map((option) => (
              <button
                key={option.id}
                type="button"
                className={`ui-hover min-h-11 flex-1 rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${
                  period === option.id ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                }`}
                aria-pressed={period === option.id}
                onClick={() => selectPeriod(option.id)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </fieldset>

        <div className="mt-8 grid gap-4 sm:mt-10 sm:gap-6 md:grid-cols-3">
          <PlanCard
            plan={SUBSCRIPTION_CATALOG.free}
            period={period}
            isCurrent={!paidSubscriber}
            isPaidSubscriber={paidSubscriber}
            onContinueFree={continueFree}
          />
          {PAID_PLAN_IDS.map((planId) => (
            <PlanCard
              key={planId}
              plan={SUBSCRIPTION_CATALOG[planId]}
              period={period}
              badge={copy.badges[planId]}
              cta={paidCta}
              isCurrent={paidSubscriber && subscription.plan === planId}
              isPaidSubscriber={paidSubscriber}
              isStarting={startingPlan === planId || isLoading}
              onSelect={startCheckout}
              onContinueFree={continueFree}
            />
          ))}
        </div>

        {paidSubscriber && (
          <p className="mt-8 text-center text-sm text-muted-foreground">
            Plan changes are managed in Settings.
          </p>
        )}
        <div className="mt-8 text-center">
          <Button className="ui-hover min-h-11 rounded-xl px-5" variant="ghost" onClick={continueFree}>Continue with Free</Button>
          <p className="mt-2 text-sm text-muted-foreground">Paid subscriptions can be canceled in Settings. You can continue using Free afterward.</p>
        </div>
      </section>
    </div>
  );
}
