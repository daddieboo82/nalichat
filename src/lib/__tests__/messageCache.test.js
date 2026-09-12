import { describe, it, expect } from 'vitest';
import {
  createTempId,
  applySendSuccess,
  applySendFailure,
  applyRealtimeCreate,
} from '@/lib/messageCache';

const temp = (tempId, text) => ({
  id: tempId, _tempId: tempId, text, type: 'text', sender_id: 'me', _optimistic: true,
});
const keyedTemp = (tempId, text) => ({
  ...temp(tempId, text), client_message_key: tempId,
});
const saved = (id, text) => ({ id, text, type: 'text', sender_id: 'me' });

describe('createTempId', () => {
  it('is unique even for ids generated in the same millisecond', () => {
    const ids = new Set();
    for (let i = 0; i < 1000; i++) ids.add(createTempId());
    expect(ids.size).toBe(1000);
  });
});

describe('applySendSuccess', () => {
  it('replaces the matching temp with the saved message', () => {
    const result = applySendSuccess([keyedTemp('t1', 'hello')], saved('real-1', 'hello'), 't1');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('real-1');
    expect(result[0]._optimistic).toBeUndefined();
  });

  it('REGRESSION: keeps other in-flight sends when one resolves', () => {
    // Send A, then send B before A resolves. A resolving must not remove B.
    const cache = [keyedTemp('t-a', 'first'), keyedTemp('t-b', 'second')];
    const result = applySendSuccess(cache, saved('real-a', 'first'), 't-a');
    expect(result.map(m => m.text)).toEqual(['second', 'first']);
    expect(result.some(m => m._tempId === 't-b')).toBe(true);
  });

  it('does not duplicate a message the realtime feed already delivered', () => {
    const cache = [keyedTemp('t1', 'hi'), saved('real-1', 'hi')];
    const result = applySendSuccess(cache, saved('real-1', 'hi'), 't1');
    expect(result.filter(m => m.id === 'real-1')).toHaveLength(1);
  });
});

describe('applySendFailure', () => {
  it('preserves only the failed send as retryable while leaving other sends untouched', () => {
    const cache = [keyedTemp('t-a', 'first'), keyedTemp('t-b', 'second')];
    const result = applySendFailure(cache, 't-a', 'network unavailable', true);
    expect(result.map(m => m.text)).toEqual(['first', 'second']);
    expect(result[0]).toMatchObject({
      client_message_key: 't-a',
      _deliveryState: 'failed',
      _retryable: true,
      _sendError: 'network unavailable',
    });
    expect(result[1]).toEqual(cache[1]);
  });

  it('leaves the cache untouched when no temp id is known', () => {
    const cache = [temp('t-a', 'first')];
    expect(applySendFailure(cache, undefined)).toBe(cache);
  });
});

describe('applyRealtimeCreate', () => {
  it('retires the matching temp and appends the real message', () => {
    const result = applyRealtimeCreate([temp('t1', 'hey')], saved('real-1', 'hey'), 'real-1');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('real-1');
  });

  it('REGRESSION: retires at most one temp, not every temp from the sender', () => {
    const cache = [temp('t-a', 'first'), temp('t-b', 'second')];
    const result = applyRealtimeCreate(cache, saved('real-a', 'first'), 'real-a');
    expect(result.some(m => m._tempId === 't-b')).toBe(true);
  });

  it('retires only one of two temps with identical text', () => {
    const cache = [temp('t1', 'hi'), temp('t2', 'hi')];
    const result = applyRealtimeCreate(cache, saved('r1', 'hi'), 'r1');
    expect(result.filter(m => m._optimistic)).toHaveLength(1);
  });

  it('is idempotent when the same event is delivered twice', () => {
    const once = applyRealtimeCreate([temp('t1', 'hi')], saved('r1', 'hi'), 'r1');
    const twice = applyRealtimeCreate(once, saved('r1', 'hi'), 'r1');
    expect(twice.filter(m => m.id === 'r1')).toHaveLength(1);
  });

  it('appends messages from other people without touching our temps', () => {
    const cache = [temp('t1', 'mine')];
    const incoming = { id: 'r9', text: 'theirs', type: 'text', sender_id: 'them' };
    const result = applyRealtimeCreate(cache, incoming, 'r9');
    expect(result).toHaveLength(2);
    expect(result.some(m => m._tempId === 't1')).toBe(true);
  });
});
