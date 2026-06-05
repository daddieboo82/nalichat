import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';

export function useSubscription() {
  const { user } = useAuth();
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

  const isAdmin = user?.role === 'admin' || user?.email === 'bossglop43@gmail.com';
  const isPro = isAdmin || (subscription?.plan === 'pro' && subscription?.status === 'active');
  const isTrialActive = subscription?.trialActive;
  const hasAccess = isAdmin || subscription?.hasAccess;

  return {
    subscription: isAdmin ? { ...subscription, plan: 'pro', status: 'active', hasAccess: true } : subscription,
    isPro,
    isTrialActive,
    hasAccess,
    isLoading,
    refetch,
  };
}