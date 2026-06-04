import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

export function useSubscription() {
  const { data: subscription = { plan: 'free', status: 'active' }, isLoading, refetch } = useQuery({
    queryKey: ['subscription'],
    queryFn: async () => {
      try {
        const response = await base44.functions.invoke('checkSubscriptionStatus', {});
        return response.data;
      } catch (error) {
        console.error('Failed to fetch subscription:', error);
        return { plan: 'free', status: 'active' };
      }
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  const isPro = subscription?.plan === 'pro' && subscription?.status === 'active';
  const isTrialActive = subscription?.trialActive;
  const hasAccess = isPro || isTrialActive;

  return {
    subscription,
    isPro,
    isTrialActive,
    hasAccess,
    isLoading,
    refetch,
  };
}