import { describe, expect, it } from 'vitest';
import { hasStudioSaveRevisionChanged } from './studioSaveRevision';

const original = () => ({
  tracks: [{ id: 1 }],
  projectName: 'My Song',
  bpm: 120,
  songKey: 'C Maj',
  timeSignature: '4/4',
  masterFx: { compressor: true },
  roomId: 'room-1',
  userId: 'owner',
});

describe('Studio saved snapshot revision', () => {
  it('does not flag an unchanged committed session', () => {
    const saved = original();
    expect(hasStudioSaveRevisionChanged(saved, { ...saved })).toBe(false);
  });

  it.each([
    ['tracks', () => [{ id: 2 }]],
    ['projectName', () => 'Updated Song'],
    ['bpm', () => 132],
    ['songKey', () => 'D Min'],
    ['timeSignature', () => '3/4'],
    ['masterFx', () => ({ compressor: false })],
    ['roomId', () => 'room-2'],
    ['userId', () => 'another-user'],
  ])('flags changed %s after an asynchronous save started', (key, nextValue) => {
    const saved = original();
    const current = { ...saved, [key]: nextValue() };
    expect(hasStudioSaveRevisionChanged(saved, current)).toBe(true);
  });

  it('refuses to consider an uninitialized revision current', () => {
    expect(hasStudioSaveRevisionChanged(null, original())).toBe(true);
    expect(hasStudioSaveRevisionChanged(original(), null)).toBe(true);
  });
});
