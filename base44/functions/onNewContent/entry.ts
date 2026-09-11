import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Legacy workflow compatibility. Dedicated entity workflows now own all
// notifications; this handler intentionally performs no service-role writes
// so duplicate legacy workflows cannot create duplicate/spoofed notifications.
Deno.serve(async (req) => {
  try {
    createClientFromRequest(req);
    return Response.json({ ok: true, legacy_noop: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
