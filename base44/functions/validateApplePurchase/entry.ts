import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { secrets } from 'base44:runtime';
import { normalizePlan, normalizeStatus } from '../../shared/subscription.ts';
import { consumeHourlyLimit } from '../../shared/rateLimit.ts';
import { verifyStoreKitTransaction } from '../../shared/appleStoreKit.ts';

/**
 * validateApplePurchase
 *
 * Receives a StoreKit 2 transaction from the iOS app, verifies Apple's signature
 * on it, and creates or updates a Subscription record with provider="apple".
 *
 * The transaction is verified locally against Apple's certificate chain (the
 * StoreKit 2 signed transaction), so no App Store Connect key is required.
 * Client-supplied receipt fields are never trusted on their own.
 * An optional APPLE_BUNDLE_ID secret adds a bundle ID to the accepted set.
 */

interface AppleTransactionInput {
  productId: string;
  plan: string;
  billingPeriod: string;
  transactionId: string;
  originalTransactionId: string;
  purchaseDate: string;
  expirationDate: string;
  jwsRepresentation: string;
}

const PRODUCT_TO_PLAN: Record<string, { plan: string; billingPeriod: string }> = {
  premium_monthly: { plan: 'premium', billingPeriod: 'monthly' },
  premium_yearly: { plan: 'premium', billingPeriod: 'annual' },
  premium_plus_monthly: { plan: 'premium_plus', billingPeriod: 'monthly' },
  premium_plus_yearly: { plan: 'premium_plus', billingPeriod: 'annual' },
};

// Bundle IDs this app ships under. The signed transaction's bundleId is checked
// against these, so a purchase from another app cannot unlock this one.
const DEFAULT_BUNDLE_IDS = ['com.nalichat', 'com.base6a1f5ee134147461560c2b37.app'];

function expectedBundleIds(): string[] {
  const ids = new Set(DEFAULT_BUNDLE_IDS);
  const configured = secrets.get('APPLE_BUNDLE_ID');
  if (typeof configured === 'string' && configured.trim()) ids.add(configured.trim());
  return [...ids];
}

const VALID_PLANS = new Set(['premium', 'premium_plus']);
const VALID_PERIODS = new Set(['monthly', 'annual']);

