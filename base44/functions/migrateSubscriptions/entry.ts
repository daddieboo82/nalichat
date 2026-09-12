import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import {
  buildSubscriptionMigrationPlan,
  type LegacySubscriptionRecord,
} from '../../shared/subscriptionMigration.ts';
import { consumeHourlyLimit } from '../../shared/rateLimit.ts';
import { readJsonBodyLimited, requestBodyErrorResponse } from '../../shared/requestLimits.ts';

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
    if (user.is_banned) return Response.json({ error: 'banned' }, { status: 403 });
    if (user.timeout_until && new Date(user.timeout_until).getTime() > Date.now()) {
      return Response.json({ error: 'timed_out', timeout_until: user.timeout_until }, { status: 403 });
    }

    const migrationRate = await consumeHourlyLimit(
      base44.asServiceRole.entities,
      user.id,
      'admin_subscription_migration',
      2,
    );
    if (!migrationRate.allowed) {
      return Response.json({ error: 'Admin operation rate limit exceeded. Please try again later.' }, { status: 429 });
    }

    const body = await readJsonBodyLimited(req, 8 * 1024);
    const dryRun = body.dryRun !== false;
    if (!dryRun && body.confirmation !== 'MIGRATE') {
      return Response.json({ error: 'Explicit MIGRATE confirmation is required' }, { status: 400 });
    }
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
    const bodyError = requestBodyErrorResponse(error);
    if (bodyError) return bodyError;
    console.error('Subscription migration error:', error);
    return Response.json({ error: 'Subscription migration failed' }, { status: 500 });
  }
});
