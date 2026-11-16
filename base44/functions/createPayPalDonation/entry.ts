import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { secrets } from 'base44:runtime';
import { readJsonBodyLimited, requestBodyErrorResponse } from '../../shared/requestLimits.ts';
import { consumeHourlyLimit } from '../../shared/rateLimit.ts';
import { anonymousCheckoutScope, randomVerifier, sha256Hex } from '../../shared/checkoutHelpers.ts';
import { APP_BASE_URL } from '../../shared/appConfig.ts';

const PRESETS = new Set([5, 10, 25, 50]);
const environment = () => (secrets.get('PAYPAL_ENVIRONMENT') || 'live').toLowerCase() === 'sandbox' ? 'sandbox' : 'live';
const baseUrl = () => environment() === 'sandbox' ? 'https://api-m.sandbox.paypal.com' : 'https://api-m.paypal.com';

async function token() {
  const id = secrets.get('PAYPAL_CLIENT_ID');
  const secret = secrets.get('PAYPAL_CLIENT_SECRET');
  if (!id || !secret || id.startsWith('REPLACE_') || secret.startsWith('REPLACE_')) throw new Error('PayPal is not configured');
  const res = await fetch(baseUrl() + '/v1/oauth2/token', { method: 'POST', headers: { Authorization: 'Basic ' + btoa(id + ':' + secret), 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'grant_type=client_credentials' });
  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.access_token) throw new Error('PayPal authentication unavailable');
  return json.access_token as string;
}

Deno.serve(async req => {
  try {
    if (req.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 });
    const base44 = createClientFromRequest(req);
    let user = null;
    try { user = await base44.auth.me(); } catch {}
    const scope = user?.id || await anonymousCheckoutScope(req, 'paypal_donation_');
    const rate = await consumeHourlyLimit(base44.asServiceRole.entities, scope, 'paypal_donation_create', user?.id ? 20 : 8);
    if (!rate.allowed) return Response.json({ error: 'Too many donation attempts. Try again later.' }, { status: 429 });
    const body = await readJsonBodyLimited(req, 4096);
    const amount = Number(body?.amount);
    if (!PRESETS.has(amount)) return Response.json({ error: 'Invalid donation amount' }, { status: 400 });
    const accessToken = await token();
    const verifier = randomVerifier();
    const success = new URL(APP_BASE_URL + '/');
    success.searchParams.set('paypal_donation', '1');
    success.searchParams.set('donation_verifier', verifier);
    const cancel = new URL(APP_BASE_URL + '/');
    cancel.searchParams.set('paypal_donation_cancel', '1');
    const amountText = amount.toFixed(2);
    const res = await fetch(baseUrl() + '/v2/checkout/orders', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + accessToken, 'Content-Type': 'application/json', 'PayPal-Request-Id': verifier.slice(0, 36) },
      body: JSON.stringify({
        intent: 'CAPTURE',
        purchase_units: [{ description: 'One-time donation to NaliBase', amount: { currency_code: 'USD', value: amountText } }],
        application_context: { return_url: success.toString(), cancel_url: cancel.toString(), user_action: 'PAY_NOW' },
      }),
    });
    const order = await res.json().catch(() => null);
    const expectedHost = environment() === 'sandbox' ? 'www.sandbox.paypal.com' : 'www.paypal.com';
    let approval;
    try { approval = new URL(order?.links?.find((item: any) => item.rel === 'approve')?.href); } catch {}
    if (!res.ok || !/^\w[\w-]{8,64}$/.test(String(order?.id || '')) || approval?.hostname !== expectedHost || approval?.protocol !== 'https:') {
      console.error('PayPal donation order creation unavailable', { status: res.status });
      return Response.json({ error: 'PayPal donation checkout is unavailable. Please try again later.' }, { status: 503 });
    }
    try {
      await base44.asServiceRole.entities.PayPalDonation.create({
        order_id: order.id,
        verifier_hash: await sha256Hex(verifier),
        amount_usd: amount,
        status: 'pending',
        environment: environment(),
        created_at: new Date().toISOString(),
      });
    } catch (error) {
      // An uncaptured PayPal order is not a charge. Do not redirect without a durable record.
      console.error('PayPal donation order persistence failed');
      return Response.json({ error: 'Could not save your donation checkout. No payment was captured.' }, { status: 503 });
    }
    return Response.json({ success: true, action: 'create_paypal_donation', orderId: order.id, checkoutUrl: approval.toString() }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const bodyError = requestBodyErrorResponse(error);
    if (bodyError) return bodyError;
    console.error('PayPal donation creation failed');
    return Response.json({ error: 'PayPal donation checkout is temporarily unavailable.' }, { status: 503 });
  }
});
