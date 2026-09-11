# Scheduled Messages Runbook

Scheduled messages are a Premium and Premium Plus feature controlled by the
canonical `messages.schedule` entitlement. Free users retain normal immediate
chat through `chat.core`; the existing immediate-send path is unchanged.

## Product and data contract

- Only text messages are currently supported. Attachments, audio, sessions, and
  replies are intentionally excluded because uploaded URL lifetime and reply
  context cannot yet be guaranteed through delayed delivery.
- The browser converts a selected local wall-clock time to a UTC ISO instant.
  The UI rejects nonexistent daylight-saving times and lets the sender choose
  the first or second occurrence when a local time repeats.
- `ScheduledMessage` is server-owned (`create`, `read`, `update`, and `delete`
  RLS are all denied). Its authenticated functions return only records belonging
  to the current sender. Recipients cannot query or render scheduled content
  before the dispatcher creates the real `Message`.
- `client_request_key` uses the same stable, URL-safe request-key semantics
  expected by PR #19. This PR does not copy PR #19's immediate-message
  reliability changes. Repeated requests with the same key and payload return
  the original schedule; reuse with different parameters returns
  `IDEMPOTENCY_CONFLICT`. A server-only per-user lease serializes the lookup and
  create step so concurrent retries cannot create two schedules.
- Paid access is checked when creating or rescheduling and again immediately
  before delivery. A message whose sender has downgraded is marked `failed` with
  `ENTITLEMENT_REVOKED`; it is never silently dropped. Requiring access at
  delivery prevents users from stockpiling up to a year of future paid sends
  before canceling.
- Each sender may have at most 25 active schedules. Dispatch reads up to 125 due
  records and processes at most five per sender per run so one account cannot
  monopolize the global 25-message batch.

## Deployment

Deploy the schema and all functions together so every function receives the
same shared moderation and scheduling code:

```text
base44 deploy
```

The deployment must include:

- `ScheduledMessage` and the server-only `Message.scheduled_message_id` field.
- `createScheduledMessage`, `listScheduledMessages`,
  `updateScheduledMessage`, and `cancelScheduledMessage`.
- `dispatchScheduledMessages` and its `function.jsonc` automation.
- `moderateContent`, because it now imports the shared moderation module.

`dispatchScheduledMessages/function.jsonc` runs `* * * * *` (once per minute).
Base44 cron schedules are UTC. Confirm that
`dispatch_scheduled_messages_each_minute` is active after deployment and inspect
its Activity history for failures. Normal delivery latency is the cron interval
plus function startup time.

For an operational smoke test:

1. Schedule a text at least five minutes ahead from a paid test account.
2. Sign out or close the sender client before the due time.
3. Confirm one `Message` is created, the conversation preview advances, and the
   schedule becomes `sent` with `resulting_message_id` and `sent_at`.
4. Trigger `dispatchScheduledMessages` again and confirm no second `Message` is
   created.
5. Test cancellation and a moderation-rejected text in a non-production
   environment.

## Dispatch and retry behavior

The dispatcher selects at most 25 due records per invocation. It atomically
claims each record with `updateMany` conditioned on the prior status and lease
token. A worker that loses the compare-and-set does no delivery work.

Before sending, the worker revalidates all of the following:

- the sender still exists and is still a conversation participant;
- timeout/ban enforcement, including the existing admin-appeal exception;
- the conversation still exists;
- `messages.schedule` is still entitled;
- delivery-time text moderation.

Transient platform failures are retried with minute-based backoff. After five
attempts the item becomes `failed` with `DELIVERY_RETRY_EXHAUSTED`. Terminal
policy failures use safe codes that can be shown to the sender without exposing
moderation internals.

Moderation rejection is committed on the schedule before the violation strike
is applied. This ordering prevents a crashed worker from applying the same
strike again on retry. Because Base44 cannot transact those two entities
together, an exceptional crash in that narrow interval can omit the violation
audit/strike, but the rejected content remains blocked and is never delivered.

## Base44 atomicity limitations

Base44 does not expose a multi-entity transaction spanning `ScheduledMessage`,
`Message`, and `Conversation`. The implementation therefore provides:

- atomic compare-and-set claiming through one `ScheduledMessage.updateMany`;
- a six-minute renewable processing lease for crashed workers;
- reconciliation through the server-only `Message.scheduled_message_id`;
- duplicate cleanup before marking the schedule sent;
- a final compare-and-set on the claim token.

This gives idempotent schedule creation and delivery retries and prevents
normally concurrent workers from both owning a schedule. There is still a
narrow platform-level crash window between `Message.create` and durable
reconciliation, and Base44 has no documented unique index for
`scheduled_message_id`. A later retry reconciles duplicates, but a recipient
could briefly observe two creates in that exceptional window. If Base44 adds
unique indexes or transactions, enforce uniqueness on that key and wrap message
creation, preview update, and schedule finalization atomically.

The schedule is finalized as `sent` before the conversation preview update.
This prevents an already-created message from later appearing failed. A
`preview_pending` marker lets later cron runs repair a transient preview-write
failure without attempting message delivery again.
