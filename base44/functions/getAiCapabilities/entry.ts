import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { secrets } from 'base44:runtime';
import { describeAiCapabilities } from '../../shared/aiCapability.ts';

Deno.serve(async (req) => {
  try {
    if (req.method !== 'POST') {
      return Response.json({ error: 'Method not allowed' }, { status: 405 });
    }

    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.is_banned) return Response.json({ error: 'banned' }, { status: 403 });
    if (user.timeout_until && new Date(user.timeout_until).getTime() > Date.now()) {
      return Response.json({ error: 'timed_out', timeout_until: user.timeout_until }, { status: 403 });
    }

    const capabilities = await describeAiCapabilities({
      base44,
      user,
      readEnvironment: (name) => secrets.get(name),
    });
    return Response.json(capabilities);
  } catch (error) {
    console.error('getAiCapabilities error:', error);
    return Response.json({ error: 'Unable to load AI capabilities.' }, { status: 500 });
  }
});
