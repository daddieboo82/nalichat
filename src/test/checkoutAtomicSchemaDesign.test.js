import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const sql = readFileSync('docs/sql/checkout-intent-postgres-design.sql', 'utf8');
const normalized = sql.replace(/--[^\n]*/g, '').replace(/\s+/g, ' ').toLowerCase();

describe('staging-only atomic checkout SQL design (not deployed)', () => {
  it('reserves an entire account across providers and request keys', () => {
    expect(normalized).toMatch(/create unique index if not exists checkout_one_outstanding_per_account\s+on billing_private\.checkout_intents \(account_id\)\s+where state <> 'verified_terminal'/);
    expect(normalized).toMatch(/constraint checkout_provider_request_unique\s+unique \(provider, provider_request_id\)/);
    expect(normalized).toMatch(/constraint checkout_account_intent_key_unique\s+unique \(account_id, client_idempotency_key\)/);
  });

  it('uniquely binds each provider subscription and disallows unbound created states', () => {
    expect(normalized).toMatch(
      /create unique index if not exists checkout_provider_agreement_unique\\s+on billing_private\\.checkout_intents \\(provider, provider_id\\)\\s+where provider_id is not null/,
    );
    expect(normalized).toContain('constraint checkout_created_has_provider_id check');
    expect(normalized).toMatch(
      /state not in \\('provider_created', 'local_record_failed', 'local_recorded'\\)\\s+or provider_id is not null/,
    );
  });

  it('keeps the reservation table out of the public data API', () => {
    expect(normalized).toContain('create schema if not exists billing_private;');
    expect(normalized).toContain('alter table billing_private.checkout_intents enable row level security;');
    expect(normalized).toContain('revoke all on billing_private.checkout_intents from public, anon, authenticated;');
    expect(normalized).not.toMatch(/grant\s+(?:all|insert|update|delete)\s+on\s+billing_private\.checkout_intents\s+to\s+(?:public|anon|authenticated)/);
  });

  it('requires a durable retry identity and fencing version', () => {
    for (const field of ['account_id', 'intent_id', 'provider_request_id', 'client_idempotency_key', 'fencing_version']) {
      expect(normalized).toContain(field);
    }
    expect(normalized).toContain('state <> \'verified_terminal\'');
  });
});
