# NaliChat PayPal reconciliation — release gates (2026-11-13)

**State:** BLOCKED / DRAFT ONLY. This document is a release checklist, not authorization to deploy or charge customers.

## Evidence and scope
- PR #1046 contains draft code for PayPal provider reconciliation, verified billing boundaries, checkout collision prevention, and per-record error isolation. Source-only checks are not equivalent to compiled or exercised tests.
- Read-only app inspection previously showed 21 pending local PayPal Subscription rows across 9 user accounts and 1 locally active row with stored billing end 2026-10-20. These are **not verified payments**; one account may have multiple rows.
- Base44 published version remains `eefee5c4cd3ee2c8e77646c68b7dc961e034fe37` from the last checked app status. Do not assume draft code has reached users.
- The Base44 sandbox/workflow execution bridge returned an explicit integration-credit stop; scheduled reconciliation runs were canceled with `insufficient_credits`. Owner action is required for supported test execution.
- GitHub Quality Gates and CI Recovery jobs were marked failed without inspectable steps or logs (404 BlobNotFound on earlier job logs). Do **not** treat this as evidence that unit tests ran. See #972.

## Fail-closed recurring checkout rollout gate (#1047)
The draft `createPayPalSubscription` handler now has a **hard-coded closed
release gate** via `hasAtomicPayPalCheckoutReservation()`, whose current
implementation returns `false`. It responds 503 before scanning subscriptions
or making any PayPal API request. The previous
`PAYPAL_CHECKOUT_SERIALIZATION_VERIFIED` environment-secret bypass was removed
after an isolated executable handler test demonstrated **two distinct remote
agreements** from two parallel requests when the old flag was set to `true`.
This is a **deliberate safety stop**, not the missing atomic reservation.

- [ ] Implement a durable atomic *account-level* reservation and call it
      before the provider create operation, for every billing provider.
- [ ] Replace the hard-closed helper ONLY with real atomic reservation
      acquisition and recovery in the request/worker path. A Boolean
      environment flag or static `true` return is never an acceptable fix.
- [ ] Run concurrent different-key, different-SKU, and cross-provider checkout
      tests, uncertain PayPal response, expired worker lease and local record
      write failure recovery before any launch.
- [ ] Provide a customer-visible temporarily-unavailable checkout experience.
- [ ] Confirm existing subscriber reconciliation, webhooks, status and
      entitlements remain unaffected: this gate applies to new PayPal checkout
      creation, not the whole subscription system.

## Mandatory security gate (#1043)
The scheduled PayPal workflow definition and both backend entrypoints contain an identical repository-visible authorization key; read-only deployed workflow inspection found the same key live.

- [ ] Confirm a **platform-supported** scheduler/service-to-function identity or server-managed secret mechanism. Do not paste a replacement secret into workflow JSON, GitHub source, tests, issues, or logs.
- [ ] Coordinate workflow identity/credential rollout with both backend entrypoints, revoke/rotate the old credential, and verify unauthenticated or old-key invocations are rejected.
- [ ] Confirm the scheduler can still authenticate and execute, using an authorized staging environment, **after** credits and runtime access are restored.
- [ ] Verify role checks, rate limiting, logging without secrets, and no exposure of customer subscription identifiers to unauthorized callers.

