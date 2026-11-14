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

    // Do not use a different app's ID as a fallback or trust a webhook
    // destination supplied without independently configured app identity.
    const configuredAppId = String(secrets.get('BASE44_APP_ID') || '').trim();
    if (!/^[a-f0-9]{24}$/i.test(configuredAppId)) {
      return Response.json({
        error: 'Set the current BASE44_APP_ID before registering a PayPal webhook',
      }, { status: 503 });
    }
    const configuredWebhookUrl = String(secrets.get('PAYPAL_WEBHOOK_URL') || '').trim();
    const webhookUrl = configuredWebhookUrl ||
      `https://base44-dispatcher-production.base44.workers.dev/api/apps/${configuredAppId}/functions/paypalWebhook`;
    let parsedWebhookUrl: URL;
    try { parsedWebhookUrl = new URL(webhookUrl); } catch {
      return Response.json({ error: 'Invalid webhook URL configuration' }, { status: 503 });
    }
    if (parsedWebhookUrl.protocol !== 'https:' || parsedWebhookUrl.username
      || parsedWebhookUrl.password || parsedWebhookUrl.search || parsedWebhookUrl.hash
      || parsedWebhookUrl.hostname !== 'base44-dispatcher-production.base44.workers.dev'
      || parsedWebhookUrl.pathname !==
        `/api/apps/${configuredAppId}/functions/paypalWebhook`) {
      return Response.json({ error: 'Webhook URL does not match the configured Base44 app' }, { status: 503 });
    }
    // No stored webhook ID means there is nothing to verify. Fail before
    // requesting a provider OAuth token; creation is disabled below.
    if (!existing || existing.startsWith('REPLACE_')) {
      return Response.json({
        error: 'PayPal webhook registration requires controlled provisioning and persisted webhook ID',
      }, { status: 503 });
    }
    const accessToken = await token();
    if (existing && !existing.startsWith('REPLACE_')) {
      // An ID in the secret store is not proof that PayPal registered it
      // for this app or subscribed it to the necessary lifecycle events.
      const lookup = await fetch(
        apiBase() + '/v1/notifications/webhooks/' + encodeURIComponent(existing),
        { headers: { Authorization: 'Bearer ' + accessToken, Accept: 'application/json' } },
      );
      if (!lookup.ok) {
        return Response.json({ error: 'Unable to verify existing PayPal webhook' }, { status: 503 });
      }
      const remote = await lookup.json();
      const remoteEvents = Array.isArray(remote?.event_types)
        ? new Set(remote.event_types.map((event: any) => event?.name))
        : new Set();
      if (remote?.id !== existing || remote?.url !== webhookUrl
        || !EVENTS.every((eventName) => remoteEvents.has(eventName))) {
        return Response.json({
          error: 'Existing PayPal webhook destination or event types do not match this app',
        }, { status: 409 });
      }
      return Response.json({
        success: true, reused: true, verified: true,
        webhookId: existing, webhookUrl, eventTypes: EVENTS,
      });
    }
    // This runtime has no verified atomic way to persist PAYPAL_WEBHOOK_ID.
    // Creating a remote webhook here would leave an untracked registration,
    // and retrying this endpoint could create duplicates.
    return Response.json({
      error: 'PayPal webhook registration requires controlled provisioning and persisted webhook ID',
    }, { status: 503 });
  } catch (error) {
    console.error('PayPal webhook setup failed', error);
    return Response.json({ error: error instanceof Error ? error.message : 'PayPal webhook setup failed' }, { status: 500 });
  }
});