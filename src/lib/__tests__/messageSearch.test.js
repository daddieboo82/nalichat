import { describe, expect, it, vi } from 'vitest';
import {
  executeMessageSearch,
  MessageSearchError,
  normalizeMessageSearchInput,
} from '../../../base44/shared/messageSearch.ts';

const conversation = {
  id: 'conversation-1',
  participant_ids: ['user-1', 'user-2'],
};

function message(overrides) {
  return {
    id: overrides.id,
    conversation_id: 'conversation-1',
    sender_id: 'user-2',
    sender_name: 'Taylor',
    text: '',
    type: 'text',
    created_date: '2026-09-10T12:00:00.000Z',
    private_metadata: 'must never be returned',
    ...overrides,
  };
}

function dependencies({
  records = [],
  memberConversation = conversation,
  plan = 'premium',
  status = 'active',
} = {}) {
  const filter = vi.fn(async (query, sort, limit, skip) => {
    const filtered = records.filter((record) => {
      if (record.conversation_id !== query.conversation_id) return false;
      if (query.sender_id && record.sender_id !== query.sender_id) return false;
      if (query.type && record.type !== query.type) return false;
      if (query.created_date?.$gte && record.created_date < query.created_date.$gte) return false;
      if (query.created_date?.$lt && record.created_date >= query.created_date.$lt) return false;
      return true;
    });
    filtered.sort((left, right) => {
      const comparison = left.created_date.localeCompare(right.created_date);
      return sort.startsWith('-') ? -comparison : comparison;
    });
    return filtered.slice(skip, skip + limit);
  });

  return {
    deps: {
      conversationEntity: {
        get: vi.fn(async () => memberConversation),
      },
      messageEntity: { filter },
      entities: {
        Subscription: {
          filter: vi.fn(async () => [{ plan, status }]),
        },
      },
    },
    filter,
  };
}

async function expectSearchError(promise, code, status) {
  await expect(promise).rejects.toMatchObject({
    name: 'MessageSearchError',
    code,
    status,
  });
}

