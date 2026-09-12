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
