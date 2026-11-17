import { describe, expect, it } from 'vitest';
import { getStudioClipLaneId, groupStudioClipLanes } from '../lib/studioClipLanes.js';

describe('Studio clip lane grouping', () => {
  it('keeps multiple split clips on one derived lane', () => {
    const input = [
      { id: 9, splitFrom: 7, startTime: 4, duration: 3 },
      { id: 7, splitFrom: 7, startTime: 1, duration: 3 },
      { id: 12, startTime: 0, duration: 5 },
    ];
    const lanes = groupStudioClipLanes(input);
    expect(lanes).toHaveLength(2);
    expect(lanes[0].key).toBe('7');
    expect(lanes[0].primary.id).toBe(7);
    expect(lanes[0].clips.map((x) => x.id)).toEqual([7, 9]);
    expect(lanes[1].clips.map((x) => x.id)).toEqual([12]);
    expect(input.map((x) => x.id)).toEqual([9, 7, 12]);
  });

  it('groups numeric and string lineage consistently', () => {
    expect(getStudioClipLaneId({ id: '9', splitFrom: 7 })).toBe('7');
    expect(groupStudioClipLanes([
      { id: 7 }, { id: '11', splitFrom: '7' },
    ])).toHaveLength(1);
  });

  it('preserves orphaned split siblings when original root was removed', () => {
    const lanes = groupStudioClipLanes([
      { id: 22, splitFrom: 5, startTime: 4 },
      { id: 21, splitFrom: 5, startTime: 1 },
    ]);
    expect(lanes).toHaveLength(1);
    expect(lanes[0].clips.map((x) => x.id)).toEqual([21, 22]);
  });

  it('does not group unrelated non-split tracks', () => {
    expect(groupStudioClipLanes([{ id: 1 }, { id: 2 }, { id: 3 }])).toHaveLength(3);
  });

  it('does not change persisted tracks, play URLs, clip offsets or IDs', () => {
    const source = Object.freeze({ id: 1, duration: 2, clipStart: 8, audioUrl: 'one.wav', splitFrom: 1 });
    const output = groupStudioClipLanes([source]);
    expect(output[0].clips[0]).toBe(source);
    expect(output[0].clips[0]).toEqual(source);
  });
});
