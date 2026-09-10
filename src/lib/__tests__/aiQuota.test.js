import { describe, expect, it } from 'vitest';
import {
  AI_QUOTA_EXHAUSTED,
  AI_REQUEST_ALREADY_DISPATCHED,
  AiQuotaError,
  commitAiUsage,
  executeMeteredAiRequest,
  reserveAiUsage,
  utcUsageWindow,
} from '../../../base44/shared/aiQuota.ts';

function usageEntity(initial = []) {
  const records = initial.map((record) => ({ ...record }));
  let sequence = records.length;
  return {
    records,
    async filter(query) {
      return records.filter((record) => (
        Object.entries(query).every(([key, value]) => record[key] === value)
      ));
    },
    async create(data) {
      const record = { id: `usage-${++sequence}`, ...data };
      records.push(record);
      return record;
    },
    async update(id, update) {
      const record = records.find((candidate) => candidate.id === id);
      Object.assign(record, update);
      return record;
    },
    async delete(id) {
      const index = records.findIndex((candidate) => candidate.id === id);
      if (index >= 0) records.splice(index, 1);
    },
  };
}

describe('UTC AI quota accounting', () => {
  it('resets at the next UTC day boundary', () => {
    expect(utcUsageWindow('2026-09-10T23:59:59.999Z')).toMatchObject({
      utcDay: '2026-09-10',
      resetAt: '2026-09-11T00:00:00.000Z',
    });
    expect(utcUsageWindow('2026-09-11T00:00:00.000Z').utcDay).toBe('2026-09-11');
  });

  it('increments only when a reserved request is committed', async () => {
    const entity = usageEntity();
    const { reservation, quota } = await reserveAiUsage({
      entity,
      userId: 'user-1',
      operation: 'mastering',
      requestKey: 'mastering:req-1',
      limit: 20,
      now: '2026-09-10T12:00:00.000Z',
    });
    expect(quota.used).toBe(0);
    expect(entity.records[0].status).toBe('reserved');

    const committed = await commitAiUsage({
      entity,
      reservation,
      limit: 20,
      resetAt: quota.reset_at,
      now: '2026-09-10T12:00:01.000Z',
    });
    expect(committed).toMatchObject({ limit: 20, used: 1, remaining: 19 });
    expect(entity.records[0].status).toBe('dispatched');
  });

  it('returns a structured exhausted error', async () => {
    const entity = usageEntity([{
      id: 'usage-1',
      user_id: 'user-1',
      utc_day: '2026-09-10',
      request_key: 'mastering:req-1',
      operation: 'mastering',
      status: 'dispatched',
      reserved_at: '2026-09-10T10:00:00.000Z',
      dispatched_at: '2026-09-10T10:00:01.000Z',
    }]);

    await expect(reserveAiUsage({
      entity,
      userId: 'user-1',
      operation: 'mastering',
      requestKey: 'mastering:req-2',
      limit: 1,
      now: '2026-09-10T12:00:00.000Z',
    })).rejects.toMatchObject({
      status: 429,
      code: AI_QUOTA_EXHAUSTED,
      quota: {
        limit: 1,
        used: 1,
        remaining: 0,
        reset_at: '2026-09-11T00:00:00.000Z',
      },
    });
  });

  it('does not double-count a dispatched idempotency key', async () => {
    const entity = usageEntity([{
      id: 'usage-1',
      user_id: 'user-1',
      utc_day: '2026-09-10',
      request_key: 'cover:req-1',
      operation: 'cover_art',
      status: 'dispatched',
      reserved_at: '2026-09-10T10:00:00.000Z',
      dispatched_at: '2026-09-10T10:00:01.000Z',
    }]);

    try {
      await reserveAiUsage({
        entity,
        userId: 'user-1',
        operation: 'cover_art',
        requestKey: 'cover:req-1',
        limit: 20,
        now: '2026-09-10T12:00:00.000Z',
      });
      throw new Error('Expected duplicate request to fail');
    } catch (error) {
      expect(error).toBeInstanceOf(AiQuotaError);
      expect(error.code).toBe(AI_REQUEST_ALREADY_DISPATCHED);
      expect(entity.records).toHaveLength(1);
    }
  });

  it('starts a fresh allowance after midnight UTC', async () => {
    const entity = usageEntity([{
      id: 'usage-1',
      user_id: 'user-1',
      utc_day: '2026-09-10',
      request_key: 'speech:req-1',
      operation: 'speech',
      status: 'dispatched',
      reserved_at: '2026-09-10T23:59:58.000Z',
      dispatched_at: '2026-09-10T23:59:59.000Z',
    }]);
    const { quota } = await reserveAiUsage({
      entity,
      userId: 'user-1',
      operation: 'speech',
      requestKey: 'speech:req-2',
      limit: 1,
      now: '2026-09-11T00:00:00.000Z',
    });
    expect(quota).toMatchObject({ used: 0, remaining: 1 });
  });

  it('counts a provider request that was dispatched but rejected', async () => {
    const entity = usageEntity();
    const base44 = {
      asServiceRole: {
        entities: {
          AIUsage: entity,
          Subscription: { filter: async () => [] },
        },
      },
    };

    await expect(executeMeteredAiRequest({
      base44,
      user: { id: 'user-1' },
      operation: 'speech',
      requestKey: 'speech:failed-1',
      now: '2026-09-10T12:00:00.000Z',
      dispatch: async () => {
        throw new Error('provider unavailable');
      },
    })).rejects.toThrow('provider unavailable');
    expect(entity.records).toHaveLength(1);
    expect(entity.records[0].status).toBe('dispatched');
  });
});