## Mandatory functional gates
- [ ] Run Base44 CI or an equivalently controlled, approved runner with readable logs: install, lint, type-check, unit tests, production build and browser smoke.
- [ ] Execute unit tests covering manual lifetime grants, valid PayPal paid-through dates, malformed/missing/expired dates, negative ownership/plan checks, webhook replay, per-record failure isolation, and conflict with Stripe/Wix checkouts.
- [ ] Verify PayPal sandbox: APPROVAL_PENDING → APPROVED → ACTIVE, first capture, next billing, declined/suspended, canceled, refunded, and repeated or out-of-order webhook events.
- [ ] Verify that any PayPal `/activate` mutation runs **only** after matching plan ID, user reference and recorded subscription ID have been confirmed.
- [ ] Verify signed webhook registered destination and app ID (separate draft PR #1044); do not accept unverified events.
- [ ] Check that one lookup/API exception does not stop later reconciliation records and failures are observable and retried.
- [ ] Test an active paid PayPal subscription with temporarily missing billing metadata so a legitimate payer is not locked out indefinitely; provide a bounded, provider-evidence-backed recovery route.
- [ ] Test an expired/canceled subscription that should legitimately be allowed to purchase a new plan; prevent duplicate recurring charges.
- [ ] **Parallel checkout race (#1047):** run two simultaneous same-user PayPal create requests with different client idempotency keys and verify a single provider agreement. Require a provider-safe, atomically reserved per-user billing intent before considering launch; independent client keys alone cannot prevent distinct concurrent creates. Test an uncertain PayPal response and local write failure, too. Do **not** copy the current Stripe `User.filter` → `User.update` → `User.filter` claim sequence as a proven mutex: it lacks a verified atomic compare-and-swap/uniqueness guarantee and both requests can read back their own values before the next writer overwrites them.
- [ ] **Base44 API upsert is explicitly non-atomic under concurrent calls.** The documented `POST /entities/{entity_name}/upsert` API warns that two concurrent calls may both create the same record, and documented entity create ignores user-supplied `id`. Do not treat generic upsert or caller-provided IDs as a unique reservation; confirm runtime-specific atomic semantics or choose an externally serialized durable primitive before any live PayPal agreement creation.
- [ ] Validate older records with missing `sku`, `paypal_plan_id`, or `custom_id` without silently granting access or creating another subscription.
- [ ] Validate live user journey on desktop, Android-sized mobile, iPhone-sized mobile, including login, pricing, checkout return, subscription display, and Premium gating.

## Proposed atomic checkout reservation contract — design only, NOT implemented (#1047)

**2026-11-13 finding:** An isolated executable checkout-handler harness forced two
same-account requests with distinct idempotency keys to observe an empty
Subscription snapshot concurrently. With the rollout flag on, both reached
the provider create endpoint and wrote different local agreements. With the
flag absent, the same handler returned 503 before any provider call. This
reproduces the failure mode with mocks, **not** a live PayPal test.

**Backend capability verified:** Base44's documented beta entity upsert
`POST /api/apps/{app_id}/entities/{entity_name}/upsert` explicitly warns that
concurrent calls can both create the same new record. Base44 entity create
ignores caller-provided `id`. Neither API is a verified unique checkout lock.
A filter/read followed by update is likewise not proven compare-and-swap.

**Implementation candidate (requires approved durable transactional store):**

1. Define a server-only `billing_checkout_intents` table with a UNIQUE key
   for each account's *outstanding recurring checkout* (not just each SKU),
   plus unique provider-request identity. Reserve it using one atomic
   transaction/unique constraint. All checkout providers must honor the same
   account-level exclusion so a Stripe/Wix flow cannot race a PayPal flow.
2. Persist the authenticated user ID, requested SKU, provider, the
   single canonical server-generated PayPal request ID, a non-secret
   intent ID, and an explicit state BEFORE any provider POST. For a duplicate
   client retry, return the same intent; for a distinct key while an intent
   is unresolved, reject with a retryable/conflict response. Never permit a
   browser-supplied key to become a fresh provider request while another
   recurring agreement can still be billable.
3. Have a single authorized worker consume one reserved intent, with durable
   ownership/fencing or serial execution. **Persist the transition from
   `reserved` to `provider_request_started` BEFORE the provider POST.**
   A restarted worker observing `provider_request_started` must assume the
   external call may have succeeded, even if no local provider ID was saved.
   It must reconcile the original provider outcome rather than issuing
   another create. A matching intent/request ID alone is insufficient.
   Any exceptional same-ID provider retry requires provider-documented
   idempotency guarantees, an authorized recovery procedure and tests.
   An expired lease does *not* authorize a new provider create with a new key.
4. If PayPal responds ambiguously (timeout, 5xx, lost HTTP response),
   transition to `provider_outcome_unknown`. Freeze new recurring checkouts
   for that account until an authenticated provider lookup or documented
   safe same-ID recovery confirms the original outcome. Never interpret a
   missing local Subscription row as proof no agreement exists.
5. If PayPal succeeds but local Subscription persistence fails, durably
   retain the provider agreement identity in the reservation store and
   reconcile the local record before allowing another checkout. Provider
   ownership/plan, checkout URL, and billing period require independent
   verification; customer access must not be inferred from approval alone.
6. Release/exclude the account only after the original agreement is
   verified terminal (CANCELLED/EXPIRED or a documented equivalent) and
   accounting/webhook reconciliation is complete. Keep audit history;
   do not discard unresolved intents by age alone.
7. Expose only opaque client-safe statuses from the checkout endpoint.
   Keep operator credentials and provider identifiers server-side. Add
   authenticated administrative reconciliation, alerts and rate limits.

**Required executable tests before enabling checkout:**

- [ ] Same account/SKU, two different keys in parallel: at most ONE
      provider create and ONE outstanding agreement
- [ ] Same account, different SKUs or providers in parallel: at most ONE
      outstanding recurring agreement
- [ ] Same idempotency key retried after a network timeout: same intent and
      PayPal request ID; no second agreement
- [ ] Provider accepted creation but response lost: recover original outcome
      without issuing another distinct provider create
- [ ] Provider succeeded but local entity write failed: reservation prevents
      duplicate; recovery persists verified original subscription
- [ ] Worker crash/restart, expired lease and duplicate queue delivery:
      fencing/serialization prevents parallel provider creates
- [ ] Legitimate resubscription after confirmed remote terminal state succeeds
- [ ] Provider verification unavailable/identity mismatch: deny new agreement
      and preserve an actionable reconciliation record
- [ ] Unauthorized callers and requests across users cannot inspect or
      overwrite an account's reservation
- [ ] With flag unset, no provider create is possible even if an intent exists

**Not yet selected:** durable transaction service/provider, service credentials,
deployment lifecycle and operational recovery owner. Do not provision a new
paid service, migrate customer billing, or enable
`PAYPAL_CHECKOUT_SERIALIZATION_VERIFIED` merely because this design exists.

## Refund/reversal financial review procedure — not yet automated
- [ ] Find failed `PayPalWebhookEvent` rows with `last_error` containing `Refund/reversal of an active recurring agreement requires financial review`. Repeated HTTP 503 delivery is **not** a durable operator queue by itself, and retry limits may eventually expire.
- [ ] For each signed event, independently review the PayPal transaction and recurring agreement via authorized provider tools. Match sale/refund ID, agreement ID, plan, customer reference, currency, amount and event creation time against the ledger and local Subscription row; do not infer cancellation merely from a reversed sale.
- [ ] Record an audit trail of the operator's accounting decision, including whether any adjustment changes access or requires refund/chargeback handling. Do not turn `processing_state` into `processed`, delete events, or modify customer access merely to silence retries.
- [ ] Provide a tested, authorized resolution workflow and alerting for failed financial-review rows before release. Distinguish transient provider failures from cases pending human review, and test duplicate/redelivered events after resolution.

## Launch decision
**NO-GO until all mandatory gates pass.** In particular: restoring Base44 credits does not itself repair the exposed key; passing static source assertions does not prove PayPal provider behavior; a GitHub failed job with missing steps is not proof the test command ran.

Use a staged release, with owner approval and validated rollback to last known production version. Confirm webhook processing and renewal health after rollout. Never modify live customer subscription rows or initiate provider billing as an audit shortcut.

## Tracking
- Draft subscription safeguards: https://github.com/daddieboo82/nalichat/pull/1046
- Payment / billing incident: https://github.com/daddieboo82/nalichat/issues/1045
- CI execution/observability incident: https://github.com/daddieboo82/nalichat/issues/972
- Public workflow authorization key: https://github.com/daddieboo82/nalichat/issues/1043
- Webhook destination/app ID draft: https://github.com/daddieboo82/nalichat/pull/1044
