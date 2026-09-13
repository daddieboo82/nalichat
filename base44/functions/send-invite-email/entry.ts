import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { APP_BASE_URL } from '../../shared/appConfig.ts';

// Deprecated: server-funded arbitrary-recipient email invites created an open-relay
// and credit-abuse surface. Invites are now composed in the user's own mail client.
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
    if (user.is_banned) {
      return Response.json({ error: 'banned' }, { status: 403 });
    }
    if (user.timeout_until && new Date(user.timeout_until).getTime() > Date.now()) {
      return Response.json({ error: 'timed_out', timeout_until: user.timeout_until }, { status: 403 });
    }

    const appUrl = APP_BASE_URL;
    if (!appUrl) {
      return Response.json({ error: 'Server is not configured with an app URL' }, { status: 500 });
    }

    return Response.json({
      error: 'Server-sent email invites are disabled. Use the share flow instead.',
      code: 'INVITE_RELAY_DISABLED',
      invite_url: `${appUrl.replace(/\/$/, '')}/register`,
    }, { status: 410 });
  } catch (error) {
    console.error('send-invite-email error:', error);
    return Response.json({ error: 'Invite service unavailable' }, { status: 500 });
  }
});
