import { useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/AuthContext";
import {
  checkSubscriptionStatus,
  FREE_SUBSCRIPTION,
  subscriptionQueryKey,
} from "@/lib/subscriptionClient";

export function useSubscription() {
  const { isAuthenticated, user } = useAuth();
  const query = useQuery({
    queryKey: subscriptionQueryKey(user?.id),
    queryFn: () => checkSubscriptionStatus(user?.id),
    enabled: !!isAuthenticated,
    retry: false,
    staleTime: 30_000,
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
    refetchOnReconnect: true,
    refetchOnWindowFocus: true,
  });

  const hasVerificationError = query.isError
    || query.isRefetchError
    || query.errorUpdatedAt > query.dataUpdatedAt;
  const subscription = hasVerificationError ? FREE_SUBSCRIPTION : query.data || FREE_SUBSCRIPTION;
  const hasEntitlement = useCallback(
    (entitlement) => subscription.entitlements[entitlement] === true,
    [subscription.entitlements],
  );

  return {
    subscription,
    plan: subscription.plan,
    status: subscription.status,
    billingPeriod: subscription.billingPeriod,
    trial: {
      eligible: subscription.trialEligible,
      startedAt: subscription.trialStartedAt,
      endsAt: subscription.trialEndDate,
      usedAt: subscription.trialUsedAt,
      active: subscription.isTrialing,
    },
    grandfathering: {
      active: subscription.grandfathered,
      fromPlan: subscription.grandfatheredFromPlan,
    },
    entitlements: subscription.entitlements,
    hasEntitlement,
    hasPaidAccess: subscription.hasPaidAccess,
    isTrialActive: subscription.isTrialing,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: hasVerificationError,
    error: query.error || null,
    refetch: query.refetch,
  };
}
