import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';


// Legacy workflow compatibility. Dedicated entity workflows now own all
// notifications; this handler intentionally performs no service-role writes
// so duplicate legacy workflows cannot create duplicate/spoofed notifications.
Deno.serve(async (req) => {
  try {
    if (req.method !== 'POST') {
      return Response.json({ error: 'Method not allowed' }, { status: 405 });
    }
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return Response.json({ ok: true, legacy_noop: true });
  } catch (error) {
    console.error('onNewContent error:', error);
    return Response.json({ error: 'Unable to process content notification' }, { status: 500 });
  }
});
