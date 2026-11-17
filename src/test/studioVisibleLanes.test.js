import { describe, expect, it } from 'vitest';
import { visibleStudioClipLanes, reorderVisibleStudioClipLanes } from '../lib/studioClipLanes.js';

const sample = () => [
  { id: 1, name: 'A', duration: 4 },
  { id: 2, splitFrom: 1, duration: 4 },
  { id: 3, name: 'Hidden', hidden: true },
  { id: 4, trackType: 'folder', collapsed: true, folderMembers: [5] },
  { id: 5, name: 'Collapsed member' },
  { id: 6, name: 'B' },
  { id: 7, splitFrom: 6 },
  { id: 8, name: 'C' },
];

describe('Studio timeline and header visible lane alignment', () => {
  it('filters hidden tracks and collapsed folder members consistently', () => {
    const lanes = visibleStudioClipLanes(sample());
    expect(lanes.map(l => l.primary.id)).toEqual([1,4,6,8]);
    expect(lanes[0].clips.map(c=>c.id)).toEqual([1,2]);
    expect(lanes[2].clips.map(c=>c.id)).toEqual([6,7]);
  });

  it('reorders visible lanes while keeping hidden and collapsed lanes in place', () => {
    const source = sample();
    const updated = reorderVisibleStudioClipLanes(source, 2, 0);
    expect(visibleStudioClipLanes(updated).map(l => l.primary.id)).toEqual([6,1,4,8]);
    expect(updated.map(t=>t.id)).toEqual([6,7,3,1,2,5,4,8]);
    expect(source.map(t=>t.id)).toEqual([1,2,3,4,5,6,7,8]);
  });

  it('ignores invalid drag indices without changing clip data', () => {
    const source = sample();
    expect(reorderVisibleStudioClipLanes(source, 100, 1)).toBe(source);
    expect(reorderVisibleStudioClipLanes(source, 1, 1)).toBe(source);
    expect(reorderVisibleStudioClipLanes(source, -1, 0)).toBe(source);
  });

  it('treats hidden split-root lanes consistently with visible child records', () => {
    const source = [{id:1, hidden:true},{id:2,splitFrom:1},{id:3}];
    expect(visibleStudioClipLanes(source).map(l=>l.primary.id)).toEqual([3]);
  });
});
