# Follow-up reminder operations

Smart follow-up reminders are a Premium Plus feature gated only by the canonical
`reminders.follow_up` entitlement. Core chat and ordinary in-app notifications
remain available on Free.

## Deployment

Base44 must deploy the following resources together:

- `FollowUpReminder` and the updated `Notification` entity schema.
- The create, list, reschedule, cancel, reply-resolution, and due-processing
  backend functions.
- `Resolve Follow-up Reminders`, an entity workflow for `Message.create`.
- `Process Due Follow-up Reminders`, a scheduled workflow running every minute
  in UTC (`* * * * *`).

No AI provider, prompt, message-content processing, external queue, or new
secret is required. The scheduled function creates an existing in-app
`Notification` record. Its body contains no message text or participant name.

After deployment, verify both workflows are enabled in Base44 and inspect the
first scheduler run. A healthy idle result is:

```json
{"due":0,"triggered":0,"canceled":0,"completed":0,"failed":0}
```

Monitor `failed` and the structured `follow_up_reminder_failed` log event.
Failures are terminal and stored as `status: "failed"` with
`resolution_reason: "notification_failed"`; they are not silently reported as
successful.

## Lifecycle and cleanup

Reminder records are service-owned. Browser clients cannot create, read, or
mutate them directly and must use the authenticated functions.

Before delivery, the scheduler rechecks:

1. The reminder is still scheduled and due.
2. The owner exists, is not banned/timed out, and still has
   `reminders.follow_up`.
3. The conversation exists and still includes the owner.
4. The source message exists, belongs to the owner, and is still in the same
   conversation.
5. No other sender has posted a message with a strictly later server
   `created_date`.
6. The reminder remains scheduled immediately before it is claimed.

Deletion, membership removal, a ban/timeout, or downgrade cancels a due
reminder with an explicit resolution reason. Recipient replies complete it.
Owner messages and equal timestamps do not complete it. The create path checks
for replies both before and after record creation to close the common
send/reply race.

## Send-path compatibility

This branch does not contain PR #19's authoritative message-send function.
Reply resolution therefore uses the existing Base44 `Message.create` entity
workflow, which covers the current direct browser sends and server-created
messages. When the stacks converge, keep the entity workflow as the legacy
compatibility path and invoke `resolveFollowUpRemindersForMessage` from the
authoritative send function after the message has its server `created_date`.
Both paths are idempotent, so overlapping delivery is safe.

Legacy direct source-message or conversation deletion is reconciled when the
reminder becomes due. A future authoritative delete function should cancel
matching scheduled reminders immediately, while retaining the scheduler check
as a safety net.

## Base44 atomicity limitations

Base44 entity APIs do not expose transactions, unique constraints, or
compare-and-set updates. The implementation narrows races with owner-scoped
request keys, duplicate-source checks, repeated state reads, and a
`scheduled -> triggered` claim with a random delivery token before notification
creation. A claim is not displayed as sent until `triggered_at` and the
correlated notification ID are persisted. Unconfirmed claims are recovered
after five minutes: an existing correlated notification confirms delivery,
while a claim with no notification returns to `scheduled`. These safeguards
make ordinary workflow duplication idempotent, but they cannot provide a formal
exactly-once guarantee under two truly simultaneous scheduler workers.
Likewise, a cancel arriving in the small interval between the final state read
and claim cannot be made transactional.

If Base44 adds conditional updates, use a single atomic transition equivalent
to `status = triggered WHERE id = ? AND status = scheduled`, and enforce a
unique `(owner_id, client_request_key)` index. Until then, keep the scheduler at
one active worker and alert on duplicate `follow_up_reminder_triggered` events.

Base44 automation functions also have HTTP endpoints. The processors accept
only authoritative entity IDs (reply data is reloaded from storage), and the
scheduler cannot deliver reminders early or redeliver a terminal reminder.
Base44 currently exposes no documented way for a checked-in workflow to attach
a server secret to its invocation. Restrict direct access to these two internal
function endpoints at the deployment edge if the hosting plan supports it, and
replace that control with native internal-only function access when Base44
offers it.

## Privacy-safe analytics

Client analytics allow only outcome, UI source, status, and coarse delay
buckets. Server analytics allow only outcome, resolution reason, conversation
type, and coarse delay buckets. Message content, message IDs, conversation IDs,
owner IDs, and participant identities are excluded.
