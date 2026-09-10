// Stripe API helper that uses REST directly to avoid SDK runtime drift in Deno.

const STRIPE_API_BASE = 'https://api.stripe.com/v1';

export function getStripeKey(): string {
  const key = Deno.env.get('STRIPE_SECRET_KEY');
  if (!key) throw new Error('Missing STRIPE_SECRET_KEY');
  return key;
}

function flattenParams(obj: Record<string, unknown>, prefix = ''): string[] {
  const params: string[] = [];
  for (const [key, value] of Object.entries(obj)) {
    if (value === null || value === undefined) continue;
    const paramKey = prefix ? `${prefix}[${key}]` : key;
    if (Array.isArray(value)) {
      value.forEach((item, index) => {
        if (typeof item === 'object' && item !== null && !Array.isArray(item)) {
          params.push(...flattenParams(
            item as Record<string, unknown>,
            `${paramKey}[${index}]`,
          ));
        } else {
          params.push(`${paramKey}[${index}]=${encodeURIComponent(String(item))}`);
        }
      });
    } else if (typeof value === 'object') {
      params.push(...flattenParams(value as Record<string, unknown>, paramKey));
    } else {
      params.push(`${paramKey}=${encodeURIComponent(String(value))}`);
    }
  }
  return params;
}

export async function stripeRequest(
  path: string,
  params: Record<string, unknown> = {},
  method = 'POST',
  options: { idempotencyKey?: string } = {},
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

  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      ...(options.idempotencyKey
        ? { 'Idempotency-Key': options.idempotencyKey }
        : {}),
    },
    body,
  });

  const data = await response.json();
  if (!response.ok) {
    console.error(`Stripe API error (${path}):`, JSON.stringify(data));
    throw new Error(data.error?.message || `Stripe API error: ${response.status}`);
  }
  return data;
}

export async function verifyStripeSignature(
  rawBody: string,
  signatureHeader: string,
  secret: string,
): Promise<any> {
  let timestamp = '';
  const signatures: string[] = [];
  for (const part of signatureHeader.split(',')) {
    const [key, value] = part.split('=');
    if (key?.trim() === 't' && value) timestamp = value.trim();
    if (key?.trim() === 'v1' && value) signatures.push(value.trim());
  }

  if (!timestamp || signatures.length === 0) {
    throw new Error('Invalid Stripe signature header');
  }

  const parsedTimestamp = Number.parseInt(timestamp, 10);
  const age = Math.abs(Math.floor(Date.now() / 1000) - parsedTimestamp);
  if (!Number.isFinite(parsedTimestamp) || age > 300) {
    throw new Error('Stripe webhook timestamp outside tolerance');
  }

  const signedPayload = `${timestamp}.${rawBody}`;
  const encoder = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign(
    'HMAC',
    cryptoKey,
    encoder.encode(signedPayload),
  );
  const expectedSignature = Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
  const expectedBytes = encoder.encode(expectedSignature);
  const matches = signatures.some((candidate) => {
    const candidateBytes = encoder.encode(candidate);
    if (candidateBytes.length !== expectedBytes.length) return false;
    let difference = 0;
    for (let index = 0; index < expectedBytes.length; index += 1) {
      difference |= expectedBytes[index] ^ candidateBytes[index];
    }
    return difference === 0;
  });

  if (!matches) {
    throw new Error('Stripe signature verification failed');
  }

  return JSON.parse(rawBody);
}
