// Apply only previously provider-verified terminal agreements. Each update is
// conditional so a concurrent activation/webhook cannot be overwritten.
export async function applyVerifiedTerminalPayPalRows(
  subscriptions: any,
  userId: string,
  environment: string,
  pending: any[],
): Promise<{ resolved: number; complete: boolean }> {
  let resolved = 0;
  for (const row of pending) {
    const outcome = await subscriptions.updateMany(
      {
        id: row.id,
        user_id: userId,
        provider: 'paypal',
        status: 'pending',
        subscription_id: row.subscription_id,
        paypal_plan_id: row.paypal_plan_id,
        sku: row.sku,
        paypal_environment: environment,
      },
      { $set: { status: 'canceled', cancel_at_period_end: false } },
    );
    if (Number(outcome?.updated || 0) !== 1) return { resolved, complete: false };
    resolved++;
  }
  return { resolved, complete: true };
}
