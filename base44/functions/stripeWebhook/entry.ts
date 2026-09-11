import { createClientFromRequest } from 'npm:@base44/sdk@0.8.48';
import {
  loadStripeCatalog,
  normalizeStripeMetadata,
  shouldApplyStripeEvent,
  stripeEnvironment,
  subscriptionUpdateFromStripe,
  webhookLedgerAction,
} from '../../shared/stripeBilling.ts';
import { stripeRequest, verifyStripeSignature } from '../../shared/stripe.ts';

const HANDLED_EVENTS = new Set([
  'checkout.session.completed',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'invoice.paid',
  'invoice.payment_failed',
]);

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function stripeId(value: unknown): string | null {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object' && typeof (value as { id?: unknown }).id === 'string') {
    return (value as { id: string }).id;
  }
  return null;
}

function oneRecord(records: any[], description: string): any | null {
  if (records.length > 1) {
    throw new Error(`Multiple ${description} records require operator reconciliation`);
  }
  return records[0] || null;
}

function matchesRecordUser(recordUserId: unknown, metadataUserId: string): boolean {
  return recordUserId === metadataUserId
    || recordUserId === `deleted:${metadataUserId}`;
}

function isDeletedUserId(value: unknown): value is string {
  return typeof value === 'string' && value.startsWith('deleted:');
}

async function findSubscription(
  entities: any,
  {
    subscriptionId,
    checkoutId,
    customerId,
    metadata,
  }: {
    subscriptionId?: string | null;
    checkoutId?: string | null;
    customerId?: string | null;
    metadata?: ReturnType<typeof normalizeStripeMetadata>;
  },
): Promise<any | null> {
  if (checkoutId) {
    const byCheckout = oneRecord(
      await entities.Subscription.filter({ checkout_id: checkoutId }),
      'checkout',
    );
    if (byCheckout) return byCheckout;
  }
  if (subscriptionId) {
    const bySubscription = oneRecord(
      await entities.Subscription.filter({ subscription_id: subscriptionId }),
      'Stripe subscription',
    );
    if (bySubscription) return bySubscription;
  }
  if (metadata) {
    const userRecords = await entities.Subscription.filter({
      user_id: metadata.userId,
      provider: 'stripe',
    });
    const matching = userRecords.filter((record: any) => (
      record.sku === metadata.sku
      && (!customerId || !record.stripe_customer_id || record.stripe_customer_id === customerId)
      && (record.status === 'pending' || record.status === 'incomplete')
    ));
    if (matching.length > 1) {
      throw new Error('Multiple pending subscription records require operator reconciliation');
    }
    if (matching[0]) return matching[0];
  }
  return null;
}

function canonicalIdentity(
  record: any | null,
  stripeSubscription: any,
  catalog: ReturnType<typeof loadStripeCatalog>,
  expectedEnvironment: string,
): {
  userId: string;
  plan: string;
  billingPeriod: string;
  sku: string;
  environment: string;
  priceId: string;
} {
  const priceId = stripeId(stripeSubscription.items?.data?.[0]?.price);
  if (!priceId) {
    throw new Error(`Stripe subscription ${stripeSubscription.id} has no recurring price`);
  }

  const metadata = normalizeStripeMetadata(stripeSubscription.metadata);
  if (metadata) {
    const sku = catalog[metadata.sku];
    if (metadata.environment !== expectedEnvironment || sku.priceId !== priceId) {
      throw new Error(`Stripe metadata or price mismatch for ${stripeSubscription.id}`);
    }
    if (record?.user_id && !matchesRecordUser(record.user_id, metadata.userId)) {
      throw new Error(`Stripe metadata ownership mismatch for ${stripeSubscription.id}`);
    }
    return {
      userId: isDeletedUserId(record?.user_id) ? record.user_id : metadata.userId,
      plan: metadata.plan,
      billingPeriod: metadata.billingPeriod,
      sku: metadata.sku,
      environment: metadata.environment,
      priceId,
    };
  }

  if (record?.sku && record?.user_id) {
    const sku = catalog[record.sku as keyof typeof catalog];
    if (
      sku
      && sku.priceId === priceId
      && record.plan === sku.plan
      && record.billing_period === sku.billingPeriod
    ) {
      return {
        userId: record.user_id,
        plan: sku.plan,
        billingPeriod: sku.billingPeriod,
        sku: sku.sku,
        environment: expectedEnvironment,
        priceId,
      };
    }
  }

  throw new Error(`Missing valid canonical metadata for ${stripeSubscription.id}`);
}

async function persistUserStripeState(
  entities: any,
  userId: string,
  customerId: string,
  trialUsedAt?: string,
): Promise<void> {
  if (isDeletedUserId(userId)) return;

  const users = await entities.User.filter({ id: userId });
  const user = oneRecord(users, 'user');
  if (!user) {
    // A Stripe event can race with account deletion. Retained billing records
    // remain reconcilable even after the application User record is gone.
    return;
  }
  if (user.stripe_customer_id && user.stripe_customer_id !== customerId) {
    throw new Error(`Stripe customer ownership conflict for user ${userId}`);
  }
  await entities.User.update(userId, {
    stripe_customer_id: customerId,
    stripe_checkout_claim_id: null,
    stripe_checkout_claimed_at: null,
    ...(trialUsedAt && !user.trial_used_at ? {
      trial_used_at: trialUsedAt,
      trial_claim_id: null,
    } : {}),
  });
}

