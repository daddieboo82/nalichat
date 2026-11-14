# NaliChat: requirements for safely reopening recurring checkout

Status: **design contract only — not implemented or deployed**. Related: #1047, #1048, #1046.

## Current production state

- The PayPal `createPayPalSubscription` and Wix `create-checkout` entrypoints intentionally reject otherwise-valid new recurring checkout requests with HTTP 503.
- The website's web upgrade controls are paused. The separate native Apple IAP path must not be changed by a web checkout fix.
- Existing subscriber reconciliation, cancellation and payment webhooks must remain operational.
- Base44's current `Subscription` entity has `checkout_request_key` but no documented uniqueness guarantee. Reading and then writing an entity is **not a lock**. Creating a new `CheckoutReservation` Base44 entity alone is not a safe fix.

## Required atomic store capability (must be proven in staging)

The checkout coordinator must expose **one atomic claim per account** across all new recurring checkout providers, not a separate lock per SKU or request key.

1. A durable reservation store must enforce a unique key on `account_id` for **outstanding** checkout intents, using a database uniqueness constraint or equivalent strongly consistent compare-and-swap. Verify concurrent writes against the actual backing implementation.
2. The stored record includes `account_id`, `intent_id`, `provider`, `sku`, `client_idempotency_key`, `provider_request_id`, `state`, `provider_id`, `created_at`, `updated_at`, and monotonically increasing fencing/row version. Provider tokens and secrets must never be stored here.
3. The authenticated server decides `account_id`. Never accept it from the checkout request body. Claim in a database transaction before any provider create call.
4. An existing unresolved reservation returns **409 / checkout already in progress** for a distinct request key; an exact repeat retrieves the same intent and may return a previously confirmed provider URL, but never creates a second provider agreement/session.
5. The coordinator durably advances to `provider_request_started` **before** the external call. A crash, timeout or ambiguous response is treated as `provider_outcome_unknown`, with **no blind retry** and **no time-based unlock**.
6. Reconciliation must query the provider using the persistent original request identity and validate ownership, product and status. A failed local Subscription record write must be recovered without attempting another provider create.
7. Release the account-level reservation only after a verified terminal provider outcome. A user cancel, process restart, lease timeout or missing local row does not establish a terminal provider outcome.
8. State writes and ownership changes are conditional on the fencing token/version, preventing stale workers from advancing a newer reservation.
9. Webhooks must be authenticated and idempotent, safe under duplication and out-of-order delivery. Existing subscriptions/renewals cannot be blocked by a new-checkout reservation.
10. Fail closed if the reservation store is unavailable: no provider create call and no silent fallback to Base44 read-then-create.

## Minimum acceptance tests (no real charges)

- 100 simultaneous same-account attempts, same and distinct request keys, across both providers and SKUs: at most one durable claim and one provider create request.
- Parallel requests for different accounts do not interfere.
- Lost provider reply after creation, process crash before local record write, provider create timeout, duplicate webhook, out-of-order webhook, stale worker, failed DB commit and reservation-store outage.
- Confirm the provider-side idempotency key is stable and bound to the exact intent, not generated afresh by retries.
- Confirm no outstanding intent can expire into an unlocked state without provider reconciliation.
- Authenticate and validate invalid-method, invalid-SKU and unauthenticated requests without exposing configuration.
- Run against actual transactional storage and mocked provider APIs, then approved PayPal/Wix sandbox; no live money or customer subscriptions during tests.
- Verify pricing UX for active customers, pending/failed checkout, account logout/login, and native Apple IAP.
- Independent approval of rollback strategy: rolling back to a build without this atomic reservation must **retain the 503 checkout kill gate**.

## Reopening procedure

Only after the backend constraint, atomic implementation, reconciliation worker, authenticated sandbox E2E, and deployment/rollback checks pass: replace the hard-coded safety stops in a reviewed release. The release guard `scripts/verify-paypal-checkout-safety.mjs` must be updated in the same change to assert the **verified** atomic implementation, not simply deleted or bypassed.

Until then **do not enable new PayPal or Wix recurring subscription checkout**.

## Draft local Subscription read/write identity binding (NOT deployed)

The new draft server-only `createTrustedLocalSubscriptionReader` requires
a **fresh, exact** service-role read by `user_id`, `provider`, and the
provider agreement/session field, with exactly one matching row:

- PayPal: `subscription_id` must match the verified agreement ID.
- Wix: `checkout_id` must match the verified checkout session ID.
- All providers: `checkout_intent_id`, `checkout_request_key`,
  `checkout_provider_request_id`, `sku`, and `user_id` must match
  the reservation. No read-result timestamp or “latest record” is sufficient.

The current PayPal checkout writer does **not** persist these complete identity
bindings; the current Wix writer persists `checkout_request_key` but not
`checkout_intent_id` or `checkout_provider_request_id`. Therefore existing
records must **not** be treated as verified local persistence receipts.
An approved server-only writer must durably and idempotently bind all fields,
with tested uniqueness/atomicity where required, before using this reader to
advance `local_recorded`. A read-only lookup is not an atomic lock.
Provider agreement IDs and Wix session IDs may have different lifecycles;
a Wix checkout session alone must **not** establish a paid subscription.
