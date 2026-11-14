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
    || typeof row.account_id !== 'string' || !row.account_id) {
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
    providerId: typeof row.provider_id === 'string' && row.provider_id
      ? row.provider_id : null,
    state: row.state,
    version,
  };
}
function requireQuery(query) {
  if (typeof query !== 'function') throw new Error('Trusted PostgreSQL connection unavailable');
}
export function createPostgresCheckoutReservationAdapter(query) {
  requireQuery(query);
  return Object.freeze({
    async claimAtomic(input) {
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
