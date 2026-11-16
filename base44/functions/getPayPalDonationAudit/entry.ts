import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { secrets } from 'base44:runtime';
import { readJsonBodyLimited, requestBodyErrorResponse } from '../../shared/requestLimits.ts';
import { consumeHourlyLimit } from '../../shared/rateLimit.ts';

const PAGE_SIZE = 25;
const environment = () => (secrets.get('PAYPAL_ENVIRONMENT') || 'live').toLowerCase() === 'sandbox' ? 'sandbox' : 'live';
const baseUrl = () => environment() === 'sandbox' ? 'https://api-m.sandbox.paypal.com' : 'https://api-m.paypal.com';

async function accessToken(): Promise<string> {
  const id = secrets.get('PAYPAL_CLIENT_ID');
  const secret = secrets.get('PAYPAL_CLIENT_SECRET');
  if (!id || !secret || id.startsWith('REPLACE_') || secret.startsWith('REPLACE_')) throw new Error('PayPal credentials not configured');
  const response = await fetch(baseUrl() + '/v1/oauth2/token', {
    method: 'POST',
    headers: { Authorization: 'Basic ' + btoa(id + ':' + secret), 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials',
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || !data?.access_token) throw new Error('PayPal authentication unsuccessful');
  return data.access_token as string;
}

// Read-only configuration check: a valid REST token alone does not establish
// that the registered webhook will deliver one-time donation approvals.
async function checkDonationWebhook(accessToken: string | null) {
  const webhookId = String(secrets.get('PAYPAL_WEBHOOK_ID') || '').trim();
  if (!accessToken) return { status: 'provider_unavailable', approvalEventSubscribed: false, urlMatches: false };
  if (!webhookId || webhookId.startsWith('REPLACE_')) {
    return { status: 'webhook_id_missing', approvalEventSubscribed: false, urlMatches: false };
  }
  const appId = secrets.get('BASE44_APP_ID') || '6a1f5ee134147461560c2b37';
  const expectedUrl = secrets.get('PAYPAL_WEBHOOK_URL') ||
    'https://base44-dispatcher-production.base44.workers.dev/api/apps/' + appId + '/functions/paypalWebhook';
  try {
    const response = await fetch(baseUrl() + '/v1/notifications/webhooks/' + encodeURIComponent(webhookId), {
      headers: { Authorization: 'Bearer ' + accessToken, Accept: 'application/json' },
    });
    if (!response.ok) return { status: 'webhook_lookup_unavailable', approvalEventSubscribed: false, urlMatches: false };
    const remote = await response.json().catch(() => null);
    const subscribed = new Set((Array.isArray(remote?.event_types) ? remote.event_types : []).map((event: any) => event?.name));
    const approvalEventSubscribed = subscribed.has('*') || subscribed.has('CHECKOUT.ORDER.APPROVED');
    const urlMatches = remote?.url === expectedUrl;
    const explicitlyDisabled = typeof remote?.status === 'string' && remote.status !== 'ENABLED';
    return {
      status: !urlMatches ? 'webhook_url_mismatch'
        : explicitlyDisabled ? 'webhook_disabled'
        : !approvalEventSubscribed ? 'approval_event_missing'
        : 'configured_not_delivery_verified',
      approvalEventSubscribed,
      urlMatches,
    };
  } catch {
    return { status: 'webhook_lookup_unavailable', approvalEventSubscribed: false, urlMatches: false };
  }
}

function remoteStatus(order: any, amountUsd: number) {
  const expected = Number(amountUsd).toFixed(2);
  if (!order || order?.purchase_units?.length !== 1) return 'review_required';
  const unit = order.purchase_units[0];
  if (unit?.amount?.currency_code !== 'USD' || unit?.amount?.value !== expected) return 'review_required';
  if (order.status !== 'COMPLETED') return order.status === 'APPROVED' ? 'approved_not_captured' : 'not_completed';
  const captures = unit?.payments?.captures;
  if (!Array.isArray(captures) || captures.length !== 1) return 'review_required';
  const capture = captures[0];
  return capture?.status === 'COMPLETED'
    && capture?.amount?.currency_code === 'USD'
    && capture?.amount?.value === expected
    && typeof capture?.id === 'string'
    ? 'provider_paid' : 'review_required';
}

Deno.serve(async (req) => {
  try {
    if (req.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 });
    const base44 = createClientFromRequest(req);
    const admin = await base44.auth.me();
    if (!admin?.id || admin.role !== 'admin' || admin.is_banned ||
      (admin.timeout_until && Date.parse(admin.timeout_until) > Date.now())) {
      return Response.json({ error: 'Administrator authorization required' }, { status: 403 });
    }
    const limit = await consumeHourlyLimit(base44.asServiceRole.entities, admin.id, 'paypal_donation_audit', 20);
    if (!limit.allowed) return Response.json({ error: 'Donation audits are temporarily rate limited' }, { status: 429 });
    const body = await readJsonBodyLimited(req, 2048);
    const page = Number(body?.page ?? 0);
    if (!Number.isInteger(page) || page < 0 || page > 100) {
      return Response.json({ error: 'Invalid audit page' }, { status: 400 });
    }
    const rows = await base44.asServiceRole.entities.PayPalDonation.filter({}, '-created_date', PAGE_SIZE + 1, page * PAGE_SIZE);
    if (!Array.isArray(rows)) throw new Error('Donation lookup unavailable');
    const pageRows = rows.slice(0, PAGE_SIZE);
    let providerCheck = 'not_needed';
    let token: string | null = null;
    if (pageRows.length) {
      try { token = await accessToken(); providerCheck = 'authenticated'; }
      catch { providerCheck = 'unavailable'; }
    } else {
      // Allows credential health to be checked even before the first donation,
      // without creating or capturing a PayPal order.
      try { await accessToken(); providerCheck = 'authenticated'; }
      catch { providerCheck = 'unavailable'; }
    }
    const webhook = await checkDonationWebhook(token);
    const records = [];
    for (const record of pageRows) {
      let status = 'provider_unavailable';
      if (token && record.environment === environment() && typeof record.order_id === 'string') {
        try {
          const response = await fetch(baseUrl() + '/v2/checkout/orders/' + encodeURIComponent(record.order_id), {
            headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' },
          });
          if (response.ok) {
            const remote = await response.json();
            status = remote?.id === record.order_id ? remoteStatus(remote, Number(record.amount_usd)) : 'review_required';
          } else {
            status = response.status === 404 ? 'order_not_found' : 'provider_unavailable';
          }
        } catch {
          status = 'provider_unavailable';
        }
      } else if (record.environment !== environment()) {
        status = 'environment_mismatch';
      }
      records.push({
        orderId: record.order_id,
        amountUsd: Number(record.amount_usd),
        localStatus: record.status === 'paid' ? 'paid' : record.status === 'failed' ? 'failed' : 'pending',
        providerStatus: status,
        createdAt: record.created_at || record.created_date || null,
        // An approved order that has not been captured is an unresolved
        // donation, even though both sides are technically not yet paid.
        // Never report missing provider evidence as a healthy match.
        needsReview: status === 'approved_not_captured'
          || status === 'review_required'
          || status === 'provider_unavailable'
          || status === 'order_not_found'
          || status === 'environment_mismatch'
          || (record.status === 'paid') !== (status === 'provider_paid'),
      });
    }
    return Response.json({
      success: true,
      action: 'paypal_donation_audit',
      adminUserId: admin.id,
      environment: environment(),
      providerCheck,
      webhook,
      page,
      hasMore: rows.length > PAGE_SIZE,
      records,
      readOnly: true,
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const bodyError = requestBodyErrorResponse(error);
    if (bodyError) return bodyError;
    console.error('PayPal donation audit unavailable');
    return Response.json({ error: 'Unable to audit PayPal donations.' }, { status: 500 });
  }
});
