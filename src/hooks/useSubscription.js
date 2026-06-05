import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';

const ADMIN_EMAILS = ['bossglop43@gmail.com'];

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

  const isAdmin = user?.role === 'admin' || ADMIN_EMAILS.includes(user?.email);
  const isPro = isAdmin || ((subscription?.plan === 'pro' || subscription?.plan === 'pro_filesharing') && subscription?.status === 'active');
  const isProFilesharing = isAdmin || (subscription?.plan === 'pro_filesharing' && subscription?.status === 'active');
  const isTrialActive = subscription?.trialActive;
  const hasAccess = isAdmin || subscription?.hasAccess;

  return {
    subscription: isAdmin ? { ...subscription, plan: 'pro', status: 'active', hasAccess: true } : subscription,
    isPro,
    isProFilesharing,
    isTrialActive,
    hasAccess,
    isLoading,
    refetch,
  };
}