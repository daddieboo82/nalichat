import { useState } from "react";
import { Link } from "react-router-dom";
import { CreditCard, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useSubscription } from "@/hooks/useSubscription";
import { openBillingPortal, resumePendingPayPalApproval } from "@/lib/subscriptionBilling";
import { trackPaywallEvent } from "@/lib/paywallAnalytics";
import { useAuth } from "@/lib/AuthContext";
import { base44 } from "@/api/base44Client";

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
  const [checkingPayment, setCheckingPayment] = useState(false);
  const [resumingApproval, setResumingApproval] = useState(false);
  const [checkingPending, setCheckingPending] = useState(false);
  const [pendingReview, setPendingReview] = useState(null);
  const [paypalReceipt, setPaypalReceipt] = useState(null);
  const checkPayment = async () => {
    if (checkingPayment) return;
    setCheckingPayment(true);
    try {
      const response = await base44.functions.invoke("getMyPayPalBillingReceipt", {});
      const result = response?.data ?? response;
      if (result?.success !== true || result?.action !== "paypal_billing_receipt" || result.userId !== user?.id)
        throw new Error(result?.error || "Could not verify PayPal billing");
      setPaypalReceipt(result);
    } catch (err) { toast.error(err?.response?.data?.error || err?.message || "Could not check PayPal billing."); }
    finally { setCheckingPayment(false); }
  };
  const reviewPendingPayPal = async () => {
    if (checkingPending || !user?.id || !subscription.hasPending) return;
    setCheckingPending(true);
    setPendingReview(null);
    try {
      const response = await base44.functions.invoke("getMyPendingPayPalStatus", {});
      const payload = response?.data ?? response;
      if (payload?.success !== true || payload.action !== "get_my_pending_paypal_status" ||
          payload.userId !== user.id || !Array.isArray(payload.results)) {
        throw new Error(payload?.error || "PayPal status review could not be completed");
      }
      setPendingReview(payload);
    } catch (err) {
      toast.error(err?.response?.data?.error || err?.message || "PayPal status review is unavailable.");
    } finally {
      setCheckingPending(false);
    }
  };

  const resumeApproval = async () => {
    if (resumingApproval || !user?.id || subscription.hasPaidAccess || !subscription.hasPending) return;
    setResumingApproval(true);
    try {
      // This backend checks every earlier agreement and redirects ONLY to
      // one still-valid, customer-owned PayPal approval. No new billing created.
      await resumePendingPayPalApproval({ expectedUserId: user.id });
    } catch (err) {
      toast.error(err?.response?.data?.error || err?.message ||
        "The earlier PayPal approval could not be verified. Contact billing support before starting another subscription.");
      setResumingApproval(false);
    }
  };

  const [upgrading, setUpgrading] = useState(false);
  const [verifyingUpgrade, setVerifyingUpgrade] = useState(false);
  const returnedFromUpgrade = new URLSearchParams(window.location.search).get("paypal_upgrade") === "returned";

  const verifyUpgrade = async () => {
    if (verifyingUpgrade || !user?.id) return;
    setVerifyingUpgrade(true);
    try {
      const response = await base44.functions.invoke("verifyPayPalUpgrade", {});
      const payload = response?.data ?? response;
      if (payload?.success !== true || payload?.action !== "verify_paypal_upgrade" || payload.userId !== user.id || !payload.upgraded)
        throw new Error(payload?.error || "PayPal has not confirmed the upgrade yet");
      await refetch();
      toast.success("Premium Plus upgrade verified with PayPal.");
    } catch (err) {
      toast.error(err?.response?.data?.error || err?.message || "Upgrade is still awaiting PayPal confirmation.");
    } finally { setVerifyingUpgrade(false); }
  };

  const upgradePayPal = async () => {
    if (upgrading || !user?.id) return;
    setUpgrading(true);
    try {
      const sku = subscription.billingPeriod === "annual" ? "premium_plus_yearly" : "premium_plus_monthly";
      const response = await base44.functions.invoke("revisePayPalSubscription", { sku });
      const payload = response?.data ?? response;
      if (payload?.success !== true || payload?.action !== "revise_paypal_subscription" || payload.userId !== user.id || payload.sku !== sku) {
        throw new Error(payload?.error || "PayPal upgrade could not be started");
      }
      const url = new URL(payload.approvalUrl);
      if (url.protocol !== "https:" || url.hostname !== "www.paypal.com") throw new Error("PayPal approval URL was not trusted");
      window.location.assign(url.toString());
    } catch (err) {
      toast.error(err?.response?.data?.error || err?.message || "Unable to upgrade. Your current plan remains unchanged.");
      setUpgrading(false);
    }
  };

  const manageBilling = async () => {
    if (openingPortal) return;
    setOpeningPortal(true);
    try {
      if (subscription.provider === "paypal") {
        const response = await base44.functions.invoke("cancelPayPalSubscription", {});
        const payload = response?.data ?? response;
        if (
          payload?.success !== true ||
          payload?.action !== "cancel_paypal_subscription" ||
          (user?.id && payload?.userId !== user.id)
        ) {
          throw new Error(payload?.error || "Could not cancel PayPal subscription");
        }
        toast.success(payload.alreadyCanceled ? "PayPal subscription is already canceled." : "Cancellation sent to PayPal. Your plan will update after confirmation.");
        await refetch();
        setOpeningPortal(false);
        return;
      }

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
      <div className="ui-surface min-h-28 rounded-3xl border border-border bg-card/50 p-5 sm:p-6" aria-live="polite">
        <Loader2 className="h-5 w-5 animate-spin text-primary" aria-hidden="true" />
        <span className="sr-only">Loading subscription</span>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="ui-surface rounded-3xl border border-destructive/50 bg-card/50 p-5 sm:p-6" role="alert">
        <h3 className="font-heading text-lg font-semibold">Subscription unavailable</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          We could not verify your plan. Paid access remains locked until verification succeeds.
        </p>
        {error?.message && <p className="sr-only">{error.message}</p>}
        <Button className="ui-hover mt-4 min-h-10 rounded-xl" size="sm" variant="outline" onClick={() => refetch()}>
          Try again
        </Button>
      </div>
    );
  }

  const trialEnd = formattedDate(subscription.trialEndDate);
  const periodEnd = formattedDate(subscription.currentPeriodEnd);
  // A canceled or ended agreement can no longer be billed, so those customers get
  // the plan chooser (to buy a new plan or upgrade) instead of a cancel button.
  const isCanceledSubscription = subscription.status === "canceled" || subscription.status === "ended";
  const canManageBilling = !isCanceledSubscription
    && (subscription.provider === "stripe" || subscription.provider === "paypal");

  return (
    <div className="ui-surface rounded-3xl border border-white/[0.06] bg-card/50 p-5 backdrop-blur-xl sm:p-6">
      {subscription.hasPending && !subscription.hasPaidAccess && (
        <div className="mb-5 space-y-3 rounded-xl border border-amber-500/40 bg-amber-500/5 p-4" role="status">
          <p className="font-semibold">Earlier PayPal subscription needs review</p>
          <p className="text-sm text-muted-foreground">You may have an unfinished PayPal approval. Continue only the existing agreement; no new subscription will be created.</p>
          <div className="flex flex-wrap gap-2">
            <Button onClick={reviewPendingPayPal} disabled={checkingPending} variant="outline" className="min-h-11">
              {checkingPending ? "Checking PayPal..." : "Check existing PayPal agreements"}
            </Button>
            <Button onClick={resumeApproval} disabled={resumingApproval} className="min-h-11 w-full sm:w-auto">
            {resumingApproval ? "Checking earlier approval..." : "Continue existing PayPal approval"}
            </Button>
          </div>
          {pendingReview && (
            <div className="space-y-1 text-sm" aria-live="polite">
              <p>Earlier agreements checked: {pendingReview.total}</p>
              <p>PayPal reported: {pendingReview.results.map((result) => String(result.status).replaceAll("_", " ")).join(", ") || "none"}.</p>
              <p className="text-muted-foreground">This check does not confirm payment or change billing. Approved or active agreements still require subscription verification.</p>
            </div>
          )}
          <p className="text-sm text-muted-foreground">If PayPal cannot verify your earlier agreement, <a href="mailto:nalichat@nalichat.org?subject=NaliChat%20PayPal%20billing%20review" className="underline underline-offset-2">contact billing support</a> before trying another checkout.</p>
        </div>
      )}
      {returnedFromUpgrade && subscription.provider === "paypal" && (
        <div className="mb-5 rounded-xl border border-border p-4">
          <p className="mb-3 text-sm">Returned from PayPal? Verify your approved plan change to activate Premium Plus.</p>
          <Button onClick={verifyUpgrade} disabled={verifyingUpgrade} className="min-h-11">
            {verifyingUpgrade ? "Checking PayPal..." : "Verify PayPal upgrade"}
          </Button>
        </div>
      )}
      <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-start">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-heading text-xl font-semibold">
              {subscriptionPlanLabel(subscription.plan)}
            </h3>
            <Badge className="rounded-lg px-2.5 py-1 capitalize" variant="outline">{subscription.status}</Badge>
            {subscription.grandfathered && (
              <Badge className="rounded-lg bg-primary/20 px-2.5 py-1 text-primary hover:bg-primary/20">
                Grandfathered
              </Badge>
            )}
          </div>

          <dl className="mt-4 space-y-2 text-sm">
            {subscription.billingPeriod && (
              <div className="flex flex-wrap gap-x-2 gap-y-0.5">
                <dt className="text-muted-foreground">Billing period:</dt>
                <dd className="capitalize">{subscription.billingPeriod === "annual" ? "Yearly" : subscription.billingPeriod}</dd>
              </div>
            )}
            {subscription.isTrialing && trialEnd && (
              <div className="flex flex-wrap gap-x-2 gap-y-0.5">
                <dt className="text-muted-foreground">Trial ends:</dt>
                <dd>{trialEnd}</dd>
              </div>
            )}
            {periodEnd && (
              <div className="flex flex-wrap gap-x-2 gap-y-0.5">
                <dt className="text-muted-foreground">
                  {subscription.cancelAtPeriodEnd || isCanceledSubscription ? "Access until:" : "Renews on:"}
                </dt>
                <dd>{periodEnd}</dd>
              </div>
            )}
            {subscription.cancelAtPeriodEnd && (
              <div className="flex flex-wrap gap-x-2 gap-y-0.5">
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
          <p className="mt-4 text-sm text-muted-foreground">Premium expands NaliBase with advanced creator, AI, Studio, messaging, and privacy tools.</p>
          <p className="text-sm text-muted-foreground">Manage or cancel an active subscription here at any time.</p>
          {subscription.provider === "paypal" && (
            <div className="mt-4 space-y-2 rounded-xl border border-border p-3">
              <Button variant="outline" className="min-h-11" onClick={checkPayment} disabled={checkingPayment}>
                {checkingPayment ? "Checking PayPal..." : "Check payment and next billing date"}
              </Button>
              {paypalReceipt && (
                <div className="space-y-1 text-sm" aria-live="polite">
                  <p>PayPal agreement: {paypalReceipt.providerStatus}</p>
                  <p>Last recorded PayPal payment: {paypalReceipt.lastPayment ? `${paypalReceipt.lastPayment.amount} ${paypalReceipt.lastPayment.currency} on ${formattedDate(paypalReceipt.lastPayment.time)}` : "No payment details returned"}</p>
                  <p>Next PayPal billing date: {formattedDate(paypalReceipt.nextBillingTime) || "Not available"}</p>
                  <p className="text-muted-foreground">A previous payment does not mean the upgrade itself was charged.</p>
                </div>
              )}
            </div>
          )}
        </div>

        {subscription.provider === "paypal" && subscription.plan === "premium" && subscription.hasLiveSubscription && (
          <Button onClick={upgradePayPal} disabled={upgrading} className="ui-hover min-h-12 w-full shrink-0 rounded-xl font-semibold sm:w-auto">
            {upgrading ? "Opening PayPal..." : "Upgrade to Premium Plus"}
          </Button>
        )}
        {canManageBilling ? (
          <Button onClick={manageBilling} disabled={openingPortal} className="ui-hover min-h-12 w-full shrink-0 gap-2 rounded-xl font-semibold focus-visible:ring-2 focus-visible:ring-primary/40 sm:w-auto">
            {openingPortal ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <CreditCard className="h-4 w-4" aria-hidden="true" />
            )}
            {openingPortal ? (subscription.provider === "paypal" ? "Canceling..." : "Opening...") : (subscription.provider === "paypal" ? "Cancel PayPal Subscription" : "Manage Billing")}
          </Button>
        ) : (
          <Button asChild className="ui-hover min-h-11 w-full shrink-0 gap-2 rounded-xl font-semibold sm:w-auto">
            <Link to="/pricing">
              <CreditCard className="h-4 w-4" aria-hidden="true" />
              Compare plans
            </Link>
          </Button>
        )}
      </div>
    </div>
  );
}