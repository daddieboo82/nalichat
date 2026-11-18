// Stable per-account, per-SKU, per-UTC-day PayPal subscription creation ID.
// Do not key solely on account/day: different plans must not reuse one provider
// request ID. Repeats for the same SKU on the same UTC day remain idempotent,
// and existing active/pending agreement checks must run before creation.
export async function paypalSubscriptionRequestId(userId: string, sku: string, now = new Date()): Promise<string> {
  if (!userId || !/^(premium|premium_plus)_(monthly|yearly)$/.test(sku) ||
      !Number.isFinite(now.getTime())) {
    throw new Error('Invalid PayPal subscription idempotency scope');
  }
  const day = now.toISOString().slice(0, 10);
  const bytes = new TextEncoder().encode(userId + ':subscription:' + sku + ':' + day);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map(byte => byte.toString(16).padStart(2, '0')).join('').slice(0, 36);
}
