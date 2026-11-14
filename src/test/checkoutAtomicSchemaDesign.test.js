import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const sql = readFileSync('docs/sql/checkout-intent-postgres-design.sql', 'utf8');
const normalized = sql.replace(/--[^\n]*/g, '').replace(/\s+/g, ' ').toLowerCase();
const occurrences = (needle) => normalized.split(needle).length - 1;

describe('staging-only checkout SQL design (not executed in PostgreSQL)', () => {
  it('enforces one outstanding account-wide checkout', () => {
    expect(normalized).toContain('create unique index if not exists checkout_one_outstanding_per_account');
    expect(normalized).toContain('on billing_private.checkout_intents (account_id)');
    expect(normalized).toContain("where state <> 'verified_terminal'");
    expect(normalized).toContain('constraint checkout_provider_request_unique');
    expect(normalized).toContain('constraint checkout_account_intent_key_unique');
  });

  it('requires unique and persisted provider agreement IDs', () => {
    expect(normalized).toContain('create unique index if not exists checkout_provider_agreement_unique');
    expect(normalized).toContain('on billing_private.checkout_intents (provider, provider_id)');
    expect(normalized).toContain('where provider_id is not null');
    expect(normalized).toContain('constraint checkout_created_has_provider_id check');
    expect(normalized).toContain('or provider_id is not null');
  });

  it('contains exactly one complete table definition and safe version bound', () => {
    expect(occurrences('create table if not exists billing_private.checkout_intents')).toBe(1);
    expect(occurrences('create unique index if not exists checkout_provider_agreement_unique')).toBe(1);
    expect(occurrences('constraint checkout_created_has_provider_id')).toBe(1);
    expect(occurrences('fencing_version bigint not null default 1')).toBe(1);
    expect(normalized).toContain('unique (account_id, client_idempotency_key) );');
    expect(normalized).toContain('check (fencing_version between 1 and 9007199254740991)');
  });

  it('requires approved plan names and safe checkout identity formats', () => {
    for (const plan of [
      'premium_monthly', 'premium_yearly',
      'premium_plus_monthly', 'premium_plus_yearly',
    ]) {
      expect(normalized).toContain("'" + plan + "'");
    }
    expect(normalized).toContain('sku in (');
    expect(normalized).toContain('char_length(client_idempotency_key) between 16 and 128');
    expect(normalized).toContain('char_length(provider_request_id) between 16 and 128');
    expect(normalized).toContain('and translate(client_idempotency_key,');
    expect(normalized).toContain('and translate(provider_request_id,');
    expect(occurrences('abcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyz0123456789._~-')).toBe(2);
  });

  it('rejects anonymous/public table access', () => {
    expect(normalized).toContain('create schema if not exists billing_private;');
    expect(normalized).toContain('alter table billing_private.checkout_intents enable row level security;');
    expect(normalized).toContain('revoke all on billing_private.checkout_intents from public, anon, authenticated;');
    expect(normalized).not.toContain('grant all on billing_private.checkout_intents to public');
  });
});
