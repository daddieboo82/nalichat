import { createClientFromRequest } from 'npm:@base44/sdk@0.8.48';
import { secrets } from 'base44:runtime';

const EVENTS = [
  'BILLING.SUBSCRIPTION.CREATED',
  'BILLING.SUBSCRIPTION.ACTIVATED',
  'BILLING.SUBSCRIPTION.UPDATED',
  'BILLING.SUBSCRIPTION.EXPIRED',
  'BILLING.SUBSCRIPTION.CANCELLED',
  'BILLING.SUBSCRIPTION.SUSPENDED',
  'BILLING.SUBSCRIPTION.PAYMENT.FAILED',
  'PAYMENT.SALE.COMPLETED',
  'PAYMENT.SALE.REFUNDED',
  'PAYMENT.SALE.REVERSED',
];

function apiBase() {
  return (secrets.get('PAYPAL_ENVIRONMENT') || 'live').toLowerCase() === 'sandbox'
    ? 'https://api-m.sandbox.paypal.com'
    : 'https://api-m.paypal.com';
}
async function token() {
  const id = secrets.get('PAYPAL_CLIENT_ID');
  const secret = secrets.get('PAYPAL_CLIENT_SECRET');
  if (!id || !secret) throw new Error('PayPal credentials are not configured');
  const r = await fetch(apiBase() + '/v1/oauth2/token', {
    method: 'POST',
    headers: { Authorization: 'Basic ' + btoa(id + ':' + secret), 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials',
  });
  const d = await r.json();
  if (!r.ok || !d.access_token) throw new Error('PayPal authentication failed');
  return d.access_token as string;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 });
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') return Response.json({ error: 'Admin required' }, { status: 403 });
    const existing = secrets.get('PAYPAL_WEBHOOK_ID');
    const accessToken = await token();
    const appId = secrets.get('BASE44_APP_ID') || '6a1f5ee134147461560c2b37';
    const webhookUrl = secrets.get('PAYPAL_WEBHOOK_URL') ||
      `https://base44-dispatcher-production.base44.workers.dev/api/apps/${appId}/functions/paypalWebhook`;
    if (existing && !existing.startsWith('REPLACE_')) {
      const remoteResponse = await fetch(apiBase() + '/v1/notifications/webhooks/' + encodeURIComponent(existing), {
        headers: { Authorization: 'Bearer ' + accessToken, Accept: 'application/json' },
      });
      if (!remoteResponse.ok) {
        return Response.json({ success: false, verified: false, webhookId: existing, error: 'PayPal webhook could not be verified', paypalStatus: remoteResponse.status }, { status: 502 });
      }
      const remote = await remoteResponse.json();
      const subscribed = new Set((Array.isArray(remote.event_types) ? remote.event_types : []).map((item: any) => item?.name));
      // PayPal's '*' subscription covers every event type. Do not flag a
      // wildcard registration as incomplete.
      const missingEvents = EVENTS.filter((name) => !subscribed.has('*') && !subscribed.has(name));
      // The PayPal webhook schema exposes URL and event subscriptions but does not
      // define a top-level enabled flag. Do not mistake an absent field for DISABLED.
      const enabled = typeof remote.status === 'string' ? remote.status === 'ENABLED' : null;
      const urlMatches = remote.url === webhookUrl;
      const verified = enabled !== false && urlMatches && missingEvents.length === 0;
      return Response.json({
        success: verified,
        verified: verified,
        reused: true,
        webhookId: existing,
        webhookUrl: remote.url,
        expectedWebhookUrl: webhookUrl,
        urlMatches,
        enabled,
        enabledStatusSource: enabled === null ? 'not_exposed_by_paypal' : 'provider_explicit',
        deliveryVerified: false,
        missingEvents,
        message: verified ? 'PayPal webhook configuration verified' : 'PayPal webhook configuration requires correction',
      }, { status: verified ? 200 : 409 });
    }
    // Never create an untracked live webhook: this function cannot persist
    // PAYPAL_WEBHOOK_ID into the runtime secret store. A newly created webhook
    // without its ID would be impossible for the signature verifier to use.
    return Response.json({
      success: false,
      verified: false,
      error: 'PAYPAL_WEBHOOK_ID is missing. Configure the existing live PayPal webhook ID before verification.',
      expectedWebhookUrl: webhookUrl,
      requiredEvents: EVENTS,
    }, { status: 409 });
  } catch (error) {
    console.error('PayPal webhook setup failed', error);
    return Response.json({ error: error instanceof Error ? error.message : 'PayPal webhook setup failed' }, { status: 500 });
  }
});