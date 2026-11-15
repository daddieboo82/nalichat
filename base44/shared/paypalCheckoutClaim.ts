// PayPal checkout reservation, candidate pending actual Base44 concurrency testing.
// UpdateMany must atomically check the User predicate and update exactly one row.
// Do not enable createPayPalSubscription merely because this helper exists.

interface ClaimStore {
  updateMany(query: Record<string, unknown>, changes: Record<string, unknown>): Promise<{ updated?: number; success?: boolean }>;
}

export async function reservePayPalCheckout(
  users: ClaimStore,
  userId: string,
  claimId: string,
  now = new Date().toISOString(),
): Promise<boolean> {
  if (!userId || !/^[A-Za-z0-9._~-]{16,128}$/.test(claimId)) return false;
  // No expiring lease or admin override: a provider response can be lost
  // after an agreement exists. Recovery must first establish the outcome.
  const claim = await users.updateMany(
    {
      id: userId,
      $or: [
        { paypal_checkout_claim_id: { $exists: false } },
        { paypal_checkout_claim_id: null },
        { paypal_checkout_claim_id: '' },
      ],
    },
    { $set: { paypal_checkout_claim_id: claimId, paypal_checkout_claimed_at: now } },
  );
  // Fail closed on unexpected update counts or response shapes.
  return claim?.success === true && claim?.updated === 1;
}

// A claim must never be cleared as a timeout cleanup or in a catch block.
// Provider-confirmed terminal reconciliation is the only permitted release.
// Reconciliation implementation and race testing are still outstanding.
