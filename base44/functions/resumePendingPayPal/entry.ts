import { createClientFromRequest } from 'npm:@base44/sdk@0.8.48';
import { secrets } from 'base44:runtime';

// Continue an existing provider approval ONLY. This function never creates,
// activates, bills, cancels or mutates a subscription.
const CATALOG: Record<string, string> = {
  premium_monthly: 'PAYPAL_PREMIUM_MONTHLY_PLAN_ID',
  premium_yearly: 'PAYPAL_PREMIUM_YEARLY_PLAN_ID',
  premium_plus_monthly: 'PAYPAL_PREMIUM_PLUS_MONTHLY_PLAN_ID',
  premium_plus_yearly: 'PAYPAL_PREMIUM_PLUS_YEARLY_PLAN_ID',
};

function paypalEnvironment(): 'live' | 'sandbox' {
  const value = String(secrets.get('PAYPAL_ENVIRONMENT') || '').trim().toLowerCase();
  if (value !== 'live' && value !== 'sandbox') throw new Error('PayPal environment is not configured');
  return value;
}

function apiBase(environment: 'live' | 'sandbox') {
  return environment === 'sandbox' ? 'https://api-m.sandbox.paypal.com' : 'https://api-m.paypal.com';
}

async function accessToken(environment: 'live' | 'sandbox') {
  const id = secrets.get('PAYPAL_CLIENT_ID');
  const secret = secrets.get('PAYPAL_CLIENT_SECRET');
  if (!id || !secret) throw new Error('PayPal credentials are not configured');
  const response = await fetch(apiBase(environment) + '/v1/oauth2/token', {
    method: 'POST',
    headers: {
      Authorization: 'Basic ' + btoa(id + ':' + secret),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });
  if (!response.ok) throw new Error('PayPal authentication failed');
  const payload = await response.json();
  if (!payload?.access_token) throw new Error('PayPal authentication failed');
  return String(payload.access_token);
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 });
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user?.id || user?.is_banned || (user?.timeout_until && Date.parse(user.timeout_until) > Date.now())) {
      return Response.json({ error: 'Sign in to continue PayPal approval' }, { status: 401 });
    }
    const entities = base44.asServiceRole.entities;
    const subscriptions = await entities.Subscription.filter({ user_id: user.id }, '-created_date', 101);
    if (subscriptions.length > 100) {
      return Response.json({ error: 'Subscription history needs manual review before continuing approval' }, { status: 409 });
    }
    // Do not resume a checkout when another subscription may already grant
    // access. The caller can inspect or manage it in Settings instead.
    if (subscriptions.some((row: any) => row.status === 'active' && row.plan !== 'free')) {
      return Response.json({ error: 'A paid subscription already exists. Review billing in Settings.' }, { status: 409 });
    }
    const pending = subscriptions.filter((row: any) => row.provider === 'paypal' && row.status === 'pending');
    if (pending.length === 0) return Response.json({ error: 'No existing PayPal approval to continue' }, { status: 404 });
    // Never create new agreements here. For accounts with multiple old
    // pending records, inspect every one before offering a single resume.
    // Any provider error or ambiguous identity blocks the redirect.
    const environment = paypalEnvironment();
    const token = await accessToken(environment);
    const resumable: Array<{ record: any; approval: URL }> = [];
    for (const record of pending) {
      const planSecret = CATALOG[record.sku];
      const planId = planSecret ? secrets.get(planSecret) : null;
      if (!planId || !record.subscription_id || record.paypal_plan_id !== planId
        || record.paypal_environment !== environment) {
        return Response.json({ error: 'Existing PayPal agreements need account review' }, { status: 409 });
      }
      const response = await fetch(apiBase(environment) + '/v1/billing/subscriptions/' + encodeURIComponent(record.subscription_id), {
        headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' },
      });
      if (!response.ok) {
        // A 404 under this merchant does not prove the agreement was never
        // billed under another merchant. Give the buyer an actionable status
        // without silently deleting or restarting a recurring subscription.
        if (response.status === 404) {
          return Response.json({
            error: 'Your earlier PayPal agreement cannot be found in the current billing account. Contact NaliChat support for billing reconciliation before starting another subscription.',
            code: 'PAYPAL_AGREEMENT_RECONCILIATION_REQUIRED',
          }, { status: 409 });
        }
        return Response.json({ error: 'Unable to verify all existing PayPal agreements' }, { status: 503 });
      }
      const remote = await response.json();
      if (remote?.id !== record.subscription_id || remote?.plan_id !== planId
        || remote?.custom_id !== user.id + ':' + record.sku) {
        return Response.json({ error: 'PayPal agreement identity mismatch' }, { status: 409 });
      }
      if (remote.status === 'ACTIVE' || remote.status === 'APPROVED') {
        return Response.json({ error: 'A PayPal agreement may already be approved. Review billing in Settings.' }, { status: 409 });
      }
      if (remote.status === 'CANCELLED' || remote.status === 'EXPIRED' || remote.status === 'SUSPENDED') {
        continue;
      }
      if (remote.status !== 'APPROVAL_PENDING') {
        return Response.json({ error: 'PayPal agreement state requires review' }, { status: 409 });
      }
      // Only use the freshly fetched provider approval URL, never a stored one.
      const approval = Array.isArray(remote.links)
        ? remote.links.find((link: any) => link.rel === 'approve')?.href : null;
      let url: URL;
      try { url = new URL(approval); } catch {
        return Response.json({ error: 'PayPal approval link is unavailable' }, { status: 503 });
      }
      const host = environment === 'sandbox' ? 'www.sandbox.paypal.com' : 'www.paypal.com';
      if (url.protocol !== 'https:' || url.hostname !== host) {
        return Response.json({ error: 'PayPal approval link failed validation' }, { status: 503 });
      }
      resumable.push({ record, approval: url });
    }
    if (resumable.length !== 1) {
      return Response.json({
        error: resumable.length ? 'Multiple open PayPal approvals need review before continuing'
          : 'No open PayPal approval remains. Check billing in Settings.',
      }, { status: 409 });
    }
    const selected = resumable[0];
    return Response.json({
      success: true, action: 'resume_pending_paypal', userId: user.id,
      subscriptionId: selected.record.subscription_id, sku: selected.record.sku,
      checkoutUrl: selected.approval.toString(),
    });
  } catch (error) {
    console.error('Cannot resume existing PayPal approval', error);
    return Response.json({ error: 'Unable to resume existing PayPal approval' }, { status: 500 });
  }
});
