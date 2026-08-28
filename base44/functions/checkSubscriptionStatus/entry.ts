import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // The app is completely free — all users have full access.
    // Monetization is through per-item sales (tracks, files), not subscriptions.
    return Response.json({
      plan: 'free',
      status: 'active',
      trialActive: false,
      hasAccess: true,
      hasPending: false,
    });
  } catch (error) {
    console.error('Check subscription error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});