import { readJsonBodyLimited, requestBodyErrorResponse } from '../../shared/requestLimits.ts';
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { consumeHourlyLimit } from '../../shared/rateLimit.ts';

async function pushSubscriptionId(endpoint: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(endpoint));
  const hex = Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
  return `push_${hex}`;
}

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
    if (req.method !== 'POST') {
      return Response.json({ error: 'Method not allowed' }, { status: 405 });
    }

    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.is_banned) return Response.json({ error: 'banned' }, { status: 403 });
    if (user.timeout_until && new Date(user.timeout_until).getTime() > Date.now()) {
      return Response.json({ error: 'timed_out', timeout_until: user.timeout_until }, { status: 403 });
    }

    const writeRate = await consumeHourlyLimit(
      base44.asServiceRole.entities,
      user.id,
      'push_register',
      120,
    );
    if (!writeRate.allowed) {
      return Response.json({ error: 'Rate limit exceeded. Please try again later.' }, { status: 429 });
    }

    const body = await readJsonBodyLimited(req, 16 * 1024);
    if (
      typeof body?.endpoint !== 'string'
      || typeof body?.keys?.p256dh !== 'string'
      || typeof body?.keys?.auth !== 'string'
    ) {
      return Response.json({ error: 'Invalid push subscription' }, { status: 400 });
    }
    const endpoint = body.endpoint.trim();
    const p256dh = body.keys.p256dh.trim();
    const auth = body.keys.auth.trim();

    if (
      !endpoint || endpoint.length > 2048
      || !p256dh || p256dh.length > 512
      || !auth || auth.length > 512
      || !isSafePushEndpoint(endpoint)
    ) {
      return Response.json({ error: 'Invalid push subscription' }, { status: 400 });
    }

    const entity = base44.asServiceRole.entities.PushSubscription;
    const deterministicId = await pushSubscriptionId(endpoint);
    const endpointRows: any[] = [];
    const pageSize = 200;
    for (let skip = 0; ; skip += pageSize) {
      const page = await entity.filter({ endpoint }, '-created_date', pageSize, skip);
      endpointRows.push(...page);
      if (page.length < pageSize) break;
    }

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

    const data = {
      user_id: user.id,
      endpoint,
      p256dh,
      auth,
      user_agent: typeof body?.userAgent === 'string' ? body.userAgent.slice(0, 500) : '',
      last_seen_at: new Date().toISOString(),
    };

    const deterministic = await entity.get(deterministicId).catch(() => null);
    if (deterministic) {
      if (
        deterministic.user_id !== user.id
        && (deterministic.p256dh !== p256dh || deterministic.auth !== auth)
      ) {
        return Response.json({ error: 'Push endpoint is already registered to another account' }, { status: 409 });
      }
      await entity.update(deterministicId, data);
    } else {
      try {
        await entity.create({ id: deterministicId, ...data });
      } catch (createError) {
        const raced = await entity.get(deterministicId).catch(() => null);
        if (!raced) throw createError;
        if (raced.p256dh !== p256dh || raced.auth !== auth) {
          return Response.json({ error: 'Push endpoint is already registered to another account' }, { status: 409 });
        }
        await entity.update(deterministicId, data);
      }
    }

    // Remove legacy/random-ID duplicates after the deterministic record is safe.
    let cleanupFailures = 0;
    for (const row of endpointRows) {
      if (row.id === deterministicId) continue;
      try {
        await entity.delete(row.id);
      } catch (cleanupError) {
        cleanupFailures += 1;
        console.error('Failed to remove duplicate push subscription', {
          userId: user.id,
          subscriptionId: row.id,
          endpoint,
          cleanupError: cleanupError instanceof Error ? cleanupError.message : String(cleanupError),
        });
      }
    }

    return Response.json({ success: true, action: 'register_push', userId: user.id, endpoint, cleanup_failures: cleanupFailures });
  } catch (error) {
    const bodyError = requestBodyErrorResponse(error);
    if (bodyError) return bodyError;
    return Response.json({ error: 'Could not register push subscription' }, { status: 500 });
  }
});
