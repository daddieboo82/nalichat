import { describe, expect, it } from 'vitest';
import {
  buildSubscriptionMigrationPlan,
  migrationUpdateForRecord,
} from '../../../base44/shared/subscriptionMigration.ts';

const MIGRATED_AT = '2026-09-10T12:00:00.000Z';

describe('subscription migration normalization', () => {
  it('defaults a legacy trial to Premium and consumes trial eligibility', () => {
    expect(migrationUpdateForRecord({
      id: 'trial-1',
      plan: 'trial',
      status: 'trial',
      created_date: '2026-09-01T00:00:00.000Z',
    }, MIGRATED_AT)).toMatchObject({
      plan: 'premium',
      status: 'trialing',
      trial_started_at: '2026-09-01T00:00:00.000Z',
      trial_used_at: '2026-09-01T00:00:00.000Z',
      migration_source_plan: 'trial',
    });
  });

  it('uses an explicit Premium Plus target for a legacy trial', () => {
    expect(migrationUpdateForRecord({
      id: 'trial-plus',
      plan: 'trial',
      status: 'trial',
      trial_target_plan: 'premium_plus',
    }, MIGRATED_AT)?.plan).toBe('premium_plus');
  });

  it('does not revive an ended or expired legacy trial', () => {
    expect(migrationUpdateForRecord({
      id: 'ended-trial',
      plan: 'trial',
      status: 'ended',
    }, MIGRATED_AT)?.status).toBe('ended');
    expect(migrationUpdateForRecord({
      id: 'expired-trial',
      plan: 'trial',
      status: 'trial',
      trial_end_date: '2026-09-09T12:00:00.000Z',
    }, MIGRATED_AT)?.status).toBe('ended');
  });

  it.each(['pro', 'pro_filesharing'])(
    'grandfathers active %s without modifying external billing fields',
    (legacyPlan) => {
      const record = {
        id: `active-${legacyPlan}`,
        plan: legacyPlan,
        status: 'active',
        provider: 'stripe',
        subscription_id: 'sub_existing',
        stripe_customer_id: 'cus_existing',
        stripe_product_id: 'prod_existing',
        stripe_price_id: 'price_existing',
      };
      const update = migrationUpdateForRecord(record, MIGRATED_AT);

      expect(update).toMatchObject({
        plan: 'premium_plus',
        grandfathered: true,
        grandfathered_from_plan: legacyPlan,
        migration_source_plan: legacyPlan,
      });
      expect(update).not.toHaveProperty('provider');
      expect(update).not.toHaveProperty('subscription_id');
      expect(update).not.toHaveProperty('stripe_customer_id');
      expect(update).not.toHaveProperty('stripe_product_id');
      expect(update).not.toHaveProperty('stripe_price_id');
    },
  );

  it('does not migrate inactive legacy paid records', () => {
    expect(migrationUpdateForRecord({
      id: 'ended-pro',
      plan: 'pro',
      status: 'ended',
    }, MIGRATED_AT)).toBeNull();
  });

  it('reports source and target counts and is idempotent after updates', () => {
    const records = [
      { id: '1', plan: 'trial', status: 'trial' },
      { id: '2', plan: 'pro', status: 'active' },
      { id: '3', plan: 'pro_filesharing', status: 'active' },
      { id: '4', plan: 'free', status: 'active' },
    ];
    const first = buildSubscriptionMigrationPlan(records, MIGRATED_AT);

    expect(first.report).toMatchObject({
      scanned: 4,
      wouldUpdate: 3,
      sourceCounts: {
        legacy_trial: 1,
        active_pro: 1,
        active_pro_filesharing: 1,
      },
      targetCounts: {
        premium_trialing: 1,
        premium_plus_trialing: 0,
        inactive_trial: 0,
        premium_plus_grandfathered: 2,
      },
    });

    const updatesById = new Map(first.operations.map(({ id, update }) => [id, update]));
    const migratedRecords = records.map((record) => ({
      ...record,
      ...updatesById.get(record.id),
    }));
    const rerun = buildSubscriptionMigrationPlan(migratedRecords, '2026-09-11T12:00:00.000Z');

    expect(rerun.operations).toEqual([]);
    expect(rerun.report.wouldUpdate).toBe(0);
    expect(rerun.report.sourceCounts).toEqual({
      legacy_trial: 0,
      active_pro: 0,
      active_pro_filesharing: 0,
    });
  });
});
