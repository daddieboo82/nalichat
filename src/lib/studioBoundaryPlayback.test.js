import { describe, expect, it, vi } from 'vitest';
import { startStudioBoundaryPlayback } from './studioBoundaryPlayback';

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
const flush = async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); };

describe('Studio split-clip playback promise ownership', () => {
  it('does not let an earlier rejection poison a new start after seek', async () => {
    const first = deferred(), second = deferred();
    const starting = new Map(), failed = new Set(), onError = vi.fn();
    const old = { play: () => first.promise };
    const current = { play: () => second.promise };
    expect(startStudioBoundaryPlayback({trackId:1,audio:old,starting,failed,onError})).toBe(true);
    starting.clear(); // transport seek invalidates old pending clip start
    expect(startStudioBoundaryPlayback({trackId:1,audio:current,starting,failed,onError})).toBe(true);
    first.reject(new Error('old clip blocked'));
    await flush();
    expect(failed.size).toBe(0);
    expect(onError).not.toHaveBeenCalled();
    expect(starting.get(1).audio).toBe(current);
    second.resolve();
    await flush();
    expect(starting.has(1)).toBe(false);
  });

  it('does not report stale failure after transport is stopped', async () => {
    const pending = deferred();
    const starting = new Map(), failed = new Set(), onError = vi.fn();
    let active = true;
    startStudioBoundaryPlayback({
      trackId:5,audio:{play:()=>pending.promise},starting,failed,onError,isCurrent:()=>active,
    });
    active = false;
    pending.reject(new Error('stopped'));
    await flush();
    expect(onError).not.toHaveBeenCalled();
    expect(failed.has(5)).toBe(false);
    expect(starting.has(5)).toBe(false);
  });

  it('handles synchronous media play exceptions without wedging subsequent attempts', () => {
    const starting = new Map(), failed = new Set(), onError = vi.fn();
    const bad = { play:()=>{throw new Error('not supported');} };
    expect(startStudioBoundaryPlayback({trackId:2,audio:bad,starting,failed,onError})).toBe(false);
    expect(onError).toHaveBeenCalledOnce();
    expect(starting.has(2)).toBe(false);
    failed.clear();
    expect(startStudioBoundaryPlayback({trackId:2,audio:{play:()=>Promise.resolve()},starting,failed,onError})).toBe(true);
  });

  it('does not start overlapping promises for the same track', async () => {
    const pending = deferred();
    const play = vi.fn(() => pending.promise);
    const starting = new Map(), failed = new Set();
    const props = { trackId:3, audio:{play}, starting, failed };
    expect(startStudioBoundaryPlayback(props)).toBe(true);
    expect(startStudioBoundaryPlayback(props)).toBe(false);
    expect(play).toHaveBeenCalledOnce();
    pending.resolve();
    await flush();
  });
});
