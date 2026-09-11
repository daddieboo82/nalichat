# Locked chat vault security and deployment

## Security boundary

Locked chats are an app-level privacy screen for Premium Plus users. They are
designed to reduce casual disclosure when another person briefly uses an
already-unlocked or shared device. A locked conversation is hidden from the
normal conversation list, search, recent-navigation surfaces, unread summaries,
and notification previews until the user completes local verification.

This feature is **not end-to-end encryption**, does not encrypt message data at
rest, and does not hide messages from NaliChat or its service providers. It does
not protect against XSS, a compromised browser profile or device, authenticated
API access, administrators, server compromise, or lawful/legal process.

## Design

- `privacy.locked_chats` is the only entitlement that permits creating or
  removing a locked-conversation preference.
- A lock preference belongs to one user. It never changes visibility for other
  conversation participants.
- The server validates the authenticated user, current conversation membership,
  and entitlement before changing a lock preference.
- Existing lock preferences survive a subscription downgrade. A downgraded user
  may verify their PIN and read existing locked chats, but cannot create or
  remove locks until Premium Plus is restored.
- The browser starts fail-locked. If privacy state cannot be loaded, conversation
  details are not rendered.
- Unlock state exists only in memory. It expires after five minutes without
  pointer, keyboard, or touch activity; immediately expires when the tab/app is
  hidden, on page exit, on sign-out, or when another open tab broadcasts a lock.
  Unlocks are never broadcast to other tabs and do not survive restart.
- PINs are restricted to 6-12 digits and transformed in the browser with Web
  Crypto PBKDF2-HMAC-SHA-256, a random 128-bit salt, 600,000 iterations, and a
  256-bit result. Only the salt, KDF parameters, and verifier are stored by the
  service. Plaintext PINs are never stored, logged, or sent to analytics.
- PIN verification is performed by an authenticated server function using a
  constant-time verifier comparison, durable attempt reservations, and
  server-owned exponential throttling. Requests are also serialized within a
  function worker.
- Forgotten-PIN reset sends a short-lived one-time code to the authenticated
  account email. Completing reset rotates the PIN verifier and invalidates
  outstanding reset challenges. It changes only the app lock; conversations,
  account credentials, and lock preferences are unchanged.
- Message notifications are checked per recipient. Locked-chat notifications
  contain only `New message in a locked chat.` with no participant name, message
  content, attachment name, or media thumbnail.

## Device verification

This release is PIN-only. The current Base44 runtime does not provide a vetted
server-side WebAuthn registration/authentication verification primitive, and the
project does not add a new cryptography dependency solely for this feature.
Platform biometric or passkey availability is therefore not represented as
authentication. WebAuthn can be added later only with server-generated,
single-use challenges, origin/RP-ID validation, credential ownership checks,
signature verification, and sign-counter/replay handling.

## Deployment

Deploy the following Base44 resources together with the client:

1. `LockedConversationPreference`, `LockedChatSecurity`, and
   `LockedChatResetChallenge` entities with their repository RLS definitions.
2. The `lockedChatVault` server function.
3. The updated `notifyOnMessage` function and `Notification` schema.

The existing subscription service must return the canonical
`privacy.locked_chats` entitlement. Outbound email must be enabled for the
Base44 `Core.SendEmail` integration so forgotten-PIN verification codes can be
delivered. If email delivery fails, reset fails closed and the existing PIN
continues to apply.

No WebAuthn configuration is required for this release. No client-side secret,
encryption key, or environment variable is introduced.

## Operational limitations

Lock preferences and PIN verifiers are service-visible metadata. An
authenticated caller with direct API access remains outside this feature's
threat model. Administrators must avoid copying message content into unrelated
notification or analytics systems. Account recovery depends on continued
access to the account email. Base44 does not expose transactional compare-and-set
operations, so attempt reservations provide best-effort cross-instance
serialization rather than a cryptographic online-guessing guarantee; deployment
rate limits should remain enabled. Removing a user from a conversation makes its
preference inaccessible and eligible for later server cleanup.
