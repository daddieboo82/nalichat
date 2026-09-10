# NaliChat Subscription System

## Canonical product model

NaliChat has three canonical plans:

- `free`: core 1:1 and group chat
- `premium`: the standard paid entitlement set
- `premium_plus`: every Premium entitlement plus the highest-limit features

Trial is a lifecycle status, not a plan. An authenticated account may use one
seven-day trial for either paid tier. Checkout claims that eligibility on the
user record with a compare-and-set update before creating the Stripe session,
and prior trial-bearing subscription records also make the account ineligible.

Stripe web subscriptions are the only supported new billing flow. Wix billing
and the old single-plan `$19.99 every 30 days` pricing remain legacy
compatibility paths only. Wix events are prevented from mutating Stripe-owned
subscription records.

## Stripe catalog and environment

The server owns the catalog. Clients send one of these SKU identifiers and
never send a price ID, plan, billing period, or trial flag:

| SKU | Canonical plan | Period | Required secret |
| --- | --- | --- | --- |
| `premium_monthly` | `premium` | `monthly` | `STRIPE_PRICE_PREMIUM_MONTHLY` |
| `premium_yearly` | `premium` | `annual` | `STRIPE_PRICE_PREMIUM_YEARLY` |
| `premium_plus_monthly` | `premium_plus` | `monthly` | `STRIPE_PRICE_PREMIUM_PLUS_MONTHLY` |
| `premium_plus_yearly` | `premium_plus` | `annual` | `STRIPE_PRICE_PREMIUM_PLUS_YEARLY` |

Also configure:

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_ENVIRONMENT` (for example, `test` or `live`)
- `APP_BASE_URL` (the canonical HTTPS app origin; HTTP is accepted only for localhost)

Do not store secret values or production price IDs in source. Checkout and
portal redirects are resolved from server-approved destination identifiers
against `APP_BASE_URL`; arbitrary client callback URLs are rejected.

## Checkout retry semantics

`createSubscriptionCheckout` requires a URL-safe 16-128 character
`idempotencyKey`. The client must reuse that key when retrying the same
user/SKU/destination request. The server scopes it to the authenticated user,
persists it on the pending subscription, and sends the derived key to Stripe.
A completed prior attempt returns the same Checkout Session. Reusing a key for
different checkout parameters is rejected. A Stripe creation failure marks the
local record `incomplete` with no paid entitlement; the same key may be retried.
Accounts with an existing paid-access subscription must manage it through the
billing portal rather than creating a second subscription.

An account-level compare-and-set lease serializes checkout creation across
different idempotency keys. The lease matches Stripe Checkout's 24-hour session
window and can be reclaimed after it expires; retries with the same key retain
the lease and reuse the same live Checkout Session.

Trial eligibility is reserved at the first durable attempt. This intentionally
favors preventing duplicate trials over automatically releasing an ambiguous
network failure. Operators can inspect an `incomplete` record and its
`checkout_error`; clients should retry it with the same idempotency key.

One Stripe customer is persisted per NaliChat user. Checkout and subscription
metadata include the NaliChat user ID, canonical plan, billing period, SKU, and
environment. Billing portal creation requires authentication, a locally owned
customer ID, a successful Stripe customer ownership check, and a server-approved
return destination.

## Webhook configuration

Configure the Stripe endpoint with the raw request body and subscribe to:

- `checkout.session.completed`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.paid`
- `invoice.payment_failed`

The handler verifies `Stripe-Signature` against the unmodified body. Each event
is recorded in `StripeWebhookEvent` as `processing`, `processed`, `ignored`, or
`failed`. Processed replays are acknowledged without applying mutations.
Failures are persisted and return HTTP 500 so Stripe retries. Subscription
records retain the latest Stripe event timestamp and reject older lifecycle
mutations. A processing ledger row is leased for ten minutes; after that,
delivery may safely reclaim it if a prior invocation terminated mid-mutation.

Stripe statuses map as follows: `trialing` and `active` remain unchanged;
`past_due` and `unpaid` become canonical `unpaid`; `incomplete` remains
`incomplete`; `incomplete_expired` becomes `ended`; `paused` becomes `unpaid`;
and `canceled` remains
`canceled` until `current_period_end`, then becomes `ended`.

For Stripe test mode, create four recurring Prices, set all four price secrets
to their `price_...` IDs, set `STRIPE_ENVIRONMENT=test`, configure the webhook
with the five events above, and use the endpoint's test signing secret. Exercise
new checkout, trial checkout, replayed events, failed invoices, cancel at period
end, immediate cancellation, and portal ownership before enabling live mode.

## Entitlement authority

`base44/shared/subscription.ts` is the canonical subscription-domain module.
Server-side entitlement results are authoritative; client state is presentation
only and must not be used to authorize paid operations. Active and trialing paid
plans grant their tier. Canceled plans retain paid access only through a future
`current_period_end`. Ended, unpaid, incomplete, and pending plans grant only
free entitlements.

