import { publicPushConfig } from '../../shared/webPush.ts';

// Intentionally public: the browser needs the VAPID public key before push
// registration. Keep this endpoint read-only and method constrained.
Deno.serve((req) => {
  if (req.method !== 'GET') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }
  return Response.json({
    success: true,
    action: 'get_push_config',
    ...publicPushConfig(),
  }, {
    headers: { 'Cache-Control': 'public, max-age=300' },
  });
});
