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
  // A successful activation request is not independently verified paid access.
  // Stay APPROVED until a subsequent matching PayPal GET confirms ACTIVE.
  // An already-active concurrent transition is likewise accepted only after GET.
  // The APPROVED payload often has no usable billing window.

  try {
    const again = await fetch(
      apiBase + '/v1/billing/subscriptions/' + encodeURIComponent(subscriptionId),
      { headers: { Authorization: 'Bearer ' + accessToken, Accept: 'application/json' } },
    );
    if (again.ok) {
      const fresh = await again.json();
      // An unexpected provider response cannot replace billing data or
      // lifecycle status from the agreement already identity-checked above.
      if (fresh?.id === subscriptionId && fresh?.plan_id === remote?.plan_id) {
        const freshStatus = String(fresh?.status || '').toUpperCase();
        if (freshStatus === 'ACTIVE') {
          if (fresh?.billing_info) remote.billing_info = fresh.billing_info;
          remoteStatus = 'ACTIVE';
        } else if (freshStatus === 'APPROVED' || freshStatus === 'APPROVAL_PENDING'
          || freshStatus === 'SUSPENDED' || freshStatus === 'CANCELLED'
          || freshStatus === 'EXPIRED') {
          remoteStatus = freshStatus;
        }
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
