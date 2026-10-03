import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { secrets } from 'base44:runtime';
import { normalizePlan, normalizeStatus } from '../../shared/subscription.ts';
import { consumeHourlyLimit } from '../../shared/rateLimit.ts';

/**
 * validateApplePurchase
 *
 * Receives a StoreKit 2 transaction from the iOS app, optionally validates it
 * with Apple's App Store Server API, and creates or updates a Subscription
 * record with provider="apple".
 *
 * If APPLE_ISSUER_ID / APPLE_KEY_ID / APPLE_PRIVATE_KEY / APPLE_BUNDLE_ID
 * secrets are configured, the function validates the transactionId server-side
 * via the App Store Server API v1. If they are absent, it trusts the transaction
 * data from the client (StoreKit 2 verifies the JWS signature on-device).
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

  const plan = isNonEmpty(data.plan) && VALID_PLANS.has(String(data.plan))
    ? String(data.plan)
    : mapping.plan;
  const billingPeriod = isNonEmpty(data.billingPeriod) && VALID_PERIODS.has(String(data.billingPeriod))
    ? String(data.billingPeriod)
    : mapping.billingPeriod;

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

/**
 * Create an ES256-signed JWT for the Apple App Store Server API.
 * Requires APPLE_ISSUER_ID, APPLE_KEY_ID, APPLE_PRIVATE_KEY, APPLE_BUNDLE_ID.
 */
async function createAppleServerApiJwt(): Promise<string | null> {
  const issuerId = secrets.get('APPLE_ISSUER_ID');
  const keyId = secrets.get('APPLE_KEY_ID');
  const privateKeyPem = secrets.get('APPLE_PRIVATE_KEY');
  const bundleId = secrets.get('APPLE_BUNDLE_ID');

  if (!issuerId || !keyId || !privateKeyPem || !bundleId) return null;

  try {
    // Import the private key for ES256 signing.
    const keyData = privateKeyPem.replace(/\\n/g, '\n');
    const key = await crypto.subtle.importKey(
      'pkcs8',
      new TextEncoder().encode(keyData),
      { name: 'ECDSA', namedCurve: 'P-256' },
      false,
      ['sign'],
    );

    const header = { alg: 'ES256', kid: keyId, typ: 'JWT' };
    const now = Math.floor(Date.now() / 1000);
    const payload = {
      iss: issuerId,
      iat: now,
      exp: now + 3600,
      aud: 'appstoreconnect-v1',
      bid: bundleId,
    };

    const base64Url = (obj: object) =>
      btoa(JSON.stringify(obj))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

    const headerB64 = base64Url(header);
    const payloadB64 = base64Url(payload);
    const unsigned = `${headerB64}.${payloadB64}`;

    const signature = await crypto.subtle.sign(
      { name: 'ECDSA', hash: 'SHA-256' },
      key,
      new TextEncoder().encode(unsigned),
    );

    const sigB64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    return `${unsigned}.${sigB64}`;
  } catch (error) {
    console.error('Apple JWT creation failed', error);
    return null;
  }
}

/**
 * Validate a transaction with Apple's App Store Server API v1.
 * Returns the decoded transaction info or null if validation fails.
 */
async function validateWithAppleServerApi(transactionId: string): Promise<Record<string, unknown> | null> {
  const jwt = await createAppleServerApiJwt();
  if (!jwt) return null;

  const endpoints = [
    'https://api.storekit.itunes.apple.com',
    'https://api-storekit-sandbox.itunes.apple.com',
  ];

  for (const base of endpoints) {
    try {
      const response = await fetch(
        `${base}/inApps/v1/transactions/${encodeURIComponent(transactionId)}`,
        { headers: { Authorization: `Bearer ${jwt}` } },
      );
      if (!response.ok) continue;
      const data = await response.json();
      // The response contains a signedTransactionInfo JWS.
      const signedInfo = data?.data?.signedTransactionInfo;
      if (!signedInfo || typeof signedInfo !== 'string') continue;

      // Decode the JWS payload (middle segment) to get transaction details.
      const parts = signedInfo.split('.');
      if (parts.length < 2) continue;
      const payloadJson = atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'));
      return JSON.parse(payloadJson);
    } catch (error) {
      console.error('Apple Server API validation failed for', base, error);
    }
  }
  return null;
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

    // If Apple API credentials are configured, validate server-side.
    let serverValidated = false;
    let validatedExpirationDate = input.expirationDate;
    let validatedProductId = input.productId;

    const appleResult = await validateWithAppleServerApi(input.transactionId);
    if (appleResult) {
      serverValidated = true;
      const expiryMs = appleResult.expiresDate;
      if (typeof expiryMs === 'number' && expiryMs > 0) {
        validatedExpirationDate = new Date(expiryMs).toISOString();
      }
      const serverProductId = appleResult.productId;
      if (typeof serverProductId === 'string' && serverProductId) {
        validatedProductId = serverProductId;
      }
    }

    // Determine subscription status from the expiration date.
    const now = new Date();
    const expirationDate = validatedExpirationDate
      ? new Date(validatedExpirationDate)
      : null;
    const isActive = expirationDate ? expirationDate > now : true;
    const status = isActive ? 'active' : 'ended';

    // Idempotency: use the original transaction ID as the subscription_id.
    // Apple reuses the same originalTransactionId across renewals.
    const subscriptionId = input.originalTransactionId;
    const plan = normalizePlan(input.plan);
    const billingPeriod = input.billingPeriod as 'monthly' | 'annual';

    // Check for an existing Apple subscription with the same original transaction ID.
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