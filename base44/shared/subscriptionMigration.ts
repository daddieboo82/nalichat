import { normalizeStatus } from './subscription.ts';
import type { SubscriptionPlan, SubscriptionStatus } from './subscription.ts';

export const SUBSCRIPTION_MIGRATION_VERSION = 'canonical-plans-v1';

export interface LegacySubscriptionRecord {
  id: string;
  plan?: string | null;
  status?: string | null;
  trial_target_plan?: string | null;
  trial_started_at?: string | null;
  trial_end_date?: string | null;
  trial_used_at?: string | null;
  created_date?: string | null;
  provider?: string | null;
  subscription_id?: string | null;
  stripe_customer_id?: string | null;
  stripe_product_id?: string | null;
  stripe_price_id?: string | null;
  [key: string]: unknown;
}

export interface SubscriptionMigrationUpdate {
  plan: SubscriptionPlan;
  status?: SubscriptionStatus;
  trial_started_at?: string;
  trial_used_at?: string;
  grandfathered?: true;
  grandfathered_from_plan?: 'pro' | 'pro_filesharing';
  grandfathered_at?: string;
  migration_source_plan: 'trial' | 'pro' | 'pro_filesharing';
  migration_version: typeof SUBSCRIPTION_MIGRATION_VERSION;
  migrated_at: string;
}

export interface SubscriptionMigrationOperation {
  id: string;
  update: SubscriptionMigrationUpdate;
}

export interface SubscriptionMigrationCounts {
  legacy_trial: number;
  active_pro: number;
  active_pro_filesharing: number;
}

export interface SubscriptionMigrationTargetCounts {
  premium_trialing: number;
  premium_plus_trialing: number;
  inactive_trial: number;
  premium_plus_grandfathered: number;
}

export interface SubscriptionMigrationPlan {
  operations: SubscriptionMigrationOperation[];
  report: {
    migrationVersion: typeof SUBSCRIPTION_MIGRATION_VERSION;
    scanned: number;
    wouldUpdate: number;
    sourceCounts: SubscriptionMigrationCounts;
    targetCounts: SubscriptionMigrationTargetCounts;
  };
}

function paidTrialTarget(record: LegacySubscriptionRecord): 'premium' | 'premium_plus' {
  return record.trial_target_plan === 'premium_plus' ? 'premium_plus' : 'premium';
}

function migratedTrialStatus(
  record: LegacySubscriptionRecord,
  migratedAt: string,
): SubscriptionStatus {
  const existingStatus = normalizeStatus(record.status);
  if (
    existingStatus === 'ended'
    || existingStatus === 'canceled'
    || existingStatus === 'unpaid'
    || existingStatus === 'incomplete'
  ) {
    return existingStatus;
  }
  if (
    record.trial_end_date
    && Date.parse(record.trial_end_date) <= Date.parse(migratedAt)
  ) {
    return 'ended';
  }
  return 'trialing';
}

export function migrationUpdateForRecord(
  record: LegacySubscriptionRecord,
  migratedAt: string,
): SubscriptionMigrationUpdate | null {
  if (record.plan === 'trial') {
    const trialStartedAt = record.trial_started_at || record.created_date || migratedAt;
    return {
      plan: paidTrialTarget(record),
      status: migratedTrialStatus(record, migratedAt),
      trial_started_at: trialStartedAt,
      trial_used_at: record.trial_used_at || trialStartedAt,
      migration_source_plan: 'trial',
      migration_version: SUBSCRIPTION_MIGRATION_VERSION,
      migrated_at: migratedAt,
    };
  }

  if (
    record.status === 'active'
    && (record.plan === 'pro' || record.plan === 'pro_filesharing')
  ) {
    return {
      plan: 'premium_plus',
      grandfathered: true,
      grandfathered_from_plan: record.plan,
      grandfathered_at: migratedAt,
      migration_source_plan: record.plan,
      migration_version: SUBSCRIPTION_MIGRATION_VERSION,
      migrated_at: migratedAt,
    };
  }

  return null;
}

export function buildSubscriptionMigrationPlan(
  records: readonly LegacySubscriptionRecord[],
  migratedAt: string,
): SubscriptionMigrationPlan {
  const sourceCounts: SubscriptionMigrationCounts = {
    legacy_trial: 0,
    active_pro: 0,
    active_pro_filesharing: 0,
  };
  const targetCounts: SubscriptionMigrationTargetCounts = {
    premium_trialing: 0,
    premium_plus_trialing: 0,
    inactive_trial: 0,
    premium_plus_grandfathered: 0,
  };
  const operations: SubscriptionMigrationOperation[] = [];

  for (const record of records) {
    const update = migrationUpdateForRecord(record, migratedAt);
    if (!update) {
      continue;
    }

    operations.push({ id: record.id, update });
    if (record.plan === 'trial') {
      sourceCounts.legacy_trial += 1;
      if (update.status !== 'trialing') {
        targetCounts.inactive_trial += 1;
      } else if (update.plan === 'premium_plus') {
        targetCounts.premium_plus_trialing += 1;
      } else {
        targetCounts.premium_trialing += 1;
      }
    } else {
      const sourceKey = record.plan === 'pro' ? 'active_pro' : 'active_pro_filesharing';
      sourceCounts[sourceKey] += 1;
      targetCounts.premium_plus_grandfathered += 1;
    }
  }

  return {
    operations,
    report: {
      migrationVersion: SUBSCRIPTION_MIGRATION_VERSION,
      scanned: records.length,
      wouldUpdate: operations.length,
      sourceCounts,
      targetCounts,
    },
  };
}
