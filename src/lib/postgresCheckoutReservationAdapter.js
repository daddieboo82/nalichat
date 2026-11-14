/**
 * DRAFT ONLY — server-side PostgreSQL reservation adapter.
 * Not wired to NaliChat checkout, never creates a provider agreement.
 *
 * `query(sql, parameters)` must be a trusted server-side parameterized
 * PostgreSQL client, restricted to an approved staging database.
 * Guarantees depend on the separate PostgreSQL UNIQUE index and real DB
 * tests; this JavaScript wrapper is NOT itself a lock.
 */
const TABLE = 'billing_private.checkout_intents';
const GENERIC_TRANSITIONS = Object.freeze({
  reserved: Object.freeze(['provider_request_started']),
  provider_request_started: Object.freeze(['provider_outcome_unknown']),
  provider_outcome_unknown: Object.freeze([]),
  // No generic transition can assert a successful local record: that must be
  // proven by a separate, durable and idempotent subscription-record write.
  provider_created: Object.freeze(['local_record_failed']),
  local_record_failed: Object.freeze([]),
  local_recorded: Object.freeze([]),
  verified_terminal: Object.freeze([]),
});
function asIntent(row) {
  if (!row) return null;
  // PostgreSQL bigint often arrives as a string. Coercing an out-of-range
  // value to Number would silently round the fencing version and could
  // accept/reject a stale worker incorrectly. Fail closed instead.
  const rawVersion = row.fencing_version;
  const validRepresentation = (typeof rawVersion === 'string' && /^[1-9][0-9]*$/.test(rawVersion))
    || (typeof rawVersion === 'number' && Number.isSafeInteger(rawVersion) && rawVersion > 0);
  if (!validRepresentation) throw new Error('Invalid PostgreSQL checkout fencing version');
  const version = Number(rawVersion);
  if (!Number.isSafeInteger(version) || version < 1) {
    throw new Error('Unsafe PostgreSQL checkout fencing version');
  }
  if (typeof row.intent_id !== 'string' || !row.intent_id
    || typeof row.account_id !== 'string' || !row.account_id
    || !['paypal', 'wix'].includes(row.provider)
    || typeof row.sku !== 'string'
    || !/^(premium|premium_plus)_(monthly|yearly)$/.test(row.sku)
    || typeof row.client_idempotency_key !== 'string'
    || !/^[A-Za-z0-9._~-]{16,128}$/.test(row.client_idempotency_key)
    || typeof row.provider_request_id !== 'string'
    || !/^[A-Za-z0-9._~-]{16,128}$/.test(row.provider_request_id)
    || !['reserved', 'provider_request_started', 'provider_outcome_unknown',
      'provider_created', 'local_record_failed', 'local_recorded',
      'verified_terminal'].includes(row.state)
    || (row.provider_id !== null
      && (typeof row.provider_id !== 'string'
        || !/^[A-Za-z0-9-]{8,128}$/.test(row.provider_id)))
    || (['provider_created', 'local_record_failed', 'local_recorded'].includes(row.state)
      && row.provider_id === null)) {
    throw new Error('Malformed PostgreSQL checkout reservation identity');
  }
  return {
    intentId: row.intent_id,
    accountId: row.account_id,
    provider: row.provider,
    sku: row.sku,
    requestKey: row.client_idempotency_key,
    providerRequestId: row.provider_request_id,
    // Provider subscription ID is recorded only after verified creation.
    // Never derive it from a client-provided checkout request key.
    providerId: row.provider_id,
    state: row.state,
    version,
  };
}
function requireQuery(query) {
  if (typeof query !== 'function') throw new Error('Trusted PostgreSQL connection unavailable');
}
export function createPostgresCheckoutReservationAdapter(query, trusted = {}) {
  requireQuery(query);
  // Only the server-side composition root may inject this independently
  // authenticated provider reader. Never populate it from a client request.
  const verifyTerminalOutcome = trusted?.verifyTerminalOutcome;
  const verifyPersistedSubscription = trusted?.verifyPersistedSubscription;
  return Object.freeze({
    async claimAtomic(input) {
      // Validate again at the server-side persistence boundary. This adapter
      // must never rely on every caller having used the coordinator first.
      if (!input || typeof input.accountId !== 'string'
        || !input.accountId.trim()
        || !['paypal', 'wix'].includes(input.provider)
        || typeof input.sku !== 'string'
        || !/^(premium|premium_plus)_(monthly|yearly)$/.test(input.sku)
        || typeof input.requestKey !== 'string'
        || !/^[A-Za-z0-9._~-]{16,128}$/.test(input.requestKey)
        || typeof input.providerRequestId !== 'string'
        || !/^[A-Za-z0-9._~-]{16,128}$/.test(input.providerRequestId)) {
        throw new Error('Invalid atomic checkout claim identity');
      }
      // Database uniqueness, not an application read-before-create, picks
      // the winner. No external provider operation belongs in this adapter.
      const inserted = await query(
        `insert into ${TABLE}
           (account_id, provider, sku, client_idempotency_key, provider_request_id)
         values ($1, $2, $3, $4, $5)
         on conflict do nothing
         returning intent_id, account_id, provider, sku, client_idempotency_key,
           provider_request_id, provider_id, state, fencing_version`,
        [input.accountId, input.provider, input.sku,
          input.requestKey, input.providerRequestId],
      );
      if (!Array.isArray(inserted?.rows)) throw new Error('Reservation query response invalid');
      if (inserted.rows.length === 1) {
        return { kind: 'created', intent: asIntent(inserted.rows[0]) };
      }
      if (inserted.rows.length !== 0) throw new Error('Unexpected number of claimed reservations');

      // A rejected write could be either a different outstanding checkout or
      // a previously used request identity after terminal completion.
      // Never interpret a null/ambiguous read as permission to create.
      const existing = await query(
        `select intent_id, account_id, provider, sku, client_idempotency_key,
           provider_request_id, provider_id, state, fencing_version
         from ${TABLE}
         where account_id = $1 and
           (state <> 'verified_terminal' or client_idempotency_key = $2)
         order by case when state <> 'verified_terminal' then 0 else 1 end,
           created_at desc
         limit 1`,
        [input.accountId, input.requestKey],
      );
      if (!Array.isArray(existing?.rows) || existing.rows.length > 1) {
        throw new Error('Checkout conflict lookup unavailable');
      }
      const found = asIntent(existing.rows[0]);
      if (!found) return { kind: 'conflict', intent: null };
      const exact = found.state !== 'verified_terminal'
        && found.accountId === input.accountId
        && found.requestKey === input.requestKey
        && found.providerRequestId === input.providerRequestId
        && found.provider === input.provider && found.sku === input.sku;
      return { kind: exact ? 'existing' : 'conflict', intent: found };
    },
    /**
     * Persist the provider-created subscription identity atomically with the
     * transition out of provider_request_started / provider_outcome_unknown.
     * Only trusted backend reconciliation may supply the provider ID. Never
     * accept an ID from a browser request or a webhook without authentication.
     * This operation cannot overwrite any previously persisted provider ID.
     */
    async recordProviderSubscription({
      intentId, accountId, provider, sku, providerRequestId,
      expectedState, expectedVersion, providerId,
    }) {
      if (typeof intentId !== 'string' || !intentId
        || typeof accountId !== 'string' || !accountId
        || !['paypal', 'wix'].includes(provider)
        || typeof sku !== 'string' || !/^(premium|premium_plus)_(monthly|yearly)$/.test(sku)
        || typeof providerRequestId !== 'string'
        || !/^[A-Za-z0-9._~-]{16,128}$/.test(providerRequestId)
        || !['provider_request_started', 'provider_outcome_unknown'].includes(expectedState)
        || !Number.isSafeInteger(expectedVersion) || expectedVersion < 1
        || expectedVersion >= Number.MAX_SAFE_INTEGER
        || typeof providerId !== 'string'
        || !/^[A-Za-z0-9-]{8,128}$/.test(providerId)) {
        throw new Error('Invalid verified provider subscription identity');
      }
      const updated = await query(
        `update ${TABLE}
         set state = 'provider_created', provider_id = $6,
           fencing_version = fencing_version + 1, updated_at = now()
         where intent_id = $1 and account_id = $2 and provider = $3
           and state = $4 and fencing_version = $5 and provider_id is null
           and sku = $7 and provider_request_id = $8
         returning intent_id, account_id, provider, sku, client_idempotency_key,
           provider_request_id, provider_id, state, fencing_version`,
        [intentId, accountId, provider, expectedState, expectedVersion,
          providerId, sku, providerRequestId],
      );
      if (!Array.isArray(updated?.rows) || updated.rows.length > 1) {
        throw new Error('Provider identity recording response invalid');
      }
      if (updated.rows.length === 0) return null; // stale/duplicate; never retry provider create
      const stored = asIntent(updated.rows[0]);
      if (!stored || stored.intentId !== intentId || stored.accountId !== accountId
        || stored.provider !== provider || stored.providerId !== providerId
        || stored.sku !== sku || stored.providerRequestId !== providerRequestId
        || stored.state !== 'provider_created' || stored.version !== expectedVersion + 1) {
        throw new Error('Provider identity recording proof invalid');
      }
      return stored;
    },
    /**
     * DRAFT ONLY: independently read the durable local Subscription record
     * using a trusted server-owned reader before claiming local_recorded.
     * This method must never accept an HTTP-provided receipt or bypass a
     * failed verification. It does not create or update Subscription records.
     */
    async confirmLocalSubscriptionRecorded(intent) {
      if (typeof verifyPersistedSubscription !== 'function') {
        throw new Error('Trusted local subscription verification unavailable');
      }
      if (!intent || !['provider_created', 'local_record_failed'].includes(intent.state)
        || !Number.isSafeInteger(intent.version) || intent.version < 1
        || intent.version >= Number.MAX_SAFE_INTEGER
        || typeof intent.intentId !== 'string' || !intent.intentId
        || typeof intent.accountId !== 'string' || !intent.accountId
        || !['paypal', 'wix'].includes(intent.provider)
        || !/^(premium|premium_plus)_(monthly|yearly)$/.test(intent.sku)
        || typeof intent.requestKey !== 'string'
        || !/^[A-Za-z0-9._~-]{16,128}$/.test(intent.requestKey)
        || typeof intent.providerRequestId !== 'string'
        || !/^[A-Za-z0-9._~-]{16,128}$/.test(intent.providerRequestId)
        || typeof intent.providerId !== 'string'
        || !/^[A-Za-z0-9-]{8,128}$/.test(intent.providerId)) {
        throw new Error('Verified local record requires persisted provider identity');
      }
      const receipt = await verifyPersistedSubscription(intent);
      if (!receipt || receipt.verified !== true
        || receipt.intentId !== intent.intentId
        || receipt.accountId !== intent.accountId
        || receipt.provider !== intent.provider
        || receipt.sku !== intent.sku
        || receipt.providerRequestId !== intent.providerRequestId
        || receipt.providerId !== intent.providerId) {
        throw new Error('Durable local subscription receipt unverified');
      }
      const result = await query(
        `update ${TABLE}
         set state = 'local_recorded',
           fencing_version = fencing_version + 1, updated_at = now()
         where intent_id = $1 and account_id = $2
           and provider = $3 and sku = $4
           and client_idempotency_key = $5
           and provider_request_id = $6 and provider_id = $7
           and state = $8 and fencing_version = $9
         returning intent_id, account_id, provider, sku, client_idempotency_key,
           provider_request_id, provider_id, state, fencing_version`,
        [intent.intentId, intent.accountId, intent.provider, intent.sku,
          intent.requestKey, intent.providerRequestId, intent.providerId,
          intent.state, intent.version],
      );
      if (!Array.isArray(result?.rows) || result.rows.length > 1) {
        throw new Error('Local subscription persistence response invalid');
      }
      const stored = asIntent(result.rows[0]);
      if (!stored || stored.intentId !== intent.intentId
        || stored.accountId !== intent.accountId
        || stored.provider !== intent.provider || stored.sku !== intent.sku
        || stored.requestKey !== intent.requestKey
        || stored.providerRequestId !== intent.providerRequestId
        || stored.providerId !== intent.providerId
        || stored.state !== 'local_recorded'
        || stored.version !== intent.version + 1) {
        throw new Error('Local subscription persistence CAS proof invalid');
      }
      return stored;
    },
    /**
     * Draft terminal release: only a server-injected authenticated provider
     * reader may authorize the row to become terminal. The SQL CAS binds the
     * original provider agreement and every checkout identity. Unknown provider
     * outcomes (including a missing provider ID) remain locked for manual
     * reconciliation; there is no lease timeout or client override.
     */
    async releaseVerifiedTerminal(intent) {
      if (typeof verifyTerminalOutcome !== 'function') {
        throw new Error('Trusted terminal provider verification unavailable');
      }
      if (!intent || !['provider_created', 'local_record_failed', 'local_recorded'].includes(intent.state)
        || !Number.isSafeInteger(intent.version) || intent.version < 1
        || intent.version >= Number.MAX_SAFE_INTEGER
        || typeof intent.intentId !== 'string' || !intent.intentId
        || typeof intent.accountId !== 'string' || !intent.accountId
        || !['paypal', 'wix'].includes(intent.provider)
        || !/^(premium|premium_plus)_(monthly|yearly)$/.test(intent.sku)
        || typeof intent.requestKey !== 'string'
        || !/^[A-Za-z0-9._~-]{16,128}$/.test(intent.requestKey)
        || typeof intent.providerRequestId !== 'string'
        || !/^[A-Za-z0-9._~-]{16,128}$/.test(intent.providerRequestId)
        || typeof intent.providerId !== 'string'
        || !/^[A-Za-z0-9-]{8,128}$/.test(intent.providerId)) {
        throw new Error('Terminal release requires a persisted provider agreement');
      }
      const evidence = await verifyTerminalOutcome(intent);
      if (!evidence || evidence.verified !== true || evidence.terminal !== true
        || evidence.intentId !== intent.intentId
        || evidence.accountId !== intent.accountId
        || evidence.provider !== intent.provider
        || evidence.providerRequestId !== intent.providerRequestId) {
        throw new Error('Terminal provider outcome unverified');
      }
      const result = await query(
        `update ${TABLE}
         set state = 'verified_terminal',
           fencing_version = fencing_version + 1, updated_at = now()
         where intent_id = $1 and account_id = $2
           and provider = $3 and sku = $4
           and client_idempotency_key = $5
           and provider_request_id = $6 and provider_id = $7
           and state = $8 and fencing_version = $9
         returning intent_id, account_id, provider, sku, client_idempotency_key,
           provider_request_id, provider_id, state, fencing_version`,
        [intent.intentId, intent.accountId, intent.provider, intent.sku,
          intent.requestKey, intent.providerRequestId, intent.providerId,
          intent.state, intent.version],
      );
      if (!Array.isArray(result?.rows) || result.rows.length > 1) {
        throw new Error('Terminal release response invalid');
      }
      const stored = asIntent(result.rows[0]);
      if (!stored || stored.intentId !== intent.intentId
        || stored.accountId !== intent.accountId
        || stored.provider !== intent.provider || stored.sku !== intent.sku
        || stored.requestKey !== intent.requestKey
        || stored.providerRequestId !== intent.providerRequestId
        || stored.providerId !== intent.providerId
        || stored.state !== 'verified_terminal'
        || stored.version !== intent.version + 1) {
        throw new Error('Terminal release CAS or identity proof invalid');
      }
      return stored;
    },
    async compareAndSwap({ intentId, accountId, expectedState, expectedVersion, nextState }) {
      // Generic CAS may not create a provider agreement OR release the
      // account reservation. Terminal release needs a separate authenticated
      // provider reconciliation and audit operation (not yet implemented).
      if (nextState === 'provider_created') {
        throw new Error('Provider identity must be durably recorded');
      }
      if (nextState === 'verified_terminal') {
        throw new Error('Verified terminal release store unavailable');
      }
      if (typeof intentId !== 'string' || !intentId
        || typeof accountId !== 'string' || !accountId
        || !Number.isSafeInteger(expectedVersion) || expectedVersion < 1
        || expectedVersion >= Number.MAX_SAFE_INTEGER
        || !Object.hasOwn(GENERIC_TRANSITIONS, expectedState)
        || !GENERIC_TRANSITIONS[expectedState].includes(nextState)) {
        throw new Error('Invalid checkout state transition');
      }
      const updated = await query(
        `update ${TABLE}
         set state = $5, fencing_version = fencing_version + 1,
           updated_at = now()
         where intent_id = $1 and account_id = $2
           and state = $3 and fencing_version = $4
         returning intent_id, account_id, provider, sku, client_idempotency_key,
           provider_request_id, provider_id, state, fencing_version`,
        [intentId, accountId, expectedState, expectedVersion, nextState],
      );
      if (!Array.isArray(updated?.rows) || updated.rows.length > 1) {
        throw new Error('Checkout fencing response invalid');
      }
      return asIntent(updated.rows[0]);
    },
  });
}
