// A transient subscription refresh must not change conversation identity.
// The retained tier is scoped to one user and never authorizes an AI request.
export function resolveNaliAgentTier({ userId, canUseBestModel, subscriptionLoading, subscriptionError, previous }) {
  const requested = canUseBestModel ? 'studio_ai_plus' : 'studio_ai';
  if (!userId) return { userId: null, agentName: 'studio_ai' };
  if (previous?.userId === userId && (subscriptionLoading || subscriptionError)) return previous;
  return { userId, agentName: requested };
}
