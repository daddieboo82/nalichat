import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';

export function useSubscription() {
  const { user, isAuthenticated } = useAuth();
  const { data: subscription = { plan: 'free', status: 'active' }, isLoading: queryLoading, refetch } = useQuery({
    queryKey: ['subscription'],
    enabled: !!isAuthenticated,
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

  // When the query is disabled (not authenticated), it stays in a "pending" state
  // forever — never treat that as loading or the app will hang on a blank screen.
  const isLoading = isAuthenticated ? queryLoading : false;

  const isAdmin = user?.role === 'admin';
  const isPro = isAdmin || ((subscription?.plan === 'pro' || subscription?.plan === 'pro_filesharing') && subscription?.status === 'active');
  const isProFilesharing = isAdmin || (subscription?.plan === 'pro_filesharing' && subscription?.status === 'active');
  const isTrialActive = subscription?.trialActive;
  const hasAccess = isAdmin || subscription?.hasAccess;

  return {
    subscription: isAdmin ? { ...subscription, plan: 'pro_filesharing', status: 'active', hasAccess: true } : subscription,
    isPro,
    isProFilesharing,
    isTrialActive,
    hasAccess,
    isLoading,
    refetch,
  };
}