function isNonEmpty(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function validateInput(body: unknown): AppleTransactionInput | null {
  if (!body || typeof body !== 'object') return null;
  const data = body as Record<string, unknown>;
  const productId = String(data.productId || '');
  const mapping = PRODUCT_TO_PLAN[productId];
  if (!mapping) return null;

  // Product identity is authoritative for the tier and billing interval.
  // Never let a client-provided plan or period override the SKU mapping.
  if (isNonEmpty(data.plan) && data.plan !== mapping.plan) return null;
  if (isNonEmpty(data.billingPeriod) && data.billingPeriod !== mapping.billingPeriod) return null;
  const plan = mapping.plan;
  const billingPeriod = mapping.billingPeriod;

  if (!isNonEmpty(data.transactionId)) return null;

  return {
    productId,
    plan,
    billingPeriod,
    transactionId: String(data.transactionId),
    originalTransactionId: isNonEmpty(data.originalTransactionId)
      ? String(data.originalTransactionId)
      : String(data.transactionId),
    purchaseDate: isNonEmpty(data.purchaseDate) ? String(data.purchaseDate) : new Date().toISOString(),
    expirationDate: isNonEmpty(data.expirationDate) ? String(data.expirationDate) : '',
    jwsRepresentation: typeof data.jwsRepresentation === 'string' ? data.jwsRepresentation : '',
  };
}

Deno.serve(async (req) => {
  try {
    if (req.method !== 'POST') {
      return Response.json({ error: 'Method not allowed' }, { status: 405 });
    }

    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Authentication required' }, { status: 401 });
    }

    const rateLimit = await consumeHourlyLimit(
      base44.asServiceRole.entities,
      user.id,
      'apple_iap_validate',
      60,
    );
    if (!rateLimit.allowed) {
      return Response.json({ error: 'Too many requests. Please try again later.' }, { status: 429 });
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return Response.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const input = validateInput(body);
    if (!input) {
      return Response.json({ error: 'Invalid transaction data' }, { status: 400 });
    }
    if (!input.jwsRepresentation) {
      return Response.json({ error: 'A signed Apple transaction is required' }, { status: 400 });
    }

    // Never grant entitlements from client-supplied receipt fields alone.
    // Apple's signature on the transaction is verified locally against the
    // pinned certificate chain, so an unverified request stays unpaid.
    const verified = await verifyStoreKitTransaction(input.jwsRepresentation, {
      bundleIds: expectedBundleIds(),
    });
    if (!verified.ok) {
      console.error('Apple transaction rejected:', verified.reason);
      return Response.json({ error: 'Apple transaction could not be verified' }, { status: 422 });
    }
    const serverProductId = verified.transaction.productId;
    const serverTransactionId = verified.transaction.transactionId;
    const serverOriginalId = verified.transaction.originalTransactionId;
    const expiryMs = verified.transaction.expiresDate;
    if (serverTransactionId !== input.transactionId ||
        serverProductId !== input.productId ||
        !isNonEmpty(serverOriginalId) || !Number.isFinite(expiryMs) || expiryMs <= 0) {
      return Response.json({ error: 'Apple transaction details could not be verified' }, { status: 422 });
    }
    const serverValidated = true;
    const validatedExpirationDate = new Date(expiryMs).toISOString();
    const validatedProductId = serverProductId;

    // Determine subscription status from the expiration date.
    const now = new Date();
    const expirationDate = validatedExpirationDate
      ? new Date(validatedExpirationDate)
      : null;
    const isActive = expirationDate ? expirationDate > now : true;
    const status = isActive ? 'active' : 'ended';

    // Idempotency: use the original transaction ID as the subscription_id.
    // Apple reuses the same originalTransactionId across renewals.
    const subscriptionId = serverOriginalId;
    const plan = normalizePlan(input.plan);
    const billingPeriod = input.billingPeriod as 'monthly' | 'annual';

    // Check for an existing Apple subscription with the same original transaction ID.
    // Do not attach a verified Apple transaction to a second user account.
    const linked = await base44.asServiceRole.entities.Subscription.filter(
      { provider: 'apple', subscription_id: subscriptionId },
      '-created_date', 10, 0,
    );
    if (Array.isArray(linked) && linked.some((record) => record.user_id !== user.id)) {
      return Response.json({ error: 'This Apple subscription is already linked to another account' }, { status: 409 });
    }

    const existing = await base44.asServiceRole.entities.Subscription.filter(
      {
        user_id: user.id,
        provider: 'apple',
        subscription_id: subscriptionId,
      },
      '-created_date',
      1,
      0,
    );

    const recordData: Record<string, unknown> = {
      user_id: user.id,
      plan,
      status,
      billing_period: billingPeriod,
      provider: 'apple',
      subscription_id: subscriptionId,
      current_period_end: expirationDate ? expirationDate.toISOString() : null,
      cancel_at_period_end: false,
    };

    if (Array.isArray(existing) && existing.length > 0) {
      // Update the existing record (renewal or status change).
      const existingId = existing[0].id as string;
      await base44.asServiceRole.entities.Subscription.update(existingId, recordData);
    } else {
      // Create a new subscription record.
      await base44.asServiceRole.entities.Subscription.create(recordData);
    }

    return Response.json({
      success: true,
      action: 'validate_apple_purchase',
      userId: user.id,
      plan,
      billingPeriod,
      status,
      provider: 'apple',
      productId: validatedProductId,
      transactionId: input.transactionId,
      originalTransactionId: subscriptionId,
      serverValidated,
      currentPeriodEnd: expirationDate ? expirationDate.toISOString() : null,
    });
  } catch (error) {
    console.error('Validate Apple purchase error:', error);
    return Response.json({ error: 'Unable to validate Apple purchase' }, { status: 500 });
  }
});