describe('advanced message search', () => {
  it('rejects requesters who are not conversation members before querying messages', async () => {
    const { deps, filter } = dependencies();

    await expectSearchError(
      executeMessageSearch(deps, { conversation_id: conversation.id, query: 'mix' }, 'outsider'),
      'CONVERSATION_ACCESS_DENIED',
      403,
    );
    expect(filter).not.toHaveBeenCalled();
  });

  it('requires the canonical entitlement for advanced filters', async () => {
    const { deps, filter } = dependencies({ plan: 'free' });

    await expectSearchError(
      executeMessageSearch(
        deps,
        { conversation_id: conversation.id, sender_id: 'user-2' },
        'user-1',
      ),
      'ADVANCED_SEARCH_ENTITLEMENT_REQUIRED',
      403,
    );
    expect(filter).not.toHaveBeenCalled();
  });

  it('preserves free basic text search and returns only result fields', async () => {
    const { deps, filter } = dependencies({
      plan: 'free',
      records: [
        message({ id: 'match', text: 'Final MIX bounce', file_url: 'https://private.example/file' }),
        message({ id: 'other', text: 'Unrelated message' }),
        message({ id: 'outside', conversation_id: 'conversation-2', text: 'Final mix secret' }),
      ],
    });

    const response = await executeMessageSearch(
      deps,
      { conversation_id: conversation.id, query: 'final mix' },
      'user-1',
    );

    expect(response.results).toEqual([{
      id: 'match',
      sender_id: 'user-2',
      sender_name: 'Taylor',
      text: 'Final MIX bounce',
      type: 'text',
      file_name: undefined,
      created_date: '2026-09-10T12:00:00.000Z',
      thread_id: undefined,
    }]);
    expect(filter).toHaveBeenCalledWith(
      { conversation_id: conversation.id },
      '-created_date',
      100,
      0,
    );
  });

  it('composes sender, date, type, and text filters with inclusive/exclusive boundaries', async () => {
    const { deps } = dependencies({
      records: [
        message({
          id: 'from-boundary',
          sender_id: 'user-2',
          type: 'audio',
          file_name: 'Hook.wav',
          created_date: '2026-09-01T04:00:00.000Z',
        }),
        message({
          id: 'inside',
          sender_id: 'user-2',
          type: 'audio',
          text: 'hook idea',
          created_date: '2026-09-02T12:00:00.000Z',
        }),
        message({
          id: 'to-boundary',
          sender_id: 'user-2',
          type: 'audio',
          text: 'hook idea',
          created_date: '2026-09-03T04:00:00.000Z',
        }),
        message({
          id: 'wrong-sender',
          sender_id: 'user-1',
          type: 'audio',
          text: 'hook idea',
          created_date: '2026-09-02T12:00:00.000Z',
        }),
        message({
          id: 'wrong-type',
          sender_id: 'user-2',
          type: 'image',
          text: 'hook idea',
          created_date: '2026-09-02T12:00:00.000Z',
        }),
      ],
    });

    const response = await executeMessageSearch(deps, {
      conversation_id: conversation.id,
      query: 'hook',
      sender_id: 'user-2',
      date_from: '2026-09-01T00:00:00-04:00',
      date_to: '2026-09-03T00:00:00-04:00',
      types: ['audio'],
      order: 'oldest',
    }, 'user-1');

    expect(response.results.map((result) => result.id)).toEqual(['from-boundary', 'inside']);
  });

  it('matches any selected content type and sorts equal timestamps by id', async () => {
    const { deps } = dependencies({
      records: [
        message({ id: 'b', type: 'session' }),
        message({ id: 'a', type: 'image' }),
        message({ id: 'c', type: 'text' }),
      ],
    });

    const response = await executeMessageSearch(deps, {
      conversation_id: conversation.id,
      types: ['image', 'session'],
      order: 'oldest',
    }, 'user-1');

    expect(response.results.map((result) => result.id)).toEqual(['a', 'b']);
  });

  it('uses bounded offsets for pagination without scanning globally', async () => {
    const records = Array.from({ length: 65 }, (_, index) => message({
      id: `message-${String(index).padStart(2, '0')}`,
      text: `result ${index}`,
      created_date: new Date(Date.UTC(2026, 8, 10, 0, index)).toISOString(),
    }));
    const { deps, filter } = dependencies({ records });

    const first = await executeMessageSearch(deps, {
      conversation_id: conversation.id,
      query: 'result',
      order: 'oldest',
      limit: 25,
    }, 'user-1');
    const second = await executeMessageSearch(deps, {
      conversation_id: conversation.id,
      query: 'result',
      order: 'oldest',
      limit: 25,
      offset: first.pagination.next_offset,
    }, 'user-1');

    expect(first.results).toHaveLength(25);
    expect(first.pagination).toMatchObject({ next_offset: 25, has_more: true, scanned: 25 });
    expect(second.results[0].id).toBe('message-25');
    expect(filter.mock.calls.every(([query]) => query.conversation_id === conversation.id)).toBe(true);
  });

  it('never emits a continuation offset that exceeds the accepted cap', async () => {
    const { deps } = dependencies();
    deps.messageEntity.filter = vi.fn(async (_query, _sort, limit, skip) =>
      Array.from({ length: limit }, (_, index) => message({
        id: `message-${skip + index}`,
        text: `result ${skip + index}`,
        created_date: new Date(Date.UTC(2026, 8, 10, 0, 0, skip + index)).toISOString(),
      })));

    const response = await executeMessageSearch(deps, {
      conversation_id: conversation.id,
      query: 'result',
      offset: 9_990,
      limit: 50,
    }, 'user-1');

    expect(response.results).toHaveLength(11);
    expect(response.pagination).toMatchObject({
      next_offset: null,
      has_more: false,
      truncated: true,
      scanned: 11,
    });
  });

  it('rejects an empty query/filter request and malformed date ranges', () => {
    expect(() => normalizeMessageSearchInput({
      conversation_id: conversation.id,
      query: '   ',
    })).toThrowError(MessageSearchError);
    expect(() => normalizeMessageSearchInput({
      conversation_id: conversation.id,
      sender_id: 'user-2',
      date_from: '2026-09-03T00:00:00Z',
      date_to: '2026-09-03T00:00:00Z',
    })).toThrowError(expect.objectContaining({ code: 'INVALID_SEARCH_DATE_RANGE' }));
    expect(() => normalizeMessageSearchInput({
      conversation_id: conversation.id,
      sender_id: 'user-2',
      date_from: '2026-09-03',
    })).toThrowError(expect.objectContaining({ code: 'INVALID_SEARCH_DATE' }));
  });
});
