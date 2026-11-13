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
    const appId = secrets.get('BASE44_APP_ID') || '6a1f5ee134147461560c2b37';
    const webhookUrl = secrets.get('PAYPAL_WEBHOOK_URL') ||
      `https://base44-dispatcher-production.base44.workers.dev/api/apps/${appId}/functions/paypalWebhook`;
    const accessToken = await token();

    // Existing webhook IDs are only meaningful if PayPal registered the
    // correct destination. Read details without creating or updating a webhook.
    if (existing && !existing.startsWith('REPLACE_')) {
      const inspect = await fetch(
        apiBase() + '/v1/notifications/webhooks/' + encodeURIComponent(existing),
        { headers: { Authorization: 'Bearer ' + accessToken, Accept: 'application/json' } },
      );
      if (!inspect.ok) {
        console.error('Unable to inspect registered PayPal webhook', inspect.status);
        return Response.json({ error: 'Unable to verify existing PayPal webhook registration' }, { status: 502 });
      }
      const registration = await inspect.json();
      const eventTypes = Array.isArray(registration?.event_types)
        ? registration.event_types.map((event: any) => event?.name).filter((name: any) => typeof name === 'string')
        : [];
      const destinationMatches = registration?.url === webhookUrl;
      const missingEvents = EVENTS.filter((event) => !eventTypes.includes(event));
      const registrationVerified = destinationMatches && missingEvents.length === 0;
      return Response.json({
        success: registrationVerified,
        reused: true,
        registrationVerified,
        webhookId: existing,
        webhookUrl: registration?.url || null,
        expectedWebhookUrl: webhookUrl,
        destinationMatches,
        missingEvents,
        ...(!registrationVerified ? { error: 'PayPal webhook registration does not match NaliChat configuration' } : {}),
      }, { status: registrationVerified ? 200 : 409 });
    }
    const r = await fetch(apiBase() + '/v1/notifications/webhooks', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + accessToken, 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: webhookUrl, event_types: EVENTS.map((name) => ({ name })) }),
    });
    const data = await r.json();
    if (!r.ok || !data.id) {
      console.error('PayPal webhook registration failed', data);
      return Response.json({ error: 'Unable to register PayPal webhook', details: data }, { status: 502 });
    }
    return Response.json({ success: true, webhookId: data.id, webhookUrl, eventTypes: EVENTS });
  } catch (error) {
    console.error('PayPal webhook setup failed', error);
    return Response.json({ error: error instanceof Error ? error.message : 'PayPal webhook setup failed' }, { status: 500 });
  }
});