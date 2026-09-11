// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import {
  AI_QUOTA_EXHAUSTED,
  AiQuotaError,
  reserveAiUsage,
  utcUsageWindow,
} from '../../base44/shared/aiQuota.ts';

describe('restored AI quota subsystem', () => {
  it('uses UTC day boundaries for quota resets', () => {
    expect(utcUsageWindow('2026-09-11T23:59:59.000Z')).toMatchObject({
      utcDay: '2026-09-11',
      resetAt: '2026-09-12T00:00:00.000Z',
    });
  });

  it('rejects usage when dispatched records have exhausted the limit', async () => {
    const entity = {
      filter: vi.fn().mockResolvedValue([{
        id: 'used-1',
        user_id: 'user-1',
        utc_day: '2026-09-11',
        request_key: 'previous-request',
        operation: 'agent_message',
        status: 'dispatched',
        reserved_at: '2026-09-11T00:00:00.000Z',
      }]),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    };

    await expect(reserveAiUsage({
      entity,
      userId: 'user-1',
      operation: 'agent_message',
      requestKey: 'new-request-key',
      limit: 1,
      now: '2026-09-11T12:00:00.000Z',
    })).rejects.toMatchObject({
      constructor: AiQuotaError,
      status: 429,
      code: AI_QUOTA_EXHAUSTED,
    });
    expect(entity.create).not.toHaveBeenCalled();
  });
});
