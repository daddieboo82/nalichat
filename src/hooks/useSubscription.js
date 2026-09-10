import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";

export function useSubscription() {
  const { isAuthenticated } = useAuth();
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["subscription"],
    queryFn: async () => {
      const res = await base44.functions.invoke("checkSubscriptionStatus");
      return res?.data || {
        plan: "free",
        status: "inactive",
        hasAccess: false,
        hasPending: false,
        currentPeriodEnd: null,
      };
    },
    enabled: !!isAuthenticated,
    retry: false,
  });

  const subscription = data || {
    plan: "free",
    status: "inactive",
    hasAccess: false,
    hasPending: false,
    currentPeriodEnd: null,
  };

  return {
    subscription,
    isPro: !!subscription.hasAccess,
    isProFilesharing: !!subscription.hasAccess,
    isTrialActive: false,
    hasAccess: !!subscription.hasAccess,
    isLoading,
    refetch,
  };
}