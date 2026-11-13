# NaliChat PayPal reconciliation — release gates (2026-11-13)

**State:** BLOCKED / DRAFT ONLY. This document is a release checklist, not authorization to deploy or charge customers.

## Evidence and scope
- PR #1046 contains draft code for PayPal provider reconciliation, verified billing boundaries, checkout collision prevention, and per-record error isolation. Source-only checks are not equivalent to compiled or exercised tests.
- Read-only app inspection previously showed 21 pending local PayPal Subscription rows across 9 user accounts and 1 locally active row with stored billing end 2026-10-20. These are **not verified payments**; one account may have multiple rows.
- Base44 published version remains `eefee5c4cd3ee2c8e77646c68b7dc961e034fe37` from the last checked app status. Do not assume draft code has reached users.
- The Base44 sandbox/workflow execution bridge returned an explicit integration-credit stop; scheduled reconciliation runs were canceled with `insufficient_credits`. Owner action is required for supported test execution.
- GitHub Quality Gates and CI Recovery jobs were marked failed without inspectable steps or logs (404 BlobNotFound on earlier job logs). Do **not** treat this as evidence that unit tests ran. See #972.

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
- [ ] Validate older records with missing `sku`, `paypal_plan_id`, or `custom_id` without silently granting access or creating another subscription.
- [ ] Validate live user journey on desktop, Android-sized mobile, iPhone-sized mobile, including login, pricing, checkout return, subscription display, and Premium gating.

## Launch decision
**NO-GO until all mandatory gates pass.** In particular: restoring Base44 credits does not itself repair the exposed key; passing static source assertions does not prove PayPal provider behavior; a GitHub failed job with missing steps is not proof the test command ran.

Use a staged release, with owner approval and validated rollback to last known production version. Confirm webhook processing and renewal health after rollout. Never modify live customer subscription rows or initiate provider billing as an audit shortcut.

## Tracking
- Draft subscription safeguards: https://github.com/daddieboo82/nalichat/pull/1046
- Payment / billing incident: https://github.com/daddieboo82/nalichat/issues/1045
- CI execution/observability incident: https://github.com/daddieboo82/nalichat/issues/972
- Public workflow authorization key: https://github.com/daddieboo82/nalichat/issues/1043
- Webhook destination/app ID draft: https://github.com/daddieboo82/nalichat/pull/1044
