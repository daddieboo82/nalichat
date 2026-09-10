import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import {
  buildSubscriptionMigrationPlan,
  type LegacySubscriptionRecord,
} from '../../shared/subscriptionMigration.ts';

const PAGE_SIZE = 500;

interface SubscriptionEntity {
  filter(
    query: Record<string, unknown>,
    sort: string,
    limit: number,
    skip: number,
  ): Promise<LegacySubscriptionRecord[]>;
  update(id: string, data: object): Promise<unknown>;
}

async function loadAllSubscriptions(
  subscriptionEntity: SubscriptionEntity,
): Promise<LegacySubscriptionRecord[]> {
  const subscriptions: LegacySubscriptionRecord[] = [];
  for (let skip = 0; ; skip += PAGE_SIZE) {
    const page = await subscriptionEntity.filter({}, '-created_date', PAGE_SIZE, skip);
    subscriptions.push(...page);
    if (page.length < PAGE_SIZE) {
      return subscriptions;
    }
  }
}

Deno.serve(async (req) => {
  try {
    if (req.method !== 'POST') {
      return Response.json({ error: 'Method not allowed' }, { status: 405 });
    }

    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: admin role required' }, { status: 403 });
    }

    const body = await req.json();
    const dryRun = body.dryRun !== false;
    const subscriptions = await loadAllSubscriptions(
      base44.asServiceRole.entities.Subscription,
    );
    const migration = buildSubscriptionMigrationPlan(subscriptions, new Date().toISOString());

    if (!dryRun) {
      for (const operation of migration.operations) {
        await base44.asServiceRole.entities.Subscription.update(operation.id, operation.update);
      }
    }

    return Response.json({
      ...migration.report,
      dryRun,
      updated: dryRun ? 0 : migration.operations.length,
    });
  } catch (error) {
    console.error('Subscription migration error:', error);
    const message = error instanceof Error ? error.message : 'Subscription migration failed';
    return Response.json({ error: message }, { status: 500 });
  }
});
