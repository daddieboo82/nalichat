import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const script = readFileSync('scripts/test-checkout-postgres-staging.py', 'utf8');
const count = (value) => script.split(value).length - 1;

describe('opt-in PostgreSQL staging harness structural checks', () => {
  it('uses valid tagged PostgreSQL DO delimiters for both expected errors', () => {
    expect(count('do $checkout_test$')).toBe(2);
    expect(count('end $checkout_test$;')).toBe(2);
    expect(count('do $\n')).toBe(0);
    expect(count('end $;')).toBe(0);
    expect(script).toContain('exception when unique_violation then');
    expect(script).toContain('exception when check_violation then');
  });

  it('requires explicit staging selection and never runs against known unrelated project', () => {
    expect(script).toContain('NALICHAT_STAGING_DB_CONFIRMED');
    expect(script).toContain('nalichat_checkout_staging_');
    expect(script).toContain('LIVE_SUPABASE_HOST');
    expect(script).toContain('current_database()');
    expect(script).toContain('drop schema if exists');
  });
});
