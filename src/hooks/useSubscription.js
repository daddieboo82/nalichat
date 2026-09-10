// The app is completely free to use — the frontend no longer gates features
// behind subscription tiers or trials.
export function useSubscription() {
  return {
    subscription: { plan: 'free', status: 'active', hasAccess: true },
    isPro: false,
    isProFilesharing: false,
    isTrialActive: false,
    hasAccess: true,
    isLoading: false,
    refetch: async () => {},
  };
}