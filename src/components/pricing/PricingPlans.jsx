import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Loader2, MessageSquare, Music2, Files, Sparkles, ShieldCheck, Crown, Zap } from "lucide-react";
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
import { trackProductEvent } from "@/lib/productAnalytics";
import { captureMarketingAttribution, getMarketingAttribution } from "@/lib/adAttribution";
import {
  CHECKOUT_RETURN_KEY,
  CHECKOUT_ATTRIBUTION_KEY,
  createCheckoutRequestKey,
  startSubscriptionCheckout,
  resumePendingPayPalApproval,
} from "@/lib/subscriptionBilling";
import { useAppleIAP } from "@/hooks/useAppleIAP";

function PlanCard({
  plan,
  period,
  badge,
  cta,
  isCurrent,
  isPaidSubscriber,
  isStarting,
  isCheckoutPaused,
  onSelect,
  onContinueFree,
}) {
  const price = plan.prices[period];
  const paid = plan.id !== "free";

  return (
    <article
      className={`ui-surface relative flex h-full min-w-0 flex-col overflow-hidden rounded-3xl border p-5 sm:p-6 ${
        badge ? "border-primary bg-primary/5 shadow-lg shadow-primary/10" : "border-border bg-card"
      }`}
      aria-labelledby={`${plan.id}-plan-title`}
      id={`${plan.id}-plan`}
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
      <div className="mt-6 flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="max-w-full break-words font-heading text-4xl font-black leading-none">{price.label}</span>
        <span className="min-w-0 break-words text-sm text-muted-foreground">{price.suffix}</span>
      </div>
      {paid && period === "annual" && (
        <p className="mt-2 break-words text-sm font-semibold leading-relaxed text-primary">
          Save ${annualSavings(plan.id)} vs. paying monthly
        </p>
      )}
      <ul className="my-6 flex-1 space-y-3">
        {plan.features.map((feature) => (
          <li key={feature} className="flex min-w-0 items-start gap-3 text-sm leading-relaxed">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
            <span className="min-w-0 break-words">{feature}</span>
          </li>
        ))}
      </ul>

      {paid ? (
        <Button
          className="ui-hover min-h-12 w-full rounded-xl font-semibold shadow-lg shadow-primary/10"
          disabled={isStarting || isCurrent || isPaidSubscriber || isCheckoutPaused}
          onClick={() => onSelect(plan.id)}
        >
          {isStarting && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
          {isCurrent ? "Current plan" : isPaidSubscriber ? "Manage in Settings" : isCheckoutPaused ? "Review existing billing" : cta}
        </Button>
      ) : (
        <Button className="ui-hover min-h-12 w-full rounded-xl font-semibold" variant="outline" onClick={onContinueFree}>
          Keep current plan
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
  const appleIAP = useAppleIAP();
  const [period, setPeriod] = useState(() => new URLSearchParams(window.location.search).get("billing") === "annual" ? "annual" : "monthly");
  const [startingPlan, setStartingPlan] = useState(null);
  const [resumingPayPal, setResumingPayPal] = useState(false);
  const [checkoutCanceled, setCheckoutCanceled] = useState(false);
  const [checkoutRecoveryNeeded, setCheckoutRecoveryNeeded] = useState(false);
  const requestKeys = useRef(new Map());
  const variant = useMemo(
    () => variantOverride || assignPaywallVariant(user?.id),
    [user?.id, variantOverride],
  );
  const copy = getPaywallCopy(variant);
  const upgradeFeature = new URLSearchParams(location.search).get("feature");
  const upgradeSource = new URLSearchParams(location.search).get("source");
  const selectedBeforeSignup = new URLSearchParams(location.search).get("plan");
  useEffect(() => {
    // Returning from registration should put the chosen paid plan in view.
    // Scrolling is navigation only; checkout still requires an explicit click.
    if (!isAuthenticated || isLoading || !PAID_PLAN_IDS.includes(selectedBeforeSignup)) return;
    const card = document.getElementById(`${selectedBeforeSignup}-plan`);
    if (card) card.scrollIntoView({ block: "start", behavior: "auto" });
  }, [isAuthenticated, isLoading, selectedBeforeSignup]);


  useEffect(() => {
    // Preserve campaign context when an ad or sitelink lands directly on pricing.
    captureMarketingAttribution();
    const attribution = getMarketingAttribution();
    trackPaywallEvent("paywall_view", {
      variant,
      source: upgradeSource || "pricing",
      upgrade_feature: upgradeFeature || undefined,
      campaign_source: attribution?.utm_source || undefined,
      campaign_medium: attribution?.utm_medium || undefined,
      campaign_name: attribution?.utm_campaign || undefined,
      campaign_term: attribution?.utm_term || undefined,
      campaign_content: attribution?.utm_content || undefined,
      campaign_landing_path: attribution?.landing_path || undefined,
      google_ads_click: Boolean(attribution?.gclid || attribution?.gbraid || attribution?.wbraid),
    });
    try {
      const canceled = new URLSearchParams(location.search).get("checkout") === "paypal_canceled";
      if (canceled) {
        setCheckoutCanceled(true);
        if (sessionStorage.getItem(CHECKOUT_RETURN_KEY) === "1") {
          sessionStorage.removeItem(CHECKOUT_RETURN_KEY);
          const raw = sessionStorage.getItem(CHECKOUT_ATTRIBUTION_KEY);
          sessionStorage.removeItem(CHECKOUT_ATTRIBUTION_KEY);
          const checkout = raw ? JSON.parse(raw) : null;
          trackPaywallEvent("checkout_canceled", {
            source: checkout?.source || "pricing",
            upgrade_feature: checkout?.feature,
            checkout_sku: checkout?.sku,
          }, checkout?.userId);
        }
      }
    } catch {
      // Checkout remains usable even when session storage is blocked.
    }
  }, [variant, upgradeFeature, upgradeSource, location.search]);

  const continueFree = () => {
    trackPaywallEvent("paywall_secondary_cta", { variant, plan: "free", source: upgradeSource || "pricing", ...campaignContext() });
    trackPaywallEvent("paywall_dismissed", { variant, source: upgradeSource ? `${upgradeSource}_dismissed` : "pricing_dismissed", ...campaignContext() });
    const returnTo = location.state?.from;
    navigate(isAuthenticated && typeof returnTo === "string" ? returnTo : isAuthenticated ? "/messages" : "/");
  };

  const campaignContext = () => {
    const attribution = getMarketingAttribution();
    return {
      upgrade_feature: upgradeFeature || undefined,
      campaign_source: attribution?.utm_source || undefined,
      campaign_medium: attribution?.utm_medium || undefined,
      campaign_name: attribution?.utm_campaign || undefined,
      campaign_term: attribution?.utm_term || undefined,
      campaign_content: attribution?.utm_content || undefined,
      campaign_landing_path: attribution?.landing_path || undefined,
      google_ads_click: Boolean(attribution?.gclid || attribution?.gbraid || attribution?.wbraid),
    };
  };

  const selectPeriod = (nextPeriod) => {
    setPeriod(nextPeriod);
    trackPaywallEvent("paywall_billing_toggle", {
      variant,
      billing_period: nextPeriod,
      source: "pricing",
      ...campaignContext(),
    });
  };

  const resumePayPal = async () => {
    if (!isAuthenticated) {
      navigate(`/login?returnTo=${encodeURIComponent(location.pathname + location.search)}`);
      return;
    }
    if (resumingPayPal || subscription.hasPaidAccess) return;
    setResumingPayPal(true);
    try {
      trackPaywallEvent("paypal_approval_resume_click", { source: upgradeSource || "pricing" });
      await resumePendingPayPalApproval({ expectedUserId: user?.id });
    } catch (error) {
      const message = String(error?.response?.data?.error || error?.data?.error || error?.message || "We could not resume your earlier PayPal approval.");
      if (/reconciliation|required|not found|could not be verified|review/i.test(message)) setCheckoutRecoveryNeeded(true);
      toast.error(message + " If the agreement cannot be verified, contact billing support before starting another checkout.");
      setResumingPayPal(false);
    }
  };

  const startCheckout = async (planId) => {
    const sku = subscriptionSku(planId, period);
    if (!sku || startingPlan) return;
    trackPaywallEvent("paywall_tier_select", {
      variant,
      plan: planId,
      billing_period: period,
      sku,
      source: upgradeSource || "pricing",
      ...campaignContext(),
    });
    trackPaywallEvent("paywall_primary_cta", {
      variant,
      plan: planId,
      billing_period: period,
      sku,
      source: upgradeSource || "pricing",
      ...campaignContext(),
    });

    if (!isAuthenticated) {
      trackProductEvent("signup_click", { source: "pricing_plan", cta: "select_paid_plan", plan: planId, billing_period: period });
      // Preserve the buyer's selected tier and billing period across signup.
      // Registration returns to pricing; it must never initiate a charge
      // without another explicit customer action.
      const destination = new URL(location.pathname + location.search, window.location.origin);
      destination.searchParams.set("plan", planId);
      destination.searchParams.set("billing", period);
      navigate(`/register?returnTo=${encodeURIComponent(destination.pathname + destination.search)}`);
      return;
    }

    // Verify billing only when a signed-in customer is about to start
    // a payment. Anonymous plan selection is not a payment operation.
    if (isLoading || isError) {
      toast.error("We could not verify your current billing status. Try again before starting a subscription.");
      return;
    }
    if (subscription.hasPaidAccess) {
      toast.error("Your account already has paid access. Manage billing in Settings.");
      return;
    }
    if (subscription.hasPending) {
      setCheckoutRecoveryNeeded(true);
      toast.error("An earlier checkout needs review before starting another subscription.");
      return;
    }

    // On iOS native, use Apple In-App Purchase instead of PayPal checkout.
    if (appleIAP.available) {
      // StoreKit owns its purchase/loading lifecycle. Do not also set the
      // PayPal-only startingPlan flag: it would stay stuck after cancellation.
      await appleIAP.purchase(sku);
      return;
    }

    setCheckoutCanceled(false);
    setCheckoutRecoveryNeeded(false);
    setStartingPlan(planId);
    try {
      if (!requestKeys.current.has(sku)) {
        requestKeys.current.set(sku, createCheckoutRequestKey());
      }
      try {
        try { sessionStorage.setItem(CHECKOUT_RETURN_KEY, "1"); } catch {}
        sessionStorage.setItem(CHECKOUT_ATTRIBUTION_KEY, JSON.stringify({ source: upgradeSource || "pricing", feature: upgradeFeature || undefined, sku, userId: user?.id }));
      } catch {}
      // Marketing attribution is optional. Storage or analytics failures must
      // never prevent an authenticated customer from reaching PayPal.
      let attribution = null;
      try { attribution = getMarketingAttribution(); } catch {
        console.warn("Checkout attribution unavailable");
      }
      trackPaywallEvent("checkout_started", {
        variant,
        plan: planId,
        billing_period: period,
        sku,
        source: upgradeSource || "pricing",
        upgrade_feature: upgradeFeature || undefined,
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
      try {
        try { sessionStorage.removeItem(CHECKOUT_RETURN_KEY); } catch {}
        sessionStorage.removeItem(CHECKOUT_ATTRIBUTION_KEY);
      } catch {}
      // The SDK may reject non-2xx responses before responsePayload can read
      // the structured code. Recover it from the transport response too.
      const providerError = checkoutError?.response?.data || checkoutError?.data || {};
      const checkoutMessage = String(providerError?.error || checkoutError?.message || "");
      const checkoutCode = providerError?.code || checkoutError?.code;
      // Report a bounded failure category, never provider messages or account details.
      const failureReason = checkoutCode === "PAYPAL_CHECKOUT_UNCERTAIN" ? "provider_uncertain"
        : checkoutCode === "CHECKOUT_DEPENDENCY_ERROR" ? "dependency_error"
        : /pending|already been started|previous PayPal|account review|subscription history requires review/i.test(checkoutMessage) ? "existing_billing_review"
        : /already has a paid subscription/i.test(checkoutMessage) ? "already_subscribed"
        : /plan is not configured|credentials are not configured/i.test(checkoutMessage) ? "configuration"
        : "other";
      trackPaywallEvent("purchase_failed", {
        variant,
        plan: planId,
        billing_period: period,
        sku,
        outcome: "checkout_error",
        reason: failureReason,
        source: upgradeSource || "pricing",
        upgrade_feature: upgradeFeature || undefined,
        checkout_sku: sku,
        ...campaignContext(),
      });
      if (checkoutCode === "PAYPAL_CHECKOUT_UNCERTAIN" || /pending|already been started|previous PayPal|check billing before retrying|review billing before trying again|duplicate subscriptions|checkout could not be confirmed|previous PayPal billing|previous PayPal checkout|account review|subscription history requires review/i.test(checkoutMessage)) {
        setCheckoutRecoveryNeeded(true);
      }
      toast.error(checkoutMessage || "Could not start checkout. Please try again.");
      setStartingPlan(null);
    }
  };

  if (!enabled) {
    return (
      <div className="h-full min-h-0 overflow-y-auto touch-pan-y overscroll-contain [-webkit-overflow-scrolling:touch] bg-background px-4 py-10 sm:px-6 sm:py-16">
        <div className="ui-surface mx-auto max-w-xl rounded-3xl border border-border bg-card p-6 text-center sm:p-8">
          <h1 className="font-heading text-3xl font-black">Plans are temporarily unavailable</h1>
          <p className="mt-3 text-muted-foreground">Your current access remains available while paid plans are unavailable.</p>
          <Button className="ui-hover mt-6 min-h-12 rounded-xl px-6 font-semibold" onClick={continueFree}>Return to NaliBase</Button>
        </div>
      </div>
    );
  }

  const paidSubscriber = subscription.hasPaidAccess;
  const paidCta = "Choose plan";

  return (
    <div className="h-full min-h-0 overflow-y-auto touch-pan-y overscroll-contain [-webkit-overflow-scrolling:touch] bg-background">
      <section className="mx-auto max-w-6xl px-4 pb-[max(2rem,env(safe-area-inset-bottom))] pt-8 sm:px-6 sm:py-14">
        <div className="text-center">
          <p className="text-sm font-bold uppercase tracking-widest text-primary">{upgradeFeature ? "Unlock your next creator tool" : "NaliBase plans"}</p>
          <h1 className="mt-3 font-heading text-3xl font-black tracking-tight sm:text-5xl">{copy.headline}</h1>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">{copy.subhead}</p>
          <p className="mt-4 font-semibold">Make music. Find collaborators. Finish songs. Release more.</p>
          <p className="mx-auto mt-2 max-w-2xl text-sm text-muted-foreground">Premium starts at $7.99/month. Unlock more NALI.ai, larger creative transfers, advanced messaging, and deeper Studio tools. Cancel anytime in Settings.</p>
          {!paidSubscriber && (
            <div className="mx-auto mt-4 flex max-w-lg flex-wrap justify-center gap-2">
              <a href="#premium-plan" className="inline-flex min-h-11 items-center justify-center rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground focus-visible:ring-2 focus-visible:ring-primary/50">
                View Premium plans
              </a>
              <a href="#premium_plus-plan" className="inline-flex min-h-11 items-center justify-center rounded-xl border border-border bg-card px-4 py-2 text-sm font-semibold focus-visible:ring-2 focus-visible:ring-primary/50">
                Compare Premium Plus
              </a>
            </div>
          )}
          {!paidSubscriber && (
            <div className="mx-auto mt-5 grid max-w-3xl gap-2 text-left sm:grid-cols-2">
              <div className="rounded-2xl border border-primary/25 bg-primary/5 p-4">
                <div className="flex items-center gap-2 font-bold"><Zap className="h-4 w-4 text-primary" /> Premium · $7.99/mo</div>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">For creators ready to work faster with more AI, advanced Studio tools, larger transfers and upgraded messaging.</p>
              </div>
              <div className="rounded-2xl border border-amber-400/25 bg-amber-400/5 p-4">
                <div className="flex items-center gap-2 font-bold"><Crown className="h-4 w-4 text-amber-400" /> Premium Plus · $14.99/mo</div>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">For power users who want the highest AI limits, strongest Studio support and the complete premium creator experience.</p>
              </div>
            </div>
          )}
          <div className="mx-auto mt-5 max-w-2xl rounded-2xl border border-primary/30 bg-primary/5 px-4 py-3 text-sm">
            <span className="font-bold">{upgradeFeature ? "You came here to unlock a premium creator feature:" : "Why creators upgrade:"}</span>{" "}
            {upgradeFeature === "studio.ai_mastering" ? "AI Auto-Mastering applies EQ, compression, and limiting to your Studio bounce. It’s included in Premium and Premium Plus." : upgradeFeature ? `${upgradeFeature.replaceAll(".", " ")}. Choose the plan that fits your workflow below.` : "fewer app switches, more room for creative files, and premium tools available right where the work happens."}
          </div>
          <div className="mx-auto mt-6 grid max-w-3xl grid-cols-2 gap-2 sm:grid-cols-5">{[[MessageSquare,"Messages"],[Music2,"Studio"],[Files,"File sharing"],[Sparkles,"NALI.ai"],[ShieldCheck,"Privacy"]].map(([Icon,label]) => <div key={label} className="rounded-xl border border-border/60 bg-card/60 px-3 py-2 text-xs font-semibold"><Icon className="mx-auto mb-1 h-4 w-4 text-primary" />{label}</div>)}</div>
        </div>

        {subscription.hasPending && !subscription.hasPaidAccess && (
          <div className="mx-auto mt-8 max-w-2xl rounded-xl border border-primary/40 bg-primary/5 p-4 text-center" role="status">
            <p>{appleIAP.available ? "An earlier approval is pending. Check your subscription in Settings." : "Your account has an unresolved PayPal checkout record. We must verify the earlier agreement before starting another subscription."}</p>
            {!appleIAP.available && isAuthenticated && (
              <>
              <Button className="mt-3 min-h-11" onClick={resumePayPal} disabled={resumingPayPal}>
                {resumingPayPal && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
                Continue existing PayPal approval
              </Button>
              <Button variant="outline" className="mt-3 ml-2 min-h-11" onClick={() => navigate("/settings")}>Review billing in Settings</Button>
              </>
            )}
            <p className="mt-2 text-xs text-muted-foreground">Continue approval only if PayPal still recognizes the earlier agreement. If it cannot be verified, no redirect or new subscription will be started. Contact billing support for reconciliation.</p>
            <p className="mt-3 text-sm text-muted-foreground">If PayPal cannot find your previous agreement, <a className="font-semibold underline underline-offset-2" href="mailto:nalichat@nalichat.org?subject=NaliChat%20PayPal%20subscription%20review">contact billing support</a> so we can reconcile it without risking a duplicate charge.</p>
          </div>
        )}

        {checkoutRecoveryNeeded && !subscription.hasPending && !paidSubscriber && (
          <div className="mx-auto mt-8 max-w-2xl rounded-xl border border-primary/40 bg-primary/5 p-4 text-center" role="status">
            <p className="font-semibold">PayPal checkout needs a billing review.</p>
            <p className="mt-2 text-sm text-muted-foreground">The previous checkout result could not be confirmed. You can check whether PayPal recognizes an earlier approval, or review billing in Settings. Neither action creates a new subscription.</p>
            <p className="mt-2 text-sm text-muted-foreground">Still blocked? <a className="font-semibold underline underline-offset-2" href="mailto:nalichat@nalichat.org?subject=NaliChat%20blocked%20PayPal%20checkout">Contact billing support for a checkout review</a>. Do not start another PayPal agreement until the earlier attempt is verified.</p>
            <div className="mt-3 flex flex-wrap justify-center gap-2">
              <Button className="min-h-11" onClick={resumePayPal} disabled={resumingPayPal}>
                {resumingPayPal && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
                Continue PayPal approval
              </Button>
              <Button variant="outline" className="min-h-11" onClick={() => navigate("/settings")}>Review billing</Button>
            </div>
          </div>
        )}

        {checkoutCanceled && (
          <div className="mx-auto mt-8 max-w-2xl rounded-xl border border-border bg-card p-4 text-center" role="status">
            {appleIAP.available ? "You returned from PayPal without completing the checkout. Use Settings to review the subscription status." : "You returned without completing PayPal approval. If you already have a pending agreement, use Continue existing PayPal approval or review billing in Settings."}
          </div>
        )}

        {isAuthenticated && isError && (
          <div className="mx-auto mt-8 max-w-2xl rounded-xl border border-destructive/50 p-4 text-center" role="alert">
            <p>We could not verify your subscription. Paid access has not been granted.</p>
            <Button className="ui-hover mt-3 min-h-10 rounded-xl" size="sm" variant="outline" onClick={() => refetch()}>
              Try again
            </Button>
            {error?.message && <p className="sr-only">{error.message}</p>}
          </div>
        )}

        {isAuthenticated && !paidSubscriber && PAID_PLAN_IDS.includes(selectedBeforeSignup) && (
          <p className="mx-auto mt-6 max-w-2xl rounded-xl border border-primary/30 bg-primary/5 p-4 text-center text-sm" role="status">
            Welcome back! Your selected {SUBSCRIPTION_CATALOG[selectedBeforeSignup].name} plan is ready below. Select its upgrade button to continue securely to PayPal.
          </p>
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
          {PAID_PLAN_IDS.map((planId) => (
            <PlanCard
              key={planId}
              plan={SUBSCRIPTION_CATALOG[planId]}
              period={period}
              badge={period === "monthly" ? (planId === "premium" ? "Best value to get started" : "Maximum power") : copy.badges[planId]}
              cta={period === "monthly" ? (planId === "premium" ? "Upgrade to Premium" : "Go Premium Plus") : paidCta}
              isCurrent={paidSubscriber && subscription.plan === planId}
              isPaidSubscriber={paidSubscriber}
              isCheckoutPaused={isAuthenticated && (isError || subscription.hasPending)}
              isStarting={startingPlan === planId || (isAuthenticated && (isLoading || appleIAP.purchasingProductId === subscriptionSku(planId, period)))}
              onSelect={startCheckout}
              onContinueFree={continueFree}
            />
          ))}
          <PlanCard
            plan={SUBSCRIPTION_CATALOG.free}
            period={period}
            isCurrent={!paidSubscriber}
            isPaidSubscriber={paidSubscriber}
            onContinueFree={continueFree}
          />
        </div>

        {paidSubscriber && (
          <div className="mt-8 text-center">
            <p className="mb-3 text-sm text-muted-foreground">Already subscribed? Change your plan without starting another subscription.</p>
            <Button className="min-h-12 rounded-xl" onClick={() => navigate("/settings")}>Manage or upgrade subscription</Button>
          </div>
        )}
        <div className="mt-8 text-center">
          {appleIAP.available && (
            <div className="mb-4">
              <Button
                className="ui-hover min-h-11 rounded-xl px-5"
                variant="outline"
                disabled={appleIAP.restoring}
                onClick={appleIAP.restore}
              >
                {appleIAP.restoring && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
                Restore Purchases
              </Button>
              <p className="mt-2 text-xs text-muted-foreground">Already subscribed on this device? Restore your purchase to unlock access.</p>
            </div>
          )}
          <Button className="ui-hover min-h-11 rounded-xl px-5" variant="ghost" onClick={continueFree}>Maybe later</Button>
          <p className="mt-2 text-sm text-muted-foreground">Paid subscriptions can be canceled in Settings. Your current access remains available afterward.</p>
        </div>
      </section>
    </div>
  );
}