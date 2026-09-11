import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { describeAiCapabilities } from '../../shared/aiCapability.ts';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const capabilities = await describeAiCapabilities({
      base44,
      user,
      readEnvironment: (name) => Deno.env.get(name),
    });
    return Response.json(capabilities);
  } catch (error) {
    console.error('getAiCapabilities error:', error);
    return Response.json({ error: 'Unable to load AI capabilities.' }, { status: 500 });
  }
});
