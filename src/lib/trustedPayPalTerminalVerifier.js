/**
 * DRAFT SERVER-ONLY PayPal plan resolver.
 * Must be constructed by a trusted backend with a private secret accessor.
 * No UI or client request may supply the expected plan ID.
 * Keep in sync with the deployed checkout catalog until one shared
 * server-side catalog is used for both creation and reconciliation.
 */
import { verifyPayPalTerminalCheckout } from './checkoutProviderTerminalVerification.js';

const PLAN_SECRETS = Object.freeze({
  premium_monthly: 'PAYPAL_PREMIUM_MONTHLY_PLAN_ID',
  premium_yearly: 'PAYPAL_PREMIUM_YEARLY_PLAN_ID',
  premium_plus_monthly: 'PAYPAL_PREMIUM_PLUS_MONTHLY_PLAN_ID',
  premium_plus_yearly: 'PAYPAL_PREMIUM_PLUS_YEARLY_PLAN_ID',
});
const PAYPAL_PLAN_ID = /^P-[A-Za-z0-9-]{8,128}$/;

/**
 * The factory's getSecret/readSubscription dependencies MUST be created and
 * held inside a server-only worker, never passed from the HTTP request body.
 */
export function createTrustedPayPalTerminalVerifier({ getSecret, readSubscription }) {
  if (typeof getSecret !== 'function' || typeof readSubscription !== 'function') {
    throw new Error('Trusted PayPal verification backend unavailable');
  }
  return async function verifyTerminalOutcome(intent) {
    if (!intent || intent.provider !== 'paypal'
      || !Object.hasOwn(PLAN_SECRETS, intent.sku)) {
      throw new Error('Unsupported PayPal checkout plan or provider');
    }
    const expectedPlanId = getSecret(PLAN_SECRETS[intent.sku]);
    if (typeof expectedPlanId !== 'string' || !PAYPAL_PLAN_ID.test(expectedPlanId)) {
      throw new Error('Configured PayPal plan ID unavailable');
    }
    return verifyPayPalTerminalCheckout(intent, readSubscription, expectedPlanId);
  };
}
