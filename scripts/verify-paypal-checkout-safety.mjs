#!/usr/bin/env node
/**
 * Static fail-closed gate for the emergency billing pause.
 * Deliberately blocks release if edits remove the temporary safety stop.
 * Remove this guard ONLY in the same reviewed change that introduces and
 * verifies durable per-account atomic checkout reservations.
 */
import { readFileSync } from 'node:fs';

const backend = readFileSync('base44/functions/createPayPalSubscription/entry.ts', 'utf8');
const pricing = readFileSync('src/components/pricing/PricingPlans.jsx', 'utf8');
const wixCheckout = readFileSync('base44/functions/create-checkout/entry.ts', 'utf8');
const failures = [];
const check = (condition, detail) => {
  if (!condition) failures.push(detail);
};

const reservation = backend.match(
  /function\s+atomicCheckoutReservationIsImplemented\s*\(\s*\)\s*:\s*boolean\s*\{([^}]*)\}/,
);
check(Boolean(reservation && /^\s*return\s+false\s*;\s*$/.test(reservation[1])),
  'Atomic-reservation helper must remain hard-closed.');

const gate = backend.indexOf('if (!atomicCheckoutReservationIsImplemented())');
const failureResponse = backend.indexOf('status: 503', gate);
const planSecret = backend.indexOf('const planId = secrets.get(item.secret)');
const subscriptionRead = backend.indexOf('const allSubs = await');
const providerCreate = backend.indexOf("fetch(apiBase() + '/v1/billing/subscriptions', {");
check(gate >= 0 && failureResponse > gate && failureResponse < planSecret
  && planSecret < subscriptionRead && subscriptionRead < providerCreate,
'Hard stop must execute before PayPal plan secrets, subscription reads and agreement creation.');
check(!backend.includes('PAYPAL_CHECKOUT_SERIALIZATION_VERIFIED'),
  'Legacy operator flag must not bypass checkout safety.');


// The alternate Wix subscription checkout route needs the same protection.
const wixReservation = wixCheckout.match(
  /function\s+hasVerifiedAtomicWixReservation\s*\(\s*\)\s*:\s*boolean\s*\{([^}]*)\}/,
);
check(Boolean(wixReservation && /^\s*return\s+false\s*;\s*$/.test(wixReservation[1])),
  'Wix checkout reservation helper must remain hard-closed.');
const wixStop = wixCheckout.indexOf('if (!hasVerifiedAtomicWixReservation())');
const wix503 = wixCheckout.indexOf('status: 503', wixStop);
const wixRateLimit = wixCheckout.indexOf('const checkoutRate = await consumeHourlyLimit(');
const wixProviderCreate = wixCheckout.indexOf("'https://www.wixapis.com/payments/platform/v1/checkout-sessions/construct'");
check(wixStop >= 0 && wix503 > wixStop && wix503 < wixRateLimit
  && wixRateLimit < wixProviderCreate,
  'Wix checkout stop must precede account reads and provider session creation.');

check(pricing.includes('isCheckoutPaused={!appleIAP.available}')
  && pricing.includes('disabled={isStarting || isCurrent || isPaidSubscriber || isCheckoutPaused}'),
  'Web PayPal upgrade buttons must remain disabled.');
check(pricing.includes('New PayPal subscriptions are temporarily unavailable')
  && pricing.includes('New PayPal checkout attempts are paused while billing safety is verified'),
  'Web pricing must explain the checkout pause and unresolved pending agreements.');
check(pricing.includes('appleIAP.purchase(sku)'),
  'Native Apple IAP purchase branch must remain present.');
check(!pricing.includes('Choose the same plan below to resume checkout.'),
  'Pricing must not offer a PayPal retry while checkout is paused.');

if (failures.length) {
  console.error('PayPal checkout safety RELEASE BLOCKED:');
  for (const reason of failures) console.error(' - ' + reason);
  process.exitCode = 1;
} else {
  console.log('PayPal checkout safety stop and customer notice: verified in source.');
}
