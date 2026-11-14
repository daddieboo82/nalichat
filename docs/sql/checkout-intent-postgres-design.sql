-- DESIGN CANDIDATE ONLY. DO NOT APPLY TO PRODUCTION OR CONNECT TO
-- NALICHAT UNTIL OWNERSHIP OF A DEDICATED POSTGRES PROJECT IS VERIFIED.
--
-- Postgres 15+ draft: an account-wide unique outstanding checkout reservation.
-- This DDL is intentionally not a live migration. It requires a staging
-- concurrency test and a server-only checkout coordinator before rollout.
-- Never expose this schema via a public Data API or frontend API key.

create schema if not exists billing_private;
revoke all on schema billing_private from public, anon, authenticated;

create table if not exists billing_private.checkout_intents (
    intent_id uuid primary key default gen_random_uuid(),
    account_id text not null check (length(account_id) > 0),
    provider text not null check (provider in ('paypal', 'wix')),
    sku text not null check (
      sku in (
        'premium_monthly', 'premium_yearly',
        'premium_plus_monthly', 'premium_plus_yearly'
      )
    ),
    client_idempotency_key text not null
      check (client_idempotency_key ~ '^[A-Za-z0-9._~-]{16,128}
    state text not null default 'reserved'
      check (state in (
        'reserved', 'provider_request_started', 'provider_outcome_unknown',
        'provider_created', 'local_record_failed', 'local_recorded',
        'verified_terminal'
      )),
    provider_id text check (
      provider_id is null or provider_id ~ '^[A-Za-z0-9-]{8,128}$'
    ),
    constraint checkout_created_has_provider_id check (
      state not in ('provider_created', 'local_record_failed', 'local_recorded')
      or provider_id is not null
    ),
    -- Bound fencing to JavaScript's exact-integer range; the server refuses
    -- new mutations when the token has reached the final safe integer.
    fencing_version bigint not null default 1
      check (fencing_version between 1 and 9007199254740991),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint checkout_provider_request_unique
      unique (provider, provider_request_id),
    constraint checkout_account_intent_key_unique
      unique (account_id, client_idempotency_key)
);

-- The critical database guarantee: only ONE outstanding intent for each
-- account, across ALL providers, plan SKUs and request IDs. An ordinary
-- Base44 filter/upsert does not offer this guarantee.
create unique index if not exists checkout_one_outstanding_per_account
  on billing_private.checkout_intents (account_id)
  where state <> 'verified_terminal';

-- Do not permit a single provider agreement to be bound to two accounts
-- or two intent rows, even after the earlier reservation is terminal.
create unique index if not exists checkout_provider_agreement_unique
  on billing_private.checkout_intents (provider, provider_id)
  where provider_id is not null;

create index if not exists checkout_intents_reconcile
  on billing_private.checkout_intents (updated_at, state)
  where state <> 'verified_terminal';

-- Additional defense in depth even if someone changes exposed schemas.
alter table billing_private.checkout_intents enable row level security;
revoke all on billing_private.checkout_intents from public, anon, authenticated;
revoke all on all sequences in schema billing_private
  from public, anon, authenticated;

-- TRANSACTIONAL CLAIM CONTRACT (execute through a trusted server-only DB
-- connection, not directly from the client). The INSERT statement can be
-- executed inside a transaction and must return exactly one row before a
-- provider create is attempted. No row means an unresolved intent already
-- exists or a request key was used; read/reconcile it, DO NOT create again.
--
-- insert into billing_private.checkout_intents
--   (account_id, provider, sku, client_idempotency_key, provider_request_id)
-- values ($1, $2, $3, $4, $5)
-- on conflict do nothing
-- returning intent_id, account_id, state, provider_request_id, fencing_version;
--
-- A later durable state transition MUST use a conditional UPDATE, e.g.
-- update billing_private.checkout_intents
--    set state = $new_state, updated_at = now(),
--        fencing_version = fencing_version + 1
--  where intent_id = $intent_id and account_id = $account_id
--    and fencing_version = $old_version and state = $old_state
-- returning fencing_version;
--
-- Release only after independently verified provider terminal status, with
-- authorized/verified event identity and guarded state transition.
-- The row remains for idempotency/audit; no TTL-based release is allowed.
--
-- REVIEW REQUIRED: roles/grants, backup/recovery, webhook reconciliation,
-- identity proof, audit access, DB outage behavior, staging interleavings,
-- security advisors, and how a Base44 backend authenticates to this store.
),
    provider_request_id text not null
      check (provider_request_id ~ '^[A-Za-z0-9._~-]{16,128}
    state text not null default 'reserved'
      check (state in (
        'reserved', 'provider_request_started', 'provider_outcome_unknown',
        'provider_created', 'local_record_failed', 'local_recorded',
        'verified_terminal'
      )),
    provider_id text check (
      provider_id is null or provider_id ~ '^[A-Za-z0-9-]{8,128}$'
    ),
    constraint checkout_created_has_provider_id check (
      state not in ('provider_created', 'local_record_failed', 'local_recorded')
      or provider_id is not null
    ),
    -- Bound fencing to JavaScript's exact-integer range; the server refuses
    -- new mutations when the token has reached the final safe integer.
    fencing_version bigint not null default 1
      check (fencing_version between 1 and 9007199254740991),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint checkout_provider_request_unique
      unique (provider, provider_request_id),
    constraint checkout_account_intent_key_unique
      unique (account_id, client_idempotency_key)
);

