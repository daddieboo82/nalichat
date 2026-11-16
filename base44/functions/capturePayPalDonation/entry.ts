import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { secrets } from 'base44:runtime';
import { readJsonBodyLimited, requestBodyErrorResponse } from '../../shared/requestLimits.ts';
import { consumeHourlyLimit } from '../../shared/rateLimit.ts';
import { anonymousCheckoutScope, sha256Hex } from '../../shared/checkoutHelpers.ts';

const environment = () => (secrets.get('PAYPAL_ENVIRONMENT') || 'live').toLowerCase() === 'sandbox' ? 'sandbox' : 'live';
const baseUrl = () => environment() === 'sandbox' ? 'https://api-m.sandbox.paypal.com' : 'https://api-m.paypal.com';

async function token() {
  const id = secrets.get('PAYPAL_CLIENT_ID');
  const secret = secrets.get('PAYPAL_CLIENT_SECRET');
  if (!id || !secret || id.startsWith('REPLACE_') || secret.startsWith('REPLACE_')) throw new Error('PayPal not configured');
  const res = await fetch(baseUrl() + '/v1/oauth2/token', { method: 'POST', headers: { Authorization: 'Basic ' + btoa(id + ':' + secret), 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'grant_type=client_credentials' });
  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.access_token) throw new Error('PayPal authentication unavailable');
  return json.access_token as string;
}
function captured(order: any, expected: string): { captureId: string; payerId: string } | null {
  if (order?.status !== 'COMPLETED') return null;
  const units = order?.purchase_units;
  if (!Array.isArray(units) || units.length !== 1) return null;
  const unit = units[0];
  if (unit?.amount?.currency_code !== 'USD' || unit?.amount?.value !== expected) return null;
  const captures = unit?.payments?.captures;
  if (!Array.isArray(captures) || captures.length !== 1) return null;
  const capture = captures[0];
  if (capture?.status !== 'COMPLETED' || capture?.amount?.currency_code !== 'USD' || capture?.amount?.value !== expected || !capture?.id) return null;
  return { captureId: capture.id, payerId: typeof order.payer?.payer_id === 'string' ? order.payer.payer_id : '' };
}

Deno.serve(async req => {
  try {
    if (req.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 });
    const base44 = createClientFromRequest(req);
    let user = null;
    try { user = await base44.auth.me(); } catch {}
    const rateScope = user?.id || await anonymousCheckoutScope(req, 'paypal_donation_capture_');
    const rate = await consumeHourlyLimit(base44.asServiceRole.entities, rateScope, 'paypal_donation_capture', 30);
    if (!rate.allowed) return Response.json({ error: 'Too many verification attempts.' }, { status: 429 });
    const body = await readJsonBodyLimited(req, 4096);
    const orderId = typeof body?.orderId === 'string' ? body.orderId.trim() : '';
    const verifier = typeof body?.verifier === 'string' ? body.verifier.trim() : '';
    if (!/^[A-Za-z0-9_-]{8,64}$/.test(orderId) || !/^[0-9a-f]{64}$/.test(verifier)) {
      return Response.json({ error: 'Invalid donation verification data' }, { status: 400 });
    }
    const rows = await base44.asServiceRole.entities.PayPalDonation.filter({ order_id: orderId }, '-created_date', 2);
    if (!Array.isArray(rows) || rows.length !== 1) return Response.json({ error: 'Donation order could not be verified' }, { status: 404 });
    const record = rows[0];
    if (record.environment !== environment() || record.verifier_hash !== await sha256Hex(verifier)) {
      return Response.json({ error: 'Donation verification failed' }, { status: 403 });
    }
    const accessToken = await token();
    const detailsUrl = baseUrl() + '/v2/checkout/orders/' + encodeURIComponent(orderId);
    const headers = { Authorization: 'Bearer ' + accessToken, Accept: 'application/json' };
    const beforeResponse = await fetch(detailsUrl, { headers });
    const before = await beforeResponse.json().catch(() => null);
    if (!beforeResponse.ok || before?.id !== orderId || !['APPROVED', 'COMPLETED'].includes(before?.status)) {
      return Response.json({ success: true, status: 'pending', action: 'capture_paypal_donation' });
    }
    const expected = Number(record.amount_usd).toFixed(2);
    if (before?.purchase_units?.length !== 1 ||
        before.purchase_units[0]?.amount?.currency_code !== 'USD' ||
        before.purchase_units[0]?.amount?.value !== expected) {
      return Response.json({ error: 'Donation amount could not be verified' }, { status: 409 });
    }
    if (before.status === 'APPROVED') {
      const captureKey = (await sha256Hex('capture:' + orderId)).slice(0, 36);
      const response = await fetch(detailsUrl + '/capture', {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json', 'PayPal-Request-Id': captureKey },
        body: '{}',
      });
      if (!response.ok && response.status !== 422) {
        console.error('PayPal donation capture unavailable', { status: response.status });
        return Response.json({ success: true, status: 'pending', action: 'capture_paypal_donation' });
      }
    }
    // The capture HTTP status is not proof of payment. Only a fresh provider
    // order with matching completed capture amount authorizes paid status.
    const finalResponse = await fetch(detailsUrl, { headers });
    const finalOrder = await finalResponse.json().catch(() => null);
    if (!finalResponse.ok || finalOrder?.id !== orderId) {
      return Response.json({ success: true, status: 'pending', action: 'capture_paypal_donation' });
    }
    const proof = captured(finalOrder, expected);
    if (!proof) return Response.json({ success: true, status: 'pending', action: 'capture_paypal_donation' });
    if (record.status !== 'paid') {
      await base44.asServiceRole.entities.PayPalDonation.update(record.id, {
        status: 'paid',
        paid_at: new Date().toISOString(),
        capture_id: proof.captureId,
        payer_id: proof.payerId,
      });
    }
    return Response.json({ success: true, action: 'capture_paypal_donation', status: 'paid', amount: Number(record.amount_usd) }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const bodyError = requestBodyErrorResponse(error);
    if (bodyError) return bodyError;
    console.error('PayPal donation verification unavailable');
    return Response.json({ error: 'Unable to verify PayPal donation; do not send another donation until billing is reviewed.' }, { status: 503 });
  }
});