async function reconcileSubscription(
  entities: any,
  stripeSubscription: any,
  event: any,
  catalog: ReturnType<typeof loadStripeCatalog>,
  environment: string,
  checkoutId?: string | null,
): Promise<'applied' | 'stale'> {
  const subscriptionId = stripeSubscription.id;
  const customerId = stripeId(stripeSubscription.customer);
  if (!subscriptionId || !customerId) {
    throw new Error('Stripe subscription is missing an ID or customer');
  }
  const metadata = normalizeStripeMetadata(stripeSubscription.metadata);
  let record = await findSubscription(entities, {
    subscriptionId,
    checkoutId,
    customerId,
    metadata,
  });

  if (record && !shouldApplyStripeEvent(
    record.stripe_event_created,
    record.stripe_event_id,
    event.created,
    event.id,
  )) {
    return 'stale';
  }

  const lifecycle = subscriptionUpdateFromStripe(stripeSubscription);
  const baseUpdate: Record<string, unknown> = {
    ...lifecycle,
    subscription_id: subscriptionId,
    stripe_customer_id: customerId,
    stripe_event_created: event.created,
    stripe_event_id: event.id,
    ...(checkoutId ? { checkout_id: checkoutId } : {}),
  };

  // Deleted accounts retain tombstoned billing history for reconciliation.
  // Stripe can deliver cancellation/invoice events after account deletion; do
  // not require a now-deleted User record or restore the original user_id.
  if (typeof record?.user_id === 'string' && record.user_id.startsWith('deleted:')) {
    if (record.stripe_customer_id && record.stripe_customer_id !== customerId) {
      throw new Error(`Deleted-account customer ownership mismatch for ${subscriptionId}`);
    }
    await entities.Subscription.updateMany(
      {
        id: record.id,
        $or: [
          { stripe_event_created: null },
          { stripe_event_created: { $lte: event.created } },
        ],
      },
      { $set: baseUpdate },
    );
    return 'applied';
  }

  if (record?.grandfathered === true) {
    if (record.stripe_customer_id && record.stripe_customer_id !== customerId) {
      throw new Error(`Grandfathered customer ownership mismatch for ${subscriptionId}`);
    }
    await entities.Subscription.updateMany(
      {
        id: record.id,
        $or: [
          { stripe_event_created: null },
          { stripe_event_created: { $lte: event.created } },
        ],
      },
      { $set: baseUpdate },
    );
    await persistUserStripeState(
      entities,
      record.user_id,
      customerId,
      lifecycle.trial_started_at,
    );
    return 'applied';
  }

  const identity = canonicalIdentity(record, stripeSubscription, catalog, environment);
  const canonicalUpdate = {
    ...baseUpdate,
    user_id: identity.userId,
    plan: identity.plan,
    billing_period: identity.billingPeriod,
    provider: 'stripe',
    sku: identity.sku,
    stripe_environment: identity.environment,
    stripe_price_id: identity.priceId,
    stripe_product_id: stripeId(stripeSubscription.items?.data?.[0]?.price?.product),
    ...(lifecycle.trial_started_at
      ? { trial_used_at: lifecycle.trial_started_at, trial_target_plan: identity.plan }
      : {}),
  };

  if (!record) {
    record = await entities.Subscription.create(canonicalUpdate);
  } else {
    await entities.Subscription.updateMany(
      {
        id: record.id,
        $or: [
          { stripe_event_created: null },
          { stripe_event_created: { $lte: event.created } },
        ],
      },
      { $set: canonicalUpdate },
    );
  }
  await persistUserStripeState(
    entities,
    identity.userId,
    customerId,
    lifecycle.trial_started_at,
  );
  return 'applied';
}

async function processCheckout(
  entities: any,
  session: any,
  event: any,
  catalog: ReturnType<typeof loadStripeCatalog>,
  environment: string,
): Promise<void> {
  if (session.mode === 'payment') {
    const purchase = oneRecord(
      await entities.Base44Purchase.filter({ checkoutSessionId: session.id }),
      'purchase',
    );
    if (!purchase) {
      throw new Error(`No purchase found for checkout ${session.id}`);
    }
    if (session.payment_status !== 'paid') {
      // checkout.session.completed can precede settlement for delayed payment
      // methods. Keep the purchase pending until Stripe reports it paid.
      return;
    }
    if (purchase.status !== 'paid') {
      await entities.Base44Purchase.update(purchase.id, {
        status: 'paid',
        stripe_payment_intent_id: stripeId(session.payment_intent),
        stripe_customer_id: stripeId(session.customer),
        paid_at: new Date().toISOString(),
      });
    }
    return;
  }

  if (session.mode !== 'subscription') return;
  const subscriptionId = stripeId(session.subscription);
  if (!subscriptionId) {
    throw new Error(`Checkout ${session.id} has no Stripe subscription`);
  }
  const subscription = await stripeRequest(
    `/subscriptions/${encodeURIComponent(subscriptionId)}`,
    { 'expand[]': 'items.data.price.product' },
    'GET',
  );
  await reconcileSubscription(
    entities,
    subscription,
    event,
    catalog,
    environment,
    session.id,
  );
}

