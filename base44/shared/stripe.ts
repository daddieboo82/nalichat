// Stripe API helper — uses the REST API directly to avoid SDK version issues in Deno.
// Shared by createCheckout, createSubscriptionCheckout, and stripeWebhook.

const STRIPE_API_BASE = 'https://api.stripe.com/v1';

export function getStripeKey(): string {
  const key = Deno.env.get('STRIPE_SECRET_KEY');
  if (!key) throw new Error('Missing STRIPE_SECRET_KEY');
  return key;
}

// Flatten a nested object into Stripe's x-www-form-urlencoded param format.
// e.g. { line_items: [{ price_data: { currency: 'usd' } }] }
//   -> line_items[0][price_data][currency]=usd
function flattenParams(obj: Record<string, any>, prefix: string = ''): string[] {
  const params: string[] = [];
  for (const [key, value] of Object.entries(obj)) {
    if (value === null || value === undefined) continue;
    const paramKey = prefix ? `${prefix}[${key}]` : key;
    if (Array.isArray(value)) {
      value.forEach((item: any, index: number) => {
        if (typeof item === 'object' && !Array.isArray(item)) {
          params.push(...flattenParams(item, `${paramKey}[${index}]`));
        } else {
          params.push(`${paramKey}[${index}]=${encodeURIComponent(String(item))}`);
        }
      });
    } else if (typeof value === 'object') {
      params.push(...flattenParams(value, paramKey));
    } else {
      params.push(`${paramKey}=${encodeURIComponent(String(value))}`);
    }
  }
  return params;
}

export async function stripeRequest(
  path: string,
  params: Record<string, any> = {},
  method: string = 'POST'
): Promise<any> {
  const key = getStripeKey();
  let url = `${STRIPE_API_BASE}${path}`;
  let body: string | undefined;

  if (method === 'GET') {
    const query = flattenParams(params).join('&');
    if (query) url += `?${query}`;
  } else {
    body = flattenParams(params).join('&');
  }

  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });

  const data = await res.json();
  if (!res.ok) {
    console.error(`Stripe API error (${path}):`, JSON.stringify(data));
    throw new Error(data.error?.message || `Stripe API error: ${res.status}`);
  }
  return data;
}

// Verify a Stripe webhook signature and return the parsed event.
export async function verifyStripeSignature(
  rawBody: string,
  signatureHeader: string,
  secret: string
): Promise<any> {
  const parts: Record<string, string> = {};
  for (const part of signatureHeader.split(',')) {
    const [key, value] = part.split('=');
    if (key && value) parts[key.trim()] = value.trim();
  }

  const timestamp = parts.t;
  const signature = parts.v1;

  if (!timestamp || !signature) {
    throw new Error('Invalid Stripe signature header');
  }

  // Reject replays older than 5 minutes
  const age = Math.floor(Date.now() / 1000) - parseInt(timestamp, 10);
  if (age > 300) {
    throw new Error('Stripe webhook timestamp outside tolerance');
  }

  // HMAC-SHA256 of "{timestamp}.{rawBody}" must match v1
  const signedPayload = `${timestamp}.${rawBody}`;
  const encoder = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(signedPayload));
  const expectedSignature = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  if (expectedSignature !== signature) {
    throw new Error('Stripe signature verification failed');
  }

  return JSON.parse(rawBody);
}