## Usage limits and enforcement

`base44/shared/subscription.ts` also owns all numeric plan limits:

| Plan | AI requests per UTC day | Maximum upload |
| --- | ---: | ---: |
| Free | 20 | 2 GiB |
| Premium | 200 | 10 GiB |
| Premium Plus | 1,000 | 20 GiB |

Legacy active `pro` and `pro_filesharing` records normalize to Premium Plus.
Inactive or expired paid records resolve to Free limits. To change a limit,
edit `PLAN_LIMITS` and deploy the server functions and client together.
`checkSubscriptionStatus` exposes the normalized values for display and early
client feedback, but server-side subscription lookup remains authoritative.

End-user AI functions use `base44/shared/aiQuota.ts`. Usage is stored in
`AIUsage` without prompts, messages, transcripts, filenames, generated content,
or payment data. A record is first reserved, then changed to `dispatched` only
after the provider call is made. Reservations expire after 15 minutes and
protect the daily ceiling against ordinary concurrent requests. Stable opaque
request keys prevent obvious retry double-counting. Base44 entities do not
provide a transactional unique constraint, so this is the strongest available
Base44-native design; monitor for duplicate request keys if traffic becomes
highly concurrent.

Quota days reset at `00:00:00Z`. Exhausted functions return HTTP 429 where the
Base44 function transport preserves status, with code
`AI_DAILY_QUOTA_EXHAUSTED` and `limit`, `used`, `remaining`, and `reset_at`
values. Admins can call `getAiUsage` with an optional `day` (`YYYY-MM-DD`) and
`user_id`; it returns counts by operation and account only.

The embedded Base44 agent conversation API cannot be invoked through a custom
server function. NaliChat therefore reserves and commits quota around each
client agent dispatch. This meters the shipped UI and gives users quota
feedback, but a caller with direct access to Base44's agent SDK could bypass
that wrapper. All directly controlled LLM, image, speech, transcription,
mastering, and ViralSeed calls are server-wrapped. Moderation, maintenance, and
scheduled health/report work are intentionally excluded because they are not
end-user AI consumption.

All app uploads call `authorizeUpload` before `Core.UploadFile`. The function
ignores client plan/limit claims and evaluates the authenticated account's
canonical server limit. Shared-file flows additionally use
`finalizeSharedFileUpload`, which rechecks the account limit and stamps the
authenticated uploader rather than trusting client identity fields. Base44's
direct `Core.UploadFile` API does not expose a server hook, signed upload policy,
or authoritative object-size callback, so the backend cannot verify the actual
byte count of arbitrary SDK calls. The preflight plus controlled SharedFile
finalization is the strongest available boundary and prevents expensive
transfer work through every shipped app path, but it is not a storage-layer
hard cap against a custom client that bypasses the app or lies about object
size.

For monitoring, alert on 429 volume, stale `reserved` rows, duplicate
`request_key` values for a user/day, and upload authorization failures. For an
observe-only rollback, keep `AIUsage` and admin inspection deployed, change the
metering wrapper to record without rejecting at the limit, and retain the
client quota display. A full rollback may restore prior functions while
leaving usage rows in place; they contain no user content and can support
post-incident analysis.

## Legacy migration

Run the admin-only `migrateSubscriptions` function as a dry run first:

```json
{ "dryRun": true }
```

Then run with `{ "dryRun": false }`. The operation is idempotent and reports
source and target counts. Legacy `trial` plans become `premium` with `trialing`
status unless `trial_target_plan` explicitly identifies `premium_plus`. Active
`pro` and `pro_filesharing` rows become grandfathered `premium_plus` rows.
Ended, canceled, unpaid, incomplete, and already-expired trials remain inactive.
Provider IDs, Stripe IDs, subscription IDs, billing periods, and external price
terms are not changed.

Grandfathered `pro` and `pro_filesharing` subscribers continue as Premium Plus
at their existing external price and cadence. Webhook reconciliation updates
only lifecycle/customer fields on these records and never replaces their Stripe
price, plan, or external charge amount.

Rollback is a data-only operation: use `migration_source_plan` to restore `plan`,
restore legacy `trial` status for trial-source rows, and clear fields stamped by
`migration_version: canonical-plans-v1`. Do not change or recreate external
Stripe subscriptions during rollback.

For a billing-hardening rollback, first disable the new client entry points,
leave the webhook enabled long enough to drain delivered events, and retain the
event ledger for audit/replay protection. Restore the previous functions and
schemas without deleting `stripe_customer_id`, external subscription IDs,
grandfathering fields, or changing Stripe prices. If new checkout must be
stopped immediately, disable the four Stripe Prices rather than redirecting new
traffic to Wix.
