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

  let activated = false;
  try {
    const actRes = await fetch(
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
    activated = actRes.ok || actRes.status === 204;
  } catch {
    activated = false;
  }
  if (activated) remoteStatus = 'ACTIVE';

  // Activation can lose a race with PayPal auto-activation, and the APPROVED
  // payload often has no usable billing window. Re-read before deciding access.
  try {
    const again = await fetch(
      apiBase + '/v1/billing/subscriptions/' + encodeURIComponent(subscriptionId),
      { headers: { Authorization: 'Bearer ' + accessToken, Accept: 'application/json' } },
    );
    if (again.ok) {
      const fresh = await again.json();
      if (fresh?.billing_info) remote.billing_info = fresh.billing_info;
      const freshStatus = String(fresh?.status || '').toUpperCase();
      if (freshStatus && (!activated || freshStatus === 'ACTIVE')) {
        remoteStatus = freshStatus;
      }
    }
  } catch {
    // Keep the status already resolved from the approval response.
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
