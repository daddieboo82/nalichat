# Voice-note transcription

Voice-note playback and core chat remain available on Free. On-demand
transcription requires the canonical `voice.transcription` entitlement, which
is granted only to an active Premium Plus account. The client status is
advisory; `transcribeAudio` always rechecks the authenticated account on the
server.

## Request and privacy model

The client submits a message ID and an opaque idempotency key only. The server
loads the message and conversation, verifies current participant membership,
and resolves the stored audio URL itself. It rejects non-audio messages,
resources outside the deployment's exact app-owned URL prefixes, files over
25 MB, and recordings over 10 minutes. A storage probe supplies a size fallback
for legacy voice notes and catches deleted or inaccessible objects before the
AI provider is called.

The UI never transcribes automatically. It explains that the audio is sent to
the configured transcription provider and that the resulting transcript is
available to conversation participants who also have Premium Plus. Audio and
transcript content are never sent to analytics.

Transcript state is stored in the service-owned `VoiceTranscription` entity as
`pending`, `completed`, or `failed`. Direct entity access is admin-only; the
server function returns transcript text only after membership and entitlement
checks. Replaying the same request key returns its existing state and does not
invoke the provider or charge quota again. Starting a new attempt after a
provider failure uses a new key and consumes a new AI request.

## Provider and operations

No additional transcription-provider credential is required. The function uses
Base44's configured `integrations.Core.TranscribeAudio` provider. Provider
dispatches consume the existing daily AI metre as operation
`voice_transcription`. Validation, entitlement failures, inaccessible audio
detected by the preflight, and cached/idempotent responses do not consume quota.

Set `TRANSCRIPTION_ALLOWED_AUDIO_PREFIXES` in Base44 Secrets to a comma-separated
list of full HTTPS URL prefixes for this app's upload storage. Each prefix must
end in `/` and include the app-specific bucket/path segment, for example
`https://files.base44.com/<app-id>/`. The function fails closed when this value
is absent or a message URL is outside the configured prefixes.

Monitor failed `VoiceTranscription` rows by `error_code`, 429 responses, stale
`pending` rows, provider latency, and `AIUsage` rows for
`voice_transcription`. The provider call is bounded to 60 seconds. A timed-out
provider request may continue remotely and is conservatively charged because
dispatch already occurred.

Base44 entities do not expose a repository-level unique-index declaration.
Application-level request-state checks and the existing AI quota reservation
key prevent normal retries from duplicating work. Operators should alert on
duplicate `(requested_by, request_key)` rows; a truly simultaneous race from
custom clients remains a platform-level limitation until an atomic unique
constraint is available.
