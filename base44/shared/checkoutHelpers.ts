import { APP_ORIGIN } from './appConfig.ts';

export function checkoutErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Failed to create checkout session';
}

export function isCheckoutClientError(message: string): boolean {
  return message === 'Invalid checkout callback URL'
    || message === 'Checkout callback URL is not allowed';
}

export function randomVerifier(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

export async function anonymousCheckoutScope(req: Request, prefix: string = 'anon_checkout_'): Promise<string> {
  const forwarded = String(
    req.headers.get('cf-connecting-ip')
    || req.headers.get('x-real-ip')
    || req.headers.get('x-forwarded-for')
    || '',
  ).split(',')[0].trim().slice(0, 128);
  const userAgent = String(req.headers.get('user-agent') || '').slice(0, 256);
  const source = `${forwarded || 'unknown'}:${userAgent || 'unknown'}`;
  return prefix + await sha256Hex(source);
}

export function allowedCheckoutOrigins(): Set<string> {
  return new Set([APP_ORIGIN]);
}

export function validateCallbackUrl(raw: unknown, allowedOrigins: Set<string>): string {
  if (typeof raw !== 'string' || !raw) throw new Error('Invalid checkout callback URL');
  const url = new URL(raw);
  if (url.protocol !== 'https:' || !allowedOrigins.has(url.origin)) {
    throw new Error('Checkout callback URL is not allowed');
  }
  return url.toString();
}