// Shared PayPal subscription reconciliation. Approval is not paid access:
// PayPal leaves a subscription APPROVED until the merchant activates it, and a
// next_billing_time in the past must not expire an otherwise active plan.

export async function resolvePayPalSubscriptionStatus(
  apiBase: string,
  accessToken: string,
  subscriptionId: string,
  remote: Record<string, any>,
): Promise<string> {
  let remoteStatus = String(remote?.status || '').toUpperCase();
  if (remoteStatus !== 'APPROVED') return remoteStatus;

  try {
    await fetch(
      apiBase + '/v1/billing/subscriptions/' + encodeURIComponent(subscriptionId) + '/activate',
      {
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + accessToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reason: 'Activating subscription after customer approval' }),
      },
    );
  } catch {
    // Activation may have succeeded remotely even if this request failed.
    // The subsequent GET is the only evidence that can establish ACTIVE.
  }

  // A successful activation POST is not evidence of current paid status.
  // PayPal may still report APPROVED, SUSPENDED, or another state; a missing
  // follow-up response must not be promoted to ACTIVE.
  try {
    const again = await fetch(
      apiBase + '/v1/billing/subscriptions/' + encodeURIComponent(subscriptionId),
      { headers: { Authorization: 'Bearer ' + accessToken, Accept: 'application/json' } },
    );
    if (again.ok) {
      const fresh = await again.json();
      const freshStatus = String(fresh?.status || '').toUpperCase();
      if (freshStatus) {
        remoteStatus = freshStatus;
        // The follow-up read is the authoritative billing snapshot. Do not
        // combine its ACTIVE status with a next_billing_time from the older
        // APPROVED response when the fresh payload omitted billing_info.
        remote.billing_info = fresh?.billing_info ?? undefined;
      }
    }
  } catch {
    // Leave approval pending for a later provider-confirmed reconciliation.
  }

  return remoteStatus;
}

// Active PayPal plans grant access until a future billing boundary exists.
// A missing or already-elapsed next_billing_time is not proof the period ended.
// Canceled plans keep the timestamp so access can stop at that boundary.
export function paypalPeriodEndForStatus(
  status: string,
  nextBillingTime: unknown,
  nowMs = Date.now(),
): string | null | undefined {
  if (typeof nextBillingTime !== 'string') return undefined;
  const value = nextBillingTime.trim();
  if (!value) return undefined;
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return undefined;
  if (status === 'active' && parsed <= nowMs) return null;
  return value;
}


/**
 * A newly approved PayPal checkout cannot become paid access without a
 * future provider billing boundary. Existing active records also must not
 * lose their recorded boundary because a webhook omitted billing_info.
 */
export function requiresPayPalBillingVerification(
  localStatus: unknown,
  nextStatus: unknown,
  periodEnd: unknown,
  nowMs = Date.now(),
): boolean {
  if (nextStatus !== 'active' || localStatus !== 'pending') return false;
  return typeof periodEnd !== 'string'
    || !Number.isFinite(Date.parse(periodEnd))
    || Date.parse(periodEnd) <= nowMs;
}
