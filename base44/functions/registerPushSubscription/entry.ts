import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { consumeHourlyLimit } from '../../shared/rateLimit.ts';

function isSafePushEndpoint(value: string) {
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== 'https:') return false;
    const hostname = parsed.hostname.toLowerCase();
    if (
      hostname === 'localhost' ||
      hostname === 'metadata.google.internal' ||
      hostname.endsWith('.internal') ||
      hostname.endsWith('.local') ||
      /^(10\.|127\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|0\.)/.test(hostname)
    ) return false;
    return true;
  } catch {
    return false;
  }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const writeRate = await consumeHourlyLimit(
      base44.asServiceRole.entities,
      user.id,
      'push_register',
      120,
    );
    if (!writeRate.allowed) {
      return Response.json({ error: 'Rate limit exceeded. Please try again later.' }, { status: 429 });
    }

    const body = await req.json();
    const endpoint = String(body?.endpoint || '');
    const p256dh = String(body?.keys?.p256dh || '');
    const auth = String(body?.keys?.auth || '');

    if (!endpoint || !p256dh || !auth || !isSafePushEndpoint(endpoint)) {
      return Response.json({ error: 'Invalid push subscription' }, { status: 400 });
    }

    const entity = base44.asServiceRole.entities.PushSubscription;
    const endpointRows = await entity.filter({ endpoint });

    // A browser PushManager subscription is device/browser scoped rather than
    // account scoped. Reusing the same subscription after sign-out must transfer
    // it to the newly authenticated account instead of delivering both users'
    // notifications to the same browser. Require the browser keys to match so a
    // caller cannot steal an endpoint by knowing its URL alone.
    for (const row of endpointRows) {
      if (row.user_id === user.id) continue;
      if (row.p256dh !== p256dh || row.auth !== auth) {
        return Response.json({ error: 'Push endpoint is already registered to another account' }, { status: 409 });
      }
      await entity.delete(row.id);
    }

    const existing = endpointRows.filter((row: any) => row.user_id === user.id);
    const data = {
      user_id: user.id,
      endpoint,
      p256dh,
      auth,
      user_agent: String(body?.userAgent || '').slice(0, 500),
      last_seen_at: new Date().toISOString(),
    };

    if (existing.length > 0) {
      await entity.update(existing[0].id, data);
    } else {
      await entity.create(data);
    }

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error?.message || 'Could not register push subscription' }, { status: 500 });
  }
});