async function processInvoice(
  entities: any,
  invoice: any,
  event: any,
  catalog: ReturnType<typeof loadStripeCatalog>,
  environment: string,
): Promise<void> {
  const subscriptionId = stripeId(invoice.subscription);
  if (!subscriptionId) return;
  const subscription = await stripeRequest(
    `/subscriptions/${encodeURIComponent(subscriptionId)}`,
    { 'expand[]': 'items.data.price.product' },
    'GET',
  );
  await reconcileSubscription(entities, subscription, event, catalog, environment);
}

async function processEvent(
  entities: any,
  event: any,
  catalog: ReturnType<typeof loadStripeCatalog>,
  environment: string,
): Promise<'processed' | 'ignored'> {
  if (!HANDLED_EVENTS.has(event.type)) return 'ignored';
  const object = event.data?.object;
  if (!object) throw new Error(`Stripe event ${event.id} has no data object`);

  switch (event.type) {
    case 'checkout.session.completed':
      await processCheckout(entities, object, event, catalog, environment);
      break;
    case 'customer.subscription.updated':
      await reconcileSubscription(
        entities,
        await stripeRequest(
          `/subscriptions/${encodeURIComponent(object.id)}`,
          { 'expand[]': 'items.data.price.product' },
          'GET',
        ),
        event,
        catalog,
        environment,
      );
      break;
    case 'customer.subscription.deleted':
      await reconcileSubscription(entities, object, event, catalog, environment);
      break;
    case 'invoice.paid':
      await processInvoice(entities, object, event, catalog, environment);
      break;
    case 'invoice.payment_failed':
      await processInvoice(entities, object, event, catalog, environment);
      break;
  }
  return 'processed';
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }

  const rawBody = await req.text();
  if (!rawBody) {
    return Response.json({ error: 'Empty request body' }, { status: 400 });
  }
  const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');
  if (!webhookSecret) {
    console.error('Missing STRIPE_WEBHOOK_SECRET');
    return Response.json({ error: 'Server misconfigured' }, { status: 500 });
  }

  let event: any;
  try {
    event = await verifyStripeSignature(
      rawBody,
      req.headers.get('Stripe-Signature') || '',
      webhookSecret,
    );
  } catch (error) {
    console.error('Stripe signature verification failed:', error);
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (
    typeof event?.id !== 'string'
    || typeof event?.type !== 'string'
    || typeof event?.created !== 'number'
  ) {
    return Response.json({ error: 'Invalid Stripe event envelope' }, { status: 400 });
  }

  const base44 = createClientFromRequest(req);
  const entities = base44.asServiceRole.entities;
  let ledger: any;
  try {
    const existing = oneRecord(
      await entities.StripeWebhookEvent.filter({ stripe_event_id: event.id }),
      'webhook event ledger',
    );
    const ledgerAction = webhookLedgerAction(
      existing?.processing_state,
      existing?.updated_date || existing?.created_date,
    );
    if (ledgerAction === 'duplicate') {
      return Response.json({ received: true, duplicate: true });
    }
    if (ledgerAction === 'busy') {
      return Response.json(
        { error: 'Event is already processing; retry later' },
        { status: 409 },
      );
    }
    if (existing) {
      ledger = existing;
      await entities.StripeWebhookEvent.update(existing.id, {
        processing_state: 'processing',
        attempt_count: (existing.attempt_count || 1) + 1,
        last_error: '',
      });
    } else {
      ledger = await entities.StripeWebhookEvent.create({
        id: event.id,
        stripe_event_id: event.id,
        event_type: event.type,
        event_created: event.created,
        processing_state: 'processing',
        attempt_count: 1,
      });
    }

    const environment = stripeEnvironment(Deno.env.get('STRIPE_ENVIRONMENT'));
    const catalog = loadStripeCatalog((name) => Deno.env.get(name));
    const state = await processEvent(entities, event, catalog, environment);
    await entities.StripeWebhookEvent.update(ledger.id, {
      processing_state: state,
      processed_at: new Date().toISOString(),
      last_error: '',
    });
    return Response.json({ received: true });
  } catch (error) {
    const message = errorMessage(error);
    console.error(`Stripe webhook ${event.id} failed:`, error);
    if (ledger?.id) {
      try {
        await entities.StripeWebhookEvent.update(ledger.id, {
          processing_state: 'failed',
          last_error: message.slice(0, 2000),
        });
      } catch (ledgerError) {
        console.error('Failed to record Stripe webhook failure:', ledgerError);
      }
    }
    return Response.json({ error: 'Stripe event processing failed' }, { status: 500 });
  }
});