-- The critical database guarantee: only ONE outstanding intent for each
-- account, across ALL providers, plan SKUs and request IDs. An ordinary
-- Base44 filter/upsert does not offer this guarantee.
create unique index if not exists checkout_one_outstanding_per_account
  on billing_private.checkout_intents (account_id)
  where state <> 'verified_terminal';

-- Do not permit a single provider agreement to be bound to two accounts
-- or two intent rows, even after the earlier reservation is terminal.
create unique index if not exists checkout_provider_agreement_unique
  on billing_private.checkout_intents (provider, provider_id)
  where provider_id is not null;

create index if not exists checkout_intents_reconcile
  on billing_private.checkout_intents (updated_at, state)
  where state <> 'verified_terminal';

-- Additional defense in depth even if someone changes exposed schemas.
alter table billing_private.checkout_intents enable row level security;
revoke all on billing_private.checkout_intents from public, anon, authenticated;
revoke all on all sequences in schema billing_private
  from public, anon, authenticated;

-- TRANSACTIONAL CLAIM CONTRACT (execute through a trusted server-only DB
-- connection, not directly from the client). The INSERT statement can be
-- executed inside a transaction and must return exactly one row before a
-- provider create is attempted. No row means an unresolved intent already
-- exists or a request key was used; read/reconcile it, DO NOT create again.
--
-- insert into billing_private.checkout_intents
--   (account_id, provider, sku, client_idempotency_key, provider_request_id)
-- values ($1, $2, $3, $4, $5)
-- on conflict do nothing
-- returning intent_id, account_id, state, provider_request_id, fencing_version;
--
-- A later durable state transition MUST use a conditional UPDATE, e.g.
-- update billing_private.checkout_intents
--    set state = $new_state, updated_at = now(),
--        fencing_version = fencing_version + 1
--  where intent_id = $intent_id and account_id = $account_id
--    and fencing_version = $old_version and state = $old_state
-- returning fencing_version;
--
-- Release only after independently verified provider terminal status, with
-- authorized/verified event identity and guarded state transition.
-- The row remains for idempotency/audit; no TTL-based release is allowed.
--
-- REVIEW REQUIRED: roles/grants, backup/recovery, webhook reconciliation,
-- identity proof, audit access, DB outage behavior, staging interleavings,
-- security advisors, and how a Base44 backend authenticates to this store.
),
    state text not null default 'reserved'
      check (state in (
        'reserved', 'provider_request_started', 'provider_outcome_unknown',
        'provider_created', 'local_record_failed', 'local_recorded',
        'verified_terminal'
      )),
    provider_id text check (
      provider_id is null or provider_id ~ '^[A-Za-z0-9-]{8,128}$'
    ),
    constraint checkout_created_has_provider_id check (
      state not in ('provider_created', 'local_record_failed', 'local_recorded')
      or provider_id is not null
    ),
    -- Bound fencing to JavaScript's exact-integer range; the server refuses
    -- new mutations when the token has reached the final safe integer.
    fencing_version bigint not null default 1
      check (fencing_version between 1 and 9007199254740991),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint checkout_provider_request_unique
      unique (provider, provider_request_id),
    constraint checkout_account_intent_key_unique
      unique (account_id, client_idempotency_key)
);

-- The critical database guarantee: only ONE outstanding intent for each
-- account, across ALL providers, plan SKUs and request IDs. An ordinary
-- Base44 filter/upsert does not offer this guarantee.
create unique index if not exists checkout_one_outstanding_per_account
  on billing_private.checkout_intents (account_id)
  where state <> 'verified_terminal';

-- Do not permit a single provider agreement to be bound to two accounts
-- or two intent rows, even after the earlier reservation is terminal.
create unique index if not exists checkout_provider_agreement_unique
  on billing_private.checkout_intents (provider, provider_id)
  where provider_id is not null;

create index if not exists checkout_intents_reconcile
  on billing_private.checkout_intents (updated_at, state)
  where state <> 'verified_terminal';

-- Additional defense in depth even if someone changes exposed schemas.
alter table billing_private.checkout_intents enable row level security;
revoke all on billing_private.checkout_intents from public, anon, authenticated;
revoke all on all sequences in schema billing_private
  from public, anon, authenticated;

-- TRANSACTIONAL CLAIM CONTRACT (execute through a trusted server-only DB
-- connection, not directly from the client). The INSERT statement can be
-- executed inside a transaction and must return exactly one row before a
-- provider create is attempted. No row means an unresolved intent already
-- exists or a request key was used; read/reconcile it, DO NOT create again.
--
-- insert into billing_private.checkout_intents
--   (account_id, provider, sku, client_idempotency_key, provider_request_id)
-- values ($1, $2, $3, $4, $5)
-- on conflict do nothing
-- returning intent_id, account_id, state, provider_request_id, fencing_version;
--
-- A later durable state transition MUST use a conditional UPDATE, e.g.
-- update billing_private.checkout_intents
--    set state = $new_state, updated_at = now(),
--        fencing_version = fencing_version + 1
--  where intent_id = $intent_id and account_id = $account_id
--    and fencing_version = $old_version and state = $old_state
-- returning fencing_version;
--
-- Release only after independently verified provider terminal status, with
-- authorized/verified event identity and guarded state transition.
-- The row remains for idempotency/audit; no TTL-based release is allowed.
--
-- REVIEW REQUIRED: roles/grants, backup/recovery, webhook reconciliation,
-- identity proof, audit access, DB outage behavior, staging interleavings,
-- security advisors, and how a Base44 backend authenticates to this store.
