#!/usr/bin/env node
/**
 * Fail-closed release guard for PayPal webhook event idempotency.
 *
 * A Base44 entity filter followed by create or update is not an atomic claim.
 * This gate intentionally remains failing until a separately verified storage
 * primitive enforces event-ID uniqueness plus exclusive state transitions.
 *
 * Passing SQLite reference tests is NOT sufficient evidence.
 */
import { readFileSync } from 'node:fs';

const webhook = readFileSync('base44/functions/paypalWebhook/entry.ts', 'utf8');
const schema = readFileSync('base44/entities/PayPalWebhookEvent.jsonc', 'utf8');
const hasReadCreateClaim = webhook.includes('entities.PayPalWebhookEvent.filter(')
  && webhook.includes('entities.PayPalWebhookEvent.create(');
const parsedSchema = JSON.parse(schema);
const eventField = parsedSchema?.properties?.paypal_event_id;
const hasDocumentedUnique = eventField?.unique === true;

// Do not infer database guarantees from an undocumented schema hint.
// The current source has neither evidence of an atomic claim nor a
// provider-backed test of concurrent delivery.
if (hasReadCreateClaim) {
  console.error('RELEASE BLOCKED: PayPal webhook claim uses non-atomic filter + create.');
  console.error('Need database-enforced unique event ID, atomic owner claim/fencing, and staging concurrency proof.');
  process.exitCode = 1;
} else if (!hasDocumentedUnique) {
  console.error('RELEASE BLOCKED: no documented, verified unique PayPal event claim storage.');
  process.exitCode = 1;
} else {
  // Intentionally fail until actual Base44 storage guarantees are established.
  console.error('RELEASE BLOCKED: schema hint alone cannot prove atomic provider-backed event claims.');
  process.exitCode = 1;
}
