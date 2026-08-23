// The app is completely free — all features are unlocked for all users.
// Monetization is through per-item sales (tracks, files) via the cart/checkout flow,
// not through subscriptions or trials.
export function useSubscription() {
  return {
    subscription: { plan: 'free', status: 'active', hasAccess: true },
    isPro: true,
    isProFilesharing: true,
    isTrialActive: false,
    hasAccess: true,
    isLoading: false,
    refetch: async () => {},
  };
}