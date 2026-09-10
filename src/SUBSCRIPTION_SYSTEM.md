# NaliChat Subscription System

## Canonical product model

NaliChat has three canonical plans:

- `free`: core 1:1 and group chat
- `premium`: the standard paid entitlement set
- `premium_plus`: every Premium entitlement plus the highest-limit features

Trial is a lifecycle status, not a plan. An account may use one seven-day trial
for either paid tier. Checkout enforcement of trial eligibility is intentionally
deferred to the checkout-hardening rollout.

Stripe web subscriptions are the billing target. Wix billing and the old
single-plan `$19.99 every 30 days` pricing are legacy behavior pending retirement.
Canonical Stripe catalog product and price IDs have not been configured yet.

## Entitlement authority

`base44/shared/subscription.ts` is the canonical subscription-domain module.
Server-side entitlement results are authoritative; client state is presentation
only and must not be used to authorize paid operations. Active and trialing paid
plans grant their tier. Canceled plans retain paid access only through a future
`current_period_end`. Ended, unpaid, incomplete, and pending plans grant only
free entitlements.

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

Rollback is a data-only operation: use `migration_source_plan` to restore `plan`,
restore legacy `trial` status for trial-source rows, and clear fields stamped by
`migration_version: canonical-plans-v1`. Do not change or recreate external
Stripe subscriptions during rollback.
