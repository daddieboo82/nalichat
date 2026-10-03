import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { base44 } from "@/api/base44Client";
import {
  initializeAppleIAP,
  isAppleIAPAvailable,
  purchaseAppleProduct,
  restoreApplePurchases,
  manageAppleSubscriptions,
} from "@/lib/appleIAP";
import { subscriptionQueryKey } from "@/lib/subscriptionClient";
import { trackPaywallEvent } from "@/lib/paywallAnalytics";

/**
 * React hook that wires the Apple IAP service into the pricing UI.
 *
 * On web, `available` is false and all methods are no-ops so the existing
 * PayPal/Stripe checkout flow is used instead.
 */
export function useAppleIAP() {
  const queryClient = useQueryClient();
  const [available] = useState(isAppleIAPAvailable());
  const [purchasingProductId, setPurchasingProductId] = useState(null);
  const [restoring, setRestoring] = useState(false);
  const initializedRef = useRef(false);

  const refreshSubscription = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: subscriptionQueryKey() });
  }, [queryClient]);

  // Send a verified transaction to the backend for validation + entitlement grant.
  const handleVerified = useCallback(
    async (transactionData) => {
      try {
        const response = await base44.functions.invoke("validateApplePurchase", transactionData);
        const payload = response?.data ?? response;
        if (!payload || payload.success !== true) {
          throw new Error(payload?.error || "Apple purchase validation failed");
        }
        refreshSubscription();
        trackPaywallEvent("purchase_completed", {
          plan: transactionData.plan,
          billing_period: transactionData.billingPeriod,
          provider: "apple",
          source: "apple_iap",
        });
      } catch (error) {
        console.error("Apple IAP: backend validation failed", error);
        toast.error("Purchase verified but entitlement could not be granted. Tap Restore Purchases to retry.");
      }
    },
    [refreshSubscription],
  );

  // Initialize the StoreKit store once on mount (iOS only).
  useEffect(() => {
    if (!available || initializedRef.current) return;
    initializedRef.current = true;
    initializeAppleIAP(handleVerified).catch((error) => {
      console.error("Apple IAP init error", error);
    });
  }, [available, handleVerified]);

  const purchase = useCallback(
    async (productId) => {
      if (!available) return;
      if (purchasingProductId) return;
      setPurchasingProductId(productId);
      try {
        await purchaseAppleProduct(productId);
        // The purchase result arrives via the verified listener; the button
        // stays in its loading state until the subscription query refreshes.
      } catch (error) {
        const message = String(error?.message || error || "");
        // User-cancelled purchases are not errors — StoreKit reports them
        // with codes like "cancelled" or by throwing a CANCEL error.
        if (/cancel/i.test(message)) {
          toast.info("Purchase canceled. No charge was made.");
        } else {
          console.error("Apple IAP purchase error", error);
          toast.error(message || "Could not start the purchase. Please try again.");
        }
        setPurchasingProductId(null);
      }
    },
    [available, purchasingProductId],
  );

  const restore = useCallback(async () => {
    if (!available || restoring) return;
    setRestoring(true);
    try {
      await restoreApplePurchases();
      // Restored transactions arrive via the verified listener. Give the
      // store a brief moment to deliver them before showing feedback.
      setTimeout(() => {
        refreshSubscription();
        toast.success("Purchases restored. Your subscription has been verified.");
      }, 1500);
    } catch (error) {
      console.error("Apple IAP restore error", error);
      toast.error("Could not restore purchases. Please try again later.");
    } finally {
      setRestoring(false);
    }
  }, [available, restoring, refreshSubscription]);

  const manageSubscriptions = useCallback(async () => {
    if (!available) return;
    try {
      await manageAppleSubscriptions();
    } catch (error) {
      console.error("Apple IAP manage error", error);
    }
  }, [available]);

  return {
    available,
    purchasingProductId,
    restoring,
    purchase,
    restore,
    manageSubscriptions,
  };
}