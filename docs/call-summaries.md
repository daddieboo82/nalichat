# Premium Plus call summaries

## Privacy and consent model

Call summaries are available only when the authenticated requester currently has the
canonical `calls.summary` entitlement. Ordinary audio and video calling does not use
this entitlement and remains available on Free.

Consent is scoped to one opaque WebRTC call ID. The server snapshots the participants
from the `Conversation` entity; it never accepts a client-supplied participant list.
Every participant must explicitly accept within two minutes before capture is
authorized. The server stores account IDs, the consent decision, and timestamps for
auditability, but no display names or analytics payloads. A decline, revocation,
timeout, call end, call failure, or change to the conversation participant set stops
or prevents capture. A final decline/revocation cannot be changed for the same call.

Call session, consent, capture, and result entities are service-role-only. Clients
access them through the authenticated `callSummarySession` function, which checks the
server-owned participant snapshot before returning transcript or summary content.
Subscription downgrades prevent new generation but do not hide an already-generated
summary from its original participants during its retention window.

## Media pipeline limitation

NaliChat currently uses direct 1:1 WebRTC peer connections. There is no server-side
SFU, mixed call stream, or trusted server recorder. The safe supported implementation
therefore records each participant's **local microphone track** in that participant's
browser only after the server confirms unanimous consent. It does not claim to record
a mixed call. Both local captures must upload successfully before generation starts.
Group call summaries are intentionally unsupported.

Capture pauses immediately when the polled server state no longer authorizes it.
Browser and network scheduling can add a small stop delay; the server rejects capture
timestamps outside the consented interval (with a two-second closeout tolerance).
Browsers without `MediaRecorder` pause the entire summary session rather than silently
producing a partial result.

## Generation, quota, and failure handling

After the call ends, the requesting participant starts generation. The operation:

1. Requires both participants' consented local captures.
2. Reserves one existing daily AI quota unit using an opaque idempotency key.
3. Transcribes each capture with the existing `Core.TranscribeAudio` provider.
4. Sends the combined, pseudonymous transcript to `Core.InvokeLLM` for a concise
   summary and explicit action items.
5. Commits quota once provider dispatch begins, including provider failures.

Identical request keys return the existing state and never redispatch. A pending
request blocks concurrent generation for 15 minutes. Failed or stale requests require
a new key and allow at most three attempts. Provider calls time out after 60 seconds.
No-speech, timeout, quota exhaustion, incomplete captures, deleted conversations, and
provider failures are surfaced as explicit states; no transcript or summary is
fabricated.

## Retention and operations

- Completed transcripts and summaries are retained for 30 days, or until any
  participant deletes the session. Reads after expiry opportunistically redact and
  mark the result deleted.
- Capture URLs are cleared from application entities immediately after successful
  processing or participant deletion.
- The Base44 `UploadFile` integration does not expose object deletion to this app.
  **Production storage must enforce a maximum 24-hour lifecycle on call-capture
  objects** so clearing the URL also leads to physical deletion. Do not enable this
  feature until that lifecycle is configured and verified.
- Transcript, summary, action items, and audio URLs must never be added to analytics,
  logs, crash reports, or notification bodies. Current notifications contain only
  “Your call summary is ready.”
- Access and failure logs may include session ID, operation, error code, and timing,
  but not participant names or call content.

Required provider capabilities are the existing Base44 `Core.TranscribeAudio`,
`Core.InvokeLLM`, and `Core.UploadFile` integrations. Capture registration reuses the
server-owned `TRUSTED_MEDIA_HOSTS` allowlist from `base44/shared/mediaSecurity.ts` and
fails closed for every other host. Keep that allowlist synchronized with the verified
hosts returned by the production `UploadFile` integration. No result fallback exists
when a provider is unavailable.
