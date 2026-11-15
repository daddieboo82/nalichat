import { createClientFromRequest } from 'npm:@base44/sdk@0.8.48';
import { secrets } from 'base44:runtime';
import { consumeHourlyLimit } from '../../shared/rateLimit.ts';

function apiBase(environment: string) {
  return environment === 'sandbox' ? 'https://api-m.sandbox.paypal.com' : 'https://api-m.paypal.com';
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 });
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user?.id || user.role !== 'admin' || user.is_banned ||
        (user.timeout_until && new Date(user.timeout_until).getTime() > Date.now())) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }
    const limit = await consumeHourlyLimit(base44.asServiceRole.entities, user.id, 'pending_paypal_audit', 10);
    if (!limit.allowed) return Response.json({ error: 'Audit rate limit reached' }, { status: 429 });

    const environment = (secrets.get('PAYPAL_ENVIRONMENT') || 'live').trim().toLowerCase();
    const clientId = secrets.get('PAYPAL_CLIENT_ID');
    const clientSecret = secrets.get('PAYPAL_CLIENT_SECRET');
    if (!clientId || !clientSecret || clientId.startsWith('REPLACE_') || clientSecret.startsWith('REPLACE_')) {
      return Response.json({ error: 'PayPal is not configured' }, { status: 503 });
    }

    const auth = await fetch(apiBase(environment) + '/v1/oauth2/token', {
      method: 'POST',
      headers: {
        Authorization: 'Basic ' + btoa(clientId + ':' + clientSecret),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    });
    const credentials = await auth.json();
    if (!auth.ok || !credentials.access_token) return Response.json({ error: 'PayPal authentication failed' }, { status: 502 });

    const headers = { Authorization: 'Bearer ' + credentials.access_token, Accept: 'application/json' };
    // Read-only merchant-side webhook registration check. Never return secrets or
    // full webhook URLs; report only whether this app's configured ID exists.
    const configuredWebhookId = secrets.get('PAYPAL_WEBHOOK_ID');
    const appId = secrets.get('BASE44_APP_ID') || '6a1f5ee134147461560c2b37';
    const expectedWebhookUrl = secrets.get('PAYPAL_WEBHOOK_URL') ||
      `https://base44-dispatcher-production.base44.workers.dev/api/apps/${appId}/functions/paypalWebhook`;
    let webhookCheck: Record<string, unknown> = { status: configuredWebhookId ? 'unverified' : 'missing_webhook_id' };
    if (configuredWebhookId) {
      try {
        // Fetch the configured webhook by ID. The list endpoint is paginated
        // and can falsely report a registered webhook as missing.
        const response = await fetch(apiBase(environment) + '/v1/notifications/webhooks/' + encodeURIComponent(configuredWebhookId), { headers });
        if (!response.ok) {
          webhookCheck = { status: response.status === 404 ? 'webhook_id_not_registered' : 'lookup_failed', httpStatus: response.status };
        } else {
          const match = await response.json();
          const requiredEvents = [
            'BILLING.SUBSCRIPTION.CREATED', 'BILLING.SUBSCRIPTION.ACTIVATED', 'BILLING.SUBSCRIPTION.UPDATED',
            'BILLING.SUBSCRIPTION.CANCELLED', 'BILLING.SUBSCRIPTION.SUSPENDED',
            'BILLING.SUBSCRIPTION.EXPIRED', 'PAYMENT.SALE.COMPLETED',
            'BILLING.SUBSCRIPTION.PAYMENT.FAILED', 'PAYMENT.SALE.REFUNDED',
            'PAYMENT.SALE.REVERSED',
          ];
          const eventNames = new Set((match?.event_types || []).map((entry: any) => entry.name));
          const missingEvents = requiredEvents.filter((name) => !eventNames.has(name) && !eventNames.has('*'));
          const webhookUrl = typeof match?.url === 'string' ? match.url : '';
          webhookCheck = {
            status: 'registered',
            enabled: match?.status === 'ENABLED',
            urlIsHttps: webhookUrl.startsWith('https://'),
            urlMatchesExpected: webhookUrl === expectedWebhookUrl,
            missingEvents,
          };
        }
      } catch {
        webhookCheck = { status: 'request_failed' };
      }
    }
    const active = await base44.asServiceRole.entities.Subscription.filter(
      { provider: 'paypal', status: 'active' }, '-created_date', 30,
    );
    const reference = active.find((record) => record.subscription_id && record.paypal_environment === environment);
    let referenceCheck: { status: string; httpStatus?: number } = { status: 'unavailable' };
    if (reference) {
      try {
        const response = await fetch(apiBase(environment) + '/v1/billing/subscriptions/' + encodeURIComponent(reference.subscription_id), { headers });
        if (!response.ok) {
          referenceCheck = { status: 'lookup_failed', httpStatus: response.status };
        } else {
          const remote = await response.json();
          const identityMatches = remote?.id === reference.subscription_id &&
            remote?.plan_id === reference.paypal_plan_id &&
            remote?.custom_id === reference.user_id + ':' + reference.sku;
          referenceCheck = {
            status: identityMatches ? String(remote.status || 'unknown').toUpperCase() : 'identity_mismatch',
            httpStatus: response.status,
          };
        }
      } catch {
        referenceCheck = { status: 'request_failed' };
      }
    }
    const planCatalog = [
      { sku: 'premium_monthly', secret: 'PAYPAL_PREMIUM_MONTHLY_PLAN_ID', amount: '7.99', interval: 'MONTH' },
      { sku: 'premium_yearly', secret: 'PAYPAL_PREMIUM_YEARLY_PLAN_ID', amount: '59.99', interval: 'YEAR' },
      { sku: 'premium_plus_monthly', secret: 'PAYPAL_PREMIUM_PLUS_MONTHLY_PLAN_ID', amount: '14.99', interval: 'MONTH' },
      { sku: 'premium_plus_yearly', secret: 'PAYPAL_PREMIUM_PLUS_YEARLY_PLAN_ID', amount: '99.99', interval: 'YEAR' },
    ];
    const planChecks = [];
    for (const item of planCatalog) {
      const planId = secrets.get(item.secret);
      if (!planId || planId.startsWith('REPLACE_')) { planChecks.push({ sku: item.sku, status: 'missing' }); continue; }
      try {
        const response = await fetch(apiBase(environment) + '/v1/billing/plans/' + encodeURIComponent(planId), { headers });
        if (!response.ok) { planChecks.push({ sku: item.sku, status: 'lookup_failed', httpStatus: response.status }); continue; }
        const plan = await response.json();
        const cycle = Array.isArray(plan.billing_cycles) ? plan.billing_cycles.find((entry: any) => entry.tenure_type === 'REGULAR') : null;
        const price = cycle?.pricing_scheme?.fixed_price;
        const matchesCatalog = price?.currency_code === 'USD' && Number(price.value) === Number(item.amount) &&
          cycle?.frequency?.interval_unit === item.interval && cycle?.frequency?.interval_count === 1;
        planChecks.push({ sku: item.sku, status: plan.status || 'unknown', amount: price?.value || null,
          currency: price?.currency_code || null, interval: cycle?.frequency?.interval_unit || null,
          matchesCatalog, httpStatus: response.status });
      } catch { planChecks.push({ sku: item.sku, status: 'request_failed' }); }
    }
    // Check every active PayPal record, not only the newest reference. An older
    // local active row may be inaccessible to the current merchant credentials.
    const activeChecks = [];
    for (const record of active) {
      if (!record.subscription_id || record.paypal_environment !== environment) {
        activeChecks.push({ status: 'environment_mismatch' });
        continue;
      }
      try {
        const response = await fetch(apiBase(environment) + '/v1/billing/subscriptions/' + encodeURIComponent(record.subscription_id), { headers });
        if (!response.ok) {
          activeChecks.push({ status: response.status === 404 ? 'not_found' : 'lookup_failed', httpStatus: response.status });
          continue;
        }
        const remote = await response.json();
        const identityMatches = remote?.id === record.subscription_id &&
          remote?.plan_id === record.paypal_plan_id &&
          remote?.custom_id === record.user_id + ':' + record.sku;
        activeChecks.push({ status: identityMatches ? String(remote.status || 'unknown').toUpperCase() : 'identity_mismatch',
          identityMatches, paymentRecorded: identityMatches && remote.billing_info?.last_payment?.time ? true : null });
      } catch {
        activeChecks.push({ status: 'lookup_failed' });
      }
    }
    // Ledger visibility distinguishes "no recorded webhook events" from
    // an active webhook pipeline. A zero count does not prove no delivery.
    let webhookLedgerCount: number | null = null;
    let webhookLedgerRecentStates: Record<string, number> | null = null;
    try {
      const ledgerRows = await base44.asServiceRole.entities.PayPalWebhookEvent.filter(
        {}, '-created_date', 100,
      );
      webhookLedgerCount = ledgerRows.length;
      webhookLedgerRecentStates = {};
      for (const row of ledgerRows) {
        const state = String(row.processing_state || 'unknown');
        webhookLedgerRecentStates[state] = (webhookLedgerRecentStates[state] || 0) + 1;
      }
    } catch {
      // An unavailable ledger must not prevent the other read-only checks.
    }
    const pending = await base44.asServiceRole.entities.Subscription.filter(
      { provider: 'paypal', status: 'pending' }, '-created_date', 100,
    );
    const results = [];
    // Aggregate historical checkout metadata without exposing customer identities.
    const uniqueAccounts = new Set(pending.map((record: any) => record.user_id).filter(Boolean)).size;
    const missingRequestKeys = pending.filter((record: any) => !record.checkout_request_key).length;
    // Count durable checkout claims on affected accounts without exposing user IDs.
    // These claims can block fresh checkout even after an old agreement is reconciled.
    const affectedUserIds = [...new Set(pending.map((record: any) => record.user_id).filter(Boolean))];
    let accountsWithCheckoutClaims = 0;
    let accountsWithUnknownClaimState = 0;
    let accountsWithUnmatchedCheckoutClaims = 0;
    let accountsWithMatchedCheckoutClaims = 0;
    for (const affectedUserId of affectedUserIds) {
      try {
        const affectedUser = await base44.asServiceRole.entities.User.get(affectedUserId);
        if (!affectedUser) {
          accountsWithUnknownClaimState++;
        } else if (affectedUser.paypal_checkout_claim_id) {
          accountsWithCheckoutClaims++;
          // A claim that matches a local checkout request key can be traced
          // to a recorded attempt. An unmatched claim needs separate review;
          // neither result authorizes clearing it or creating a new agreement.
          const claim = String(affectedUser.paypal_checkout_claim_id);
          const matched = pending.some((record: any) =>
            record.user_id === affectedUserId && record.checkout_request_key === claim
          );
          if (matched) accountsWithMatchedCheckoutClaims++;
          else accountsWithUnmatchedCheckoutClaims++;
        }
      } catch {
        accountsWithUnknownClaimState++;
      }
    }

    // An active local row is a reconciliation warning, not proof of payment.
    const activeAccountIds = new Set(active.map((record: any) => record.user_id).filter(Boolean));
    const pendingAccountsWithActiveRecord = new Set(pending.filter((record: any) => activeAccountIds.has(record.user_id)).map((record: any) => record.user_id)).size;
    const oldestAttempt = pending.reduce((oldest: string | null, record: any) => {
      const date = typeof record.created_date === 'string' ? record.created_date : null;
      return date && (!oldest || date < oldest) ? date : oldest;
    }, null);
    for (const record of pending) {
      if (!record.subscription_id || record.paypal_environment !== environment) {
        results.push({ subscriptionId: record.subscription_id || null, plan: record.sku || record.plan, status: 'environment_mismatch' });
        continue;
      }
      try {
        const response = await fetch(
          apiBase(environment) + '/v1/billing/subscriptions/' + encodeURIComponent(record.subscription_id),
          { headers },
        );
        if (!response.ok) {
          results.push({ subscriptionId: record.subscription_id, plan: record.sku || record.plan, status: response.status === 404 ? 'not_found' : 'lookup_failed', httpStatus: response.status });
          continue;
        }
        const remote = await response.json();
        // A provider status is not trustworthy for this local account until
        // the provider agreement ID, plan and custom account binding match.
        const identityMatches = remote.id === record.subscription_id &&
          remote.plan_id === record.paypal_plan_id &&
          remote.custom_id === record.user_id + ':' + record.sku;
        results.push({
          subscriptionId: record.subscription_id,
          plan: record.sku || record.plan,
          status: identityMatches ? String(remote.status || 'unknown').toUpperCase() : 'identity_mismatch',
          identityMatches,
          // An absent last_payment field is not proof that no money was collected.
          // Only return true for an observed provider payment; otherwise unknown.
          paymentRecorded: identityMatches && remote.billing_info?.last_payment?.time ? true : null,
          nextBillingTime: identityMatches ? (remote.billing_info?.next_billing_time || null) : null,
          lastPaymentTime: identityMatches ? (remote.billing_info?.last_payment?.time || null) : null,
          billingCyclesCompleted: identityMatches ? (remote.billing_info?.cycle_executions || []) : [],
        });
      } catch {
        results.push({ subscriptionId: record.subscription_id, plan: record.sku || record.plan, status: 'lookup_failed' });
      }
    }
    return Response.json({ success: true, action: 'pending_paypal_audit', adminUserId: user.id,
      environment, webhookCheck, webhookLedgerCount, webhookLedgerRecentStates, referenceCheck, activeChecks, planChecks, checked: results.length, uniqueAccounts, missingRequestKeys, accountsWithCheckoutClaims, accountsWithMatchedCheckoutClaims, accountsWithUnmatchedCheckoutClaims, accountsWithUnknownClaimState, pendingAccountsWithActiveRecord, oldestAttempt, results });
  } catch (error) {
    console.error('Pending PayPal audit failed', error);
    return Response.json({ error: 'Unable to audit pending PayPal subscriptions' }, { status: 500 });
  }
});
