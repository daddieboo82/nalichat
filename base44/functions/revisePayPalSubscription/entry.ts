import { createClientFromRequest } from 'npm:@base44/sdk@0.8.48';
import { secrets } from 'base44:runtime';
import { APP_BASE_URL } from '../../shared/appConfig.ts';

const TARGETS: Record<string, string> = {
  premium_plus_monthly: 'PAYPAL_PREMIUM_PLUS_MONTHLY_PLAN_ID',
  premium_plus_yearly: 'PAYPAL_PREMIUM_PLUS_YEARLY_PLAN_ID',
};
const environment = () => (secrets.get('PAYPAL_ENVIRONMENT') || 'live').toLowerCase();
const apiBase = () => environment() === 'sandbox' ? 'https://api-m.sandbox.paypal.com' : 'https://api-m.paypal.com';
Deno.serve(async (req) => {
  if (req.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 });
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user?.id) return Response.json({ error: 'Sign in required' }, { status: 401 });
    const { sku } = await req.json();
    if (!Object.hasOwn(TARGETS, sku)) return Response.json({ error: 'Unsupported upgrade target' }, { status: 400 });
    const targetPlanId = secrets.get(TARGETS[sku]);
    const clientId = secrets.get('PAYPAL_CLIENT_ID');
    const clientSecret = secrets.get('PAYPAL_CLIENT_SECRET');
    if (!targetPlanId || !clientId || !clientSecret) return Response.json({ error: 'PayPal billing configuration unavailable' }, { status: 503 });
    const rows = await base44.asServiceRole.entities.Subscription.filter({ user_id: user.id }, '-created_date', 100);
    if (!Array.isArray(rows) || rows.length >= 100) return Response.json({ error: 'Subscription history needs review' }, { status: 409 });
    const active = rows.filter((row: any) => row.status === 'active' && row.provider === 'paypal');
    if (active.length !== 1 || rows.some((row: any) => row.provider === 'paypal' && row.status === 'pending')) {
      return Response.json({ error: 'An existing PayPal agreement needs review before changing plans' }, { status: 409 });
    }
    const current = active[0];
    if (current.plan !== 'premium' || !current.subscription_id || !current.paypal_plan_id ||
        current.paypal_environment !== environment()) {
      return Response.json({ error: 'This plan cannot be upgraded automatically. Review billing in Settings.' }, { status: 409 });
    }
    const auth = await fetch(apiBase() + '/v1/oauth2/token', {
      method: 'POST',
      headers: { Authorization: 'Basic ' + btoa(clientId + ':' + clientSecret), 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'grant_type=client_credentials',
    });
    const authData = await auth.json().catch(() => ({}));
    if (!auth.ok || !authData.access_token) return Response.json({ error: 'PayPal authentication unavailable' }, { status: 503 });
    const headers = { Authorization: 'Bearer ' + authData.access_token, Accept: 'application/json' };
    const lookup = await fetch(apiBase() + '/v1/billing/subscriptions/' + encodeURIComponent(current.subscription_id), { headers });
    const remote = await lookup.json().catch(() => ({}));
    if (!lookup.ok || remote.id !== current.subscription_id || remote.plan_id !== current.paypal_plan_id ||
        remote.custom_id !== user.id + ':' + current.sku || remote.status !== 'ACTIVE') {
      return Response.json({ error: 'PayPal could not verify your existing subscription for upgrade' }, { status: 409 });
    }
    // PayPal only permits revising an agreement to a compatible, active plan.
    // Reject invalid merchant plan configuration before sending customers to checkout.
    const [currentPlanResponse, targetPlanResponse] = await Promise.all([
      fetch(apiBase() + '/v1/billing/plans/' + encodeURIComponent(current.paypal_plan_id), { headers }),
      fetch(apiBase() + '/v1/billing/plans/' + encodeURIComponent(targetPlanId), { headers }),
    ]);
    const [currentPlan, targetPlan] = await Promise.all([
      currentPlanResponse.json().catch(() => ({})),
      targetPlanResponse.json().catch(() => ({})),
    ]);
    if (!currentPlanResponse.ok || !targetPlanResponse.ok ||
        currentPlan.id !== current.paypal_plan_id || targetPlan.id !== targetPlanId ||
        currentPlan.product_id !== targetPlan.product_id || targetPlan.status !== 'ACTIVE') {
      console.error('PayPal upgrade plan preflight failed', {
        currentStatus: currentPlanResponse.status, targetStatus: targetPlanResponse.status,
        compatibleProduct: Boolean(currentPlan.product_id && currentPlan.product_id === targetPlan.product_id),
        targetActive: targetPlan.status === 'ACTIVE',
      });
      return Response.json({ error: 'The Premium Plus upgrade plan is not available for this PayPal agreement. Your existing subscription remains unchanged.' }, { status: 409 });
    }
    const revision = await fetch(apiBase() + '/v1/billing/subscriptions/' + encodeURIComponent(current.subscription_id) + '/revise', {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        plan_id: targetPlanId,
        application_context: {
          brand_name: 'NaliChat',
          return_url: new URL('/settings?paypal_upgrade=returned', APP_BASE_URL).toString(),
          cancel_url: new URL('/settings?paypal_upgrade=canceled', APP_BASE_URL).toString(),
        },
      }),
    });
    const data = await revision.json().catch(() => ({}));
    if (!revision.ok) {
      console.error('PayPal subscription revision declined', { status: revision.status, issue: data.name || 'unknown' });
      return Response.json({ error: 'PayPal could not start this plan change. Your existing subscription is unchanged.' }, { status: 502 });
    }
    const approval = Array.isArray(data.links) ? data.links.find((link: any) => link.rel === 'approve')?.href : null;
    if (!approval) return Response.json({ error: 'PayPal did not provide an upgrade approval link. Check your subscription before retrying.' }, { status: 503 });
    let url: URL;
    try { url = new URL(approval); } catch { return Response.json({ error: 'Invalid PayPal approval URL' }, { status: 502 }); }
    const host = environment() === 'sandbox' ? 'www.sandbox.paypal.com' : 'www.paypal.com';
    if (url.protocol !== 'https:' || url.hostname !== host) return Response.json({ error: 'Untrusted PayPal approval URL' }, { status: 502 });
    return Response.json({ success: true, action: 'revise_paypal_subscription', userId: user.id, sku, approvalUrl: url.toString() });
  } catch (error) {
    console.error('PayPal upgrade error', error);
    return Response.json({ error: 'Could not verify PayPal plan change. Review billing before retrying.' }, { status: 503 });
  }
});
