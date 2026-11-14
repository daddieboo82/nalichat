/**
 * DRAFT: server-only PayPal subscription reader for checkout reconciliation.
 * Do not import into browser code or wire to live checkout before staging QA.
 * The caller must supply private credentials from the backend secret manager.
 * No provider mutation, subscription activation, or payment is performed.
 */
const API = Object.freeze({
  sandbox: 'https://api-m.sandbox.paypal.com',
  live: 'https://api-m.paypal.com',
});
const SUBSCRIPTION_ID = /^[A-Za-z0-9-]{8,128}$/;
function assertResponse(response, label) {
  if (!response || typeof response.ok !== 'boolean' || typeof response.json !== 'function') {
    throw new Error('Malformed PayPal ' + label + ' response');
  }
  if (!response.ok) throw new Error('PayPal ' + label + ' unavailable');
}
export function createServerPayPalSubscriptionReader({
  environment, clientId, clientSecret, fetchImpl, encodeBasic,
}) {
  if (!Object.hasOwn(API, environment)
    || typeof clientId !== 'string' || !clientId
    || typeof clientSecret !== 'string' || !clientSecret
    || typeof fetchImpl !== 'function'
    || typeof encodeBasic !== 'function') {
    throw new Error('Server PayPal subscription reader is not configured');
  }
  const apiBase = API[environment];
  return async function readPayPalSubscription(subscriptionId) {
    if (typeof subscriptionId !== 'string' || !SUBSCRIPTION_ID.test(subscriptionId)) {
      throw new Error('Invalid PayPal subscription identifier');
    }
    // Fresh credentials for each read. Never cache an ambiguous response or
    // use a frontend token. Do not include response body in errors/logs.
    const tokenResponse = await fetchImpl(apiBase + '/v1/oauth2/token', {
      method: 'POST',
      headers: {
        Authorization: 'Basic ' + encodeBasic(clientId + ':' + clientSecret),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    });
    assertResponse(tokenResponse, 'authentication');
    const tokenJson = await tokenResponse.json();
    if (typeof tokenJson?.access_token !== 'string' || !tokenJson.access_token) {
      throw new Error('PayPal authentication returned no usable token');
    }
    const response = await fetchImpl(
      apiBase + '/v1/billing/subscriptions/' + encodeURIComponent(subscriptionId),
      {
        method: 'GET',
        headers: {
          Authorization: 'Bearer ' + tokenJson.access_token,
          Accept: 'application/json',
        },
      },
    );
    assertResponse(response, 'subscription read');
    const remote = await response.json();
    if (!remote || remote.id !== subscriptionId || typeof remote.status !== 'string'
      || !remote.status.trim()) {
      throw new Error('PayPal subscription identity or status mismatch');
    }
    return Object.freeze({ id: remote.id, status: remote.status });
  };